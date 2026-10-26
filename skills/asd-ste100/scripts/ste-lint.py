#!/usr/bin/env python3
"""ste-lint.py — deterministic ASD-STE100 structural linter (stdlib only).

Checks (hard, fail the run):
  - semicolon            Rule 8.1 bans ';' outright.
  - sentence-length      >20 words in instruction/procedure text, >25 elsewhere.
  - phrasal-verb         two-word verbs from a curated avoid-list (Rule 9.3).
  - nominalization       "perform/make/provide ... -ation/-ment/-ance" patterns (Rule 3.7).
  - marketing-adjective  hollow quality claims (seamless, robust, cutting-edge...).
  - dangling-conjunction list item ("- Set the target and").
  - noun-cluster         4+ word noun stacks (heuristic).

Checks (advisory, never fail the run):
  - passive-voice        be-verb + past participle without an actor.
  - compound-tense       present perfect / past perfect forms.

By design this linter NEVER flags hedges or modality ("may have failed" passes
clean) — those are content, not style. --selftest asserts that.

Usage:
  ste-lint.py [FILE...]           # or pipe text on stdin
  ste-lint.py --json [FILE...]    # structured output
  ste-lint.py --baseline N        # tolerate N hard violations before exit 1
  ste-lint.py --disable r1,r2     # silence named rules
  ste-lint.py --selftest          # run built-in assertions, exit 0/1
"""

import argparse
import json
import re
import sys

# --------------------------------------------------------------------------
# Word lists
# --------------------------------------------------------------------------

PHRASAL_VERBS = {
    # soft / jargon phrasal verbs first
    "spin up", "spin off", "shut down", "boot up", "start up", "warm up",
    "reach out", "dive into", "dig into", "drill down", "roll out", "roll back",
    "kick off", "wrap up", "level up", "scale up", "speed up",
    "slow down", "sync up", "hand off", "hand over", "phase in", "phase out",
    "point out", "carry out", "set up", "tear down", "break down",
    "call off", "figure out", "find out", "print out", "sort out", "strip out",
    "try out", "use up", "write off", "log in", "opt in", "opt out",
    "sign in", "sign up", "check out", "count on", "fall back", "fail over",
    "back up", "bring up", "brings up", "come up with", "comes up with",
    "give up", "gives up", "take over", "takes over", "turn off", "turn on",
    "switch on", "switch off", "open up", "closes down", "close down",
    "end up", "ended up",
}

MARKETING_ADJECTIVES = {
    "seamless", "seamlessly", "robust", "powerful", "cutting-edge",
    "state-of-the-art", "effortless", "effortlessly", "blazing-fast",
    "revolutionary", "game-changing", "world-class", "next-generation",
    "best-in-class", "ultimate", "unparalleled", "lightning-fast",
    "delightful", "innovative",
}

NOMINALIZATION_PATTERNS = [
    # Light-verb + action noun (Rule 3.7): "perform an evaluation",
    # "make a replacement", "carry out a verification".
    (r"\b(?:perform|performs|performed|make|makes|made|"
     r"provide|provides|provided|conduct|conducts|conducted|"
     r"carry out|carries out)\s+"
     r"(?:an\s+|a\s+|the\s+)?"
     r"\w*(?:ation|ections?|ments?|ances?|ences?)\b",
     "action frozen into a noun; use the verb"),
    # The canonical STE example uses the verb "analyze", not a noun with an
    # -ation/-ment suffix: "perform an analysis" -> "analyze".
    (r"\b(?:perform|performs|performed|make|makes|made|"
     r"provide|provides|provided|conduct|conducts|conducted|"
     r"carry out|carries out)\s+(?:an\s+|a\s+|the\s+)?"
     r"(?:analys|diagnos|paraphras)(?:is|es)\b",
     "action frozen into a noun; use the verb"),
]

PASSIVE_RE = re.compile(
    r"\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?"
    r"(\w+(?:ed|en|wn|nn|ten|un|ung|ilt|uck|ought|aught))\b"
)

