# Before / After Examples

Worked rewrites. Each example names the rules it exercises. "Official" marks examples adapted from the ASD-STE100 standard's own illustrations; the rest were built for agent-output use cases.

---

## 1. Error message (Strict mode)

**Before:**
> It has come to our attention that the connection to the local model server could potentially have failed, possibly due to the CORS policy not having been configured correctly by the user.

**After:**
> The connection to the local model server may have failed. A CORS misconfiguration is one possible cause. Check that OLLAMA_ORIGINS="*" is set on the server.

Rules applied: hedge stacking removed, passive voice removed ("not having been configured ... by the user"), semicolon-free short sentences, one instruction per sentence at the end. Modality kept: "may have failed" — the source hedged, so the rewrite hedges.

---

## 2. Tool description (Strict mode)

**Before:**
> This tool leverages a robust, seamless pipeline to carry out the analysis of user input and it will subsequently kick off the generation of files, after which errors should be handled gracefully.

**After:**
> This tool parses user input. It creates files from the parsed result. If a step fails, the tool returns an error message with the failing step name.

Rules applied: marketing adjectives deleted (robust, seamless), nominalization removed ("carry out the analysis of" → "parses"), phrasal verbs removed ("kick off" → starts/creates), run-on sentence split, passive removed ("errors should be handled" → names the actor: the tool).

---

## 3. Inter-agent instruction (Strict mode)

**Before:**
> Close the valve.

**After:** unchanged — but note the ambiguity this illustrates.

"Close the valve" is fine as an imperative. But "close the valve" read with stress on "close" (/kloʊs/, adjective) is not a command at all. STE resolves this by part-of-speech discipline: approved words carry one meaning and one part of speech, and instructions always start with the verb. For agents, the same trap exists: a status string like "the file is ready to send" can be read as an instruction or a description. Fix: separate channels. Put instructions in a field named `action`, put state in a field named `status`. Prose position alone should never carry the instruction/description distinction.

---

## 4. Status report (Strict mode, tense exception exercised)

**Before:**
> We have received your request and the job has completed; output is now available for retrieval by authorized users.

**After:**
> The system received your request. The job has completed. Authorized users can retrieve the output now.

Rules applied: semicolon split into sentences, passive removed ("is available for retrieval by" → "users can retrieve"). **Deliberate departure:** "has completed" stays present perfect because the completion has current relevance — the output is available *now*. Simple past ("completed") would state only when it ended, not that the result stands. Per the skill's tense exception, the departure is flagged here rather than silently introduced.

---

## 5. README paragraph (STE-flavored mode)

**Before:**
> Our platform provides a cutting-edge, AI-powered experience that allows developers to effortlessly spin up full-stack applications from natural language descriptions, leveraging state-of-the-art code generation models while maintaining utilization of existing project structures for seamless integration.

**After:**
> VORQEN turns a natural-language description into a full-stack application. It generates new files and keeps the structure of an existing project. You run the AI model yourself — locally or with your own API key.

Rules applied (structural, enforced even in flavored mode): marketing adjectives deleted (cutting-edge, state-of-the-art, seamless, effortlessly), nominalization removed ("maintaining utilization of" → "keeps"), phrasal verb removed ("spin up" → the concrete act: turns/generates), 47-word sentence split into three under 25 words, active voice throughout. Lexical rules treated as advisory: word choice is plain but not dictionary-locked.

---

## 6. System prompt fragment (Strict mode, modality preserved)

**Before:**
> When the operation appears to possibly not have succeeded for reasons that may be unknown, it is important that consideration be given to retrying the request once before failure is reported.

**After:**
> If the operation may have failed for an unknown reason, retry the request once. Report the failure only if the retry also fails.

Rules applied: hedge stacking untangled — but the surviving hedge "may have failed" is kept verbatim in strength. The source did not assert failure, so neither does the rewrite. Passive subjunctive ("consideration be given to retrying") replaced with a direct imperative. One instruction per sentence.

---

## 7. Dangling list items (Strict mode)

**Before:**
> - Set the target and
> - Record the result or

**After:**
> - Set the target. Then record the result.
> - If the check fails, stop. Otherwise, continue to step 4.

Rules applied: a list item must stand alone. An item that ends in "and" or "or" forces the reader to guess what follows. The linter flags these (`dangling-conjunction`).

---

## Glossary entries this skill would suggest (domain terms that must stay)

- **WebContainer** — browser-based container that runs Node.js projects in the page.
- **Ollama** — local HTTP server that runs LLMs on the user's machine at port 11434.
- **SSE (Server-Sent Events)** — HTTP mechanism that streams tokens from a server to a browser one at a time.