COMPOUND_TENSE_RE = re.compile(
    r"\b(?:have|has|had)\s+(?:\w+ly\s+)?\w+"
    r"(?:ed|en|wn|nn|ten|un|ung|ilt|uck|ought|aught|ept|ft)\b"
)

NOUN_CLUSTER_STOPPERS = {
    "the", "a", "an", "of", "to", "and", "or", "in", "on", "for", "with",
    "that", "this", "these", "those", "it", "its", "is", "are", "was", "were",
    "not", "no", "all", "each", "every", "some", "any", "if", "then", "else",
    # common verb forms break a noun stack (lowercase prose cannot be a
    # proper-noun stack anyway; these keep the heuristic off ordinary sentences)
    "has", "have", "had", "do", "does", "did", "can", "may", "might", "must",
    "will", "would", "should", "could", "use", "uses", "set", "sets", "get",
    "gets", "make", "makes", "put", "puts", "run", "runs", "test", "tests",
}

DANGLING_CONJ_RE = re.compile(r"\b(and|or|but)\s*[,.]?\s*$", re.IGNORECASE)

LIST_ITEM_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")

ABBREVIATIONS = (
    "e.g.", "i.e.", "etc.", "vs.", "mr.", "mrs.", "dr.", "inc.", "ltd.",
    "u.s.", "a.m.", "p.m.", "fig.", "no.", "approx.",
)


# --------------------------------------------------------------------------
# Text segmentation helpers
# --------------------------------------------------------------------------

def find_fenced_blocks(text):
    """Return list of (start, end) line-index ranges covered by fenced code."""
    lines = text.splitlines()
    blocks = []
    open_fence = None  # (marker_char, length, start_line)
    for i, raw in enumerate(lines):
        stripped = raw.strip()
        m = re.match(r"^(`{3,}|~{3,})", stripped)
        if m:
            marker = m.group(1)
            if open_fence is None:
                open_fence = (marker[0], len(marker), i)
            elif marker[0] == open_fence[0] and len(marker) >= open_fence[1]:
                blocks.append((open_fence[2], i))
                open_fence = None
    if open_fence is not None:  # unterminated fence -> rest of file
        blocks.append((open_fence[2], len(lines) - 1))
    return blocks


def in_fenced(line_idx, blocks):
    return any(a <= line_idx <= b for a, b in blocks)


def strip_inline_code(line):
    return re.sub(r"`[^`]*`", " ", line)


def split_sentences(text):
    """Split into (sentence_text, start_offset) pairs. Conservative: abbreviations,
    decimals and ellipses do not end sentences."""
    sentences = []
    buf = []
    start = 0
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch in ".!?\n":
            j = i
            while j < n and text[j] in ".!?\n":
                j += 1
            ends_abbrev = False
            if ch == ".":
                last = "".join(buf).rstrip()
                for ab in ABBREVIATIONS:
                    if last.lower().endswith(ab):
                        ends_abbrev = True
                        break
                if re.search(r"\b[A-Z]\.$", last):  # initials: "J. Smith"
                    ends_abbrev = True
            if ch == "\n" and not "".join(buf).strip():
                start = j
                i = j
                continue
            if ends_abbrev:
                buf.append(text[i:j])
                i = j
                continue
            before = "".join(buf).rstrip()
            after = text[j:j + 1]
            if ch == "." and re.search(r"\d$", before) and re.match(r"\d", after or ""):
                buf.append(".")
                i = j
                continue
            buf.append(text[i:j])
            s = "".join(buf).strip()
            if s:
                sentences.append((s, start))
            buf = []
            start = j
            i = j
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        sentences.append((tail, start))
    return sentences


INSTRUCTION_HINTS = re.compile(
    r"\b(install|run|create|add|edit|set|use|apply|copy|move|delete|configure|"
    r"open|close|check|test|build|start|stop|enable|disable|ensure|remove)\b",
    re.IGNORECASE,
)


def max_words_for(sentence):
    """Procedures/instructions cap at 20 words; descriptions at 25 (Issue 9)."""
    low = sentence.lower()
    if low.endswith("?"):
        return 25
    if INSTRUCTION_HINTS.search(sentence[:40]):
        return 20
    return 25


# --------------------------------------------------------------------------
# Finding model
# --------------------------------------------------------------------------

class Finding:
    def __init__(self, rule, severity, message, line, snippet):
        self.rule = rule
        self.severity = severity  # "hard" | "advisory"
        self.message = message
        self.line = line          # 1-based
        self.snippet = snippet.strip()

    def to_dict(self):
        return {
            "rule": self.rule,
            "severity": self.severity,
            "message": self.message,
            "line": self.line,
            "snippet": self.snippet,
        }


def word_count(text):
    return len(re.findall(r"[\w'’\-/.]+", text))


def line_of(offset, text):
    return text.count("\n", 0, offset) + 1


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------

def check_semicolons(text, blocks):
    findings = []
    for idx, line in enumerate(text.splitlines()):
        if in_fenced(idx, blocks):
            continue
        clean = strip_inline_code(line)
        if ";" in clean:
            findings.append(Finding(
                "semicolon", "hard",
                "ASD-STE100 Rule 8.1 does not permit the semicolon. "
                "Write separate sentences.",
                idx + 1, line))
    return findings


def check_sentence_length(text, blocks):
    findings = []
    masked = text.splitlines()
    for a, b in blocks:
        for i in range(a, min(b + 1, len(masked))):
            masked[i] = ""
    joined = "\n".join(masked)
    for s, off in split_sentences(joined):
        limit = max_words_for(s)
        wc = word_count(s)
        if wc > limit:
            findings.append(Finding(
                "sentence-length", "hard",
                f"Sentence has {wc} words (limit {limit}). Split it.",
                line_of(off, joined), s[:160]))
    return findings


def check_phrasal_verbs(text, blocks):
    findings = []
    for idx, line in enumerate(text.splitlines()):
        if in_fenced(idx, blocks):
            continue
        clean = strip_inline_code(line).lower()
        for pv in sorted(PHRASAL_VERBS, key=len, reverse=True):
            pat = r"\b" + re.escape(pv) + r"\b"
            if re.search(pat, clean):
                findings.append(Finding(
                    "phrasal-verb", "hard",
                    f"'{pv}' is a phrasal verb (Rule 9.3). Use one plain verb "
                    f"(for example: start, remove, contact).",
                    idx + 1, line))
    return findings


def check_nominalization(text, blocks):
    findings = []
    for idx, line in enumerate(text.splitlines()):
        if in_fenced(idx, blocks):
            continue
        clean = strip_inline_code(line)
        for pat, why in NOMINALIZATION_PATTERNS:
            m = re.search(pat, clean, re.IGNORECASE)
            if m:
                findings.append(Finding(
                    "nominalization", "hard",
                    f"'{m.group(0)}': {why}. Example: 'perform an analysis' -> "
                    f"'analyze'.",
                    idx + 1, line))
    return findings


def check_marketing(text, blocks):
    findings = []
    for idx, line in enumerate(text.splitlines()):
        if in_fenced(idx, blocks):
            continue
        clean = strip_inline_code(line)
        for adj in sorted(MARKETING_ADJECTIVES, key=len, reverse=True):
            if re.search(r"\b" + re.escape(adj) + r"\b", clean, re.IGNORECASE):
                findings.append(Finding(
                    "marketing-adjective", "hard",
                    f"'{adj}' claims quality instead of showing it. Delete it or "
                    f"give the measurement.",
                    idx + 1, line))
    return findings


def check_noun_clusters(text, blocks):
    """Heuristic for 4+ word noun stacks. Two detectors:
    1. Capitalized-stack: 4+ consecutive words that each start with a capital
       letter and do NOT begin the line ("the High Pressure Fuel Pump inlet...").
    2. Lowercase-stack: 5+ consecutive tokens with no stopper (article,
       preposition, or common verb form) between them.
    Headings are skipped."""
    findings = []
    lines = text.splitlines()
    for idx, line in enumerate(lines):
        if in_fenced(idx, blocks):
            continue
        if line.lstrip().startswith("#"):
            continue
        clean = strip_inline_code(line)
        tokens = re.findall(r"[A-Za-z][\w'-]*", clean)
        if not tokens:
            continue

        best = None

        # Detector 1: mid-line capitalized stack of 4+ words.
        caps_run = []
        for t in tokens:
            if t[0].isupper():
                caps_run.append(t)
            else:
                if len(caps_run) >= 4 and caps_run[0] != tokens[0]:
                    best = list(caps_run)
                    break
                caps_run = []
        if not best and len(caps_run) >= 4 and caps_run[0] != tokens[0]:
            best = list(caps_run)

        # Detector 2: lowercase run of 5+ non-stopper tokens.
        if not best:
            run = []
            for t in tokens:
                if t.lower() in NOUN_CLUSTER_STOPPERS:
                    if len(run) >= 5:
                        best = list(run)
                        break
                    run = []
                else:
                    run.append(t)
            if not best and len(run) >= 5:
                best = list(run)

        if best:
            findings.append(Finding(
                "noun-cluster", "hard",
                f"Noun stack of {len(best)} words: '{' '.join(best)}'. "
                f"Keep clusters to 3 words or rewrite with a preposition.",
                idx + 1, line))
    return findings


def check_dangling_conjunction_lists(text, blocks):
    findings = []
    for idx, line in enumerate(text.splitlines()):
        if in_fenced(idx, blocks):
            continue
        if not LIST_ITEM_RE.match(line):
            continue
        content = LIST_ITEM_RE.sub("", line).strip()
        if DANGLING_CONJ_RE.search(content):
            conj = content.rsplit(" ", 1)[-1].strip(",.")
            findings.append(Finding(
                "dangling-conjunction", "hard",
                f"List item ends with '{conj}'. The reader cannot tell what "
                f"follows. Complete the item or restructure.",
                idx + 1, line))
    return findings


def check_passive(text, blocks):
    findings = []
    for idx, line in enumerate(text.splitlines()):
        if in_fenced(idx, blocks):
            continue
        clean = strip_inline_code(line)
        m = PASSIVE_RE.search(clean)
        if m and not re.search(r"\bby\s+\w", clean[m.end():m.end() + 30]):
            findings.append(Finding(
                "passive-voice", "advisory",
                f"Possible passive voice ('{m.group(0)}'). Name the actor and "
                f"use active voice.",
                idx + 1, line))
    return findings


def check_compound_tense(text, blocks):
    findings = []
    for idx, line in enumerate(text.splitlines()):
        if in_fenced(idx, blocks):
            continue
        clean = strip_inline_code(line)
        m = COMPOUND_TENSE_RE.search(clean)
        if m:
            findings.append(Finding(
                "compound-tense", "advisory",
                f"Compound tense '{m.group(0)}'. STE prefers simple past unless "
                f"current relevance matters — then keep it deliberately.",
                idx + 1, line))
    return findings


ALL_CHECKS = [
    ("semicolon", check_semicolons),
    ("sentence-length", check_sentence_length),
    ("phrasal-verb", check_phrasal_verbs),
    ("nominalization", check_nominalization),
    ("marketing-adjective", check_marketing),
    ("noun-cluster", check_noun_clusters),
    ("dangling-conjunction", check_dangling_conjunction_lists),
    ("passive-voice", check_passive),
    ("compound-tense", check_compound_tense),
]

RULE_ALIASES = {
    "semicolons": "semicolon",
    "sentence-lengths": "sentence-length",
    "length": "sentence-length",
    "phrasal-verbs": "phrasal-verb",
    "phrasal": "phrasal-verb",
    "marketing": "marketing-adjective",
    "marketing-adjectives": "marketing-adjective",
    "noun-clusters": "noun-cluster",
    "noun-stack": "noun-cluster",
    "dangling-conjunctions": "dangling-conjunction",
    "list-items": "dangling-conjunction",
    "passive": "passive-voice",
    "compound-tenses": "compound-tense",
    "tense": "compound-tense",
    "nominalizations": "nominalization",
}


def lint(text, disabled=frozenset()):
    blocks = find_fenced_blocks(text)
    findings = []
    for name, fn in ALL_CHECKS:
        if name in disabled:
            continue
        findings.extend(fn(text, blocks))
    findings.sort(key=lambda f: (f.line, f.rule))
    return findings


# --------------------------------------------------------------------------
# Self test — includes the required guarantee: modality is never flagged
# --------------------------------------------------------------------------

def selftest():
    cases = []

    def expect(rule, text, should=True):
        f = lint(text)
        hit = any(x.rule == rule for x in f)
        cases.append((f"{rule} {'detected' if should else 'absent'}",
                      hit == should, text[:60].replace("\n", "\\n")))

    # hard rules fire
    expect("semicolon", "Run the job; then check the log.")
    expect("phrasal-verb", "Please spin up the container.")
    expect("marketing-adjective", "We offer a seamless experience.")
    expect("nominalization", "The system performs an analysis of the logs.")
    expect("dangling-conjunction", "- Set the target and\n")
    expect("sentence-length",
           "The team installed the client, configured the token store, wired the "
           "retry policy, added metrics, updated the docs, ran the suite twice, "
           "and shipped the release to production last Friday afternoon.")
    # fenced code is ignored
    f = lint("~~~text\nThis line ends with and\nsee also; nothing `a ; b`\n~~~\n")
    cases.append(("fenced block ignored", len(f) == 0, "fence"))
    # advisory never fails but is reported
    f = lint("The file was deleted during cleanup.")
    cases.append(("passive detected as advisory",
                  any(x.rule == "passive-voice" and x.severity == "advisory"
                      for x in f), "passive"))
    # THE KEY GUARANTEE: modality / hedges must pass clean
    f = lint("The request may have failed.")
    hard = [x for x in f if x.severity == "hard"]
    cases.append(("hedge 'may have failed' passes clean", len(hard) == 0,
                  "modality"))
    f = lint("The job has completed.")
    hard = [x for x in f if x.severity == "hard"]
    cases.append(("compound tense is advisory only", len(hard) == 0, "tense"))

    ok = True
    for name, passed, note in cases:
        print(f"[{'PASS' if passed else 'FAIL'}] {name}  ({note})")
        ok = ok and passed
    return 0 if ok else 1


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def main(argv=None):
    parser = argparse.ArgumentParser(description="ASD-STE100 structural linter")
    parser.add_argument("files", nargs="*", help="files to lint (default: stdin)")
    parser.add_argument("--json", action="store_true", dest="as_json")
    parser.add_argument("--baseline", type=int, default=0,
                        help="number of hard violations to tolerate")
    parser.add_argument("--disable", default="",
                        help="comma-separated rule names to silence")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args(argv)

    if args.selftest:
        sys.exit(selftest())

    disabled = set()
    for d in filter(None, re.split(r"[,\s]+", args.disable)):
        disabled.add(RULE_ALIASES.get(d, d))

    texts = {}
    if args.files:
        for path in args.files:
            try:
                with open(path, encoding="utf-8") as fh:
                    texts[path] = fh.read()
            except OSError as e:
                print(f"error: cannot read {path}: {e}", file=sys.stderr)
                sys.exit(2)
    else:
        texts["<stdin>"] = sys.stdin.read()

    total_hard = 0
    report = {}
    for path, text in texts.items():
        findings = lint(text, frozenset(disabled))
        hard = [f for f in findings if f.severity == "hard"]
        adv = [f for f in findings if f.severity == "advisory"]
        total_hard += len(hard)
        report[path] = {
            "hard_violations": [f.to_dict() for f in hard],
            "advisory": [f.to_dict() for f in adv],
        }

    if args.as_json:
        print(json.dumps(report, indent=2))
    else:
        for path, r in report.items():
            for f in r["hard_violations"]:
                print(f"{path}:{f['line']}: [{f['rule']}] {f['message']}")
            for f in r["advisory"]:
                print(f"{path}:{f['line']}: [{f['rule']} (advisory)] {f['message']}")

    allowed = max(total_hard - args.baseline, 0)
    if allowed > 0:
        print(f"\n{allowed} hard violation(s) found. Baseline tolerated: "
              f"{args.baseline}. Exit 1.", file=sys.stderr)
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
