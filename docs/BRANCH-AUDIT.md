# VORQEN — BRANCH AUDIT (Fase 1, entregável B)

Data: 2026-10-31
Clone auditado: `~/vorqen-diag/vorqen` (repo público https://github.com/Misael192/VORQEN, sem auth)
Builds/testes desta seção foram executados neste host. Saídas literais preservadas.

## git status --short --branch (estado final, devolvido à main)

```
## main...origin/main
```
(working tree limpo; durante a auditoria foram feitos checkouts temporários por branch e reversão com `git checkout -q main` + `git checkout -q -- pnpm-lock.yaml` quando o install alterou o lockfile)

## git branch -a (saída literal)

```
* main
  remotes/origin/HEAD -> origin/main
  remotes/origin/ai-platform-similar-to-lovable-c458b
  remotes/origin/ci/cd-authentication-audit-5d2e3
  remotes/origin/feat/fase-1-ai-core
  remotes/origin/main
  remotes/origin/misael192-issue-fix
  remotes/origin/vorqen-editor-mvp-d03f4
  remotes/origin/vorqen-mvp-architecture-56c9d
  remotes/origin/vorqen-studio-identity-d0476
```

9 refs no total (main + 8). Duas fora do roteiro original: `misael192-issue-fix` e `vorqen-studio-identity-d0476`.

## git log --oneline -3 por branch (saída literal)

```
=== main ===
944e1ba (HEAD -> main, origin/main, origin/feat/fase-1-ai-core, origin/HEAD) feat(ai-core): adicionar pacote reutilizável Ollama
9ff7e0a feat(ai-core): fase 1 - recon, arquitetura, tokens e OllamaProvider
8a33be9 (origin/ai-platform-similar-to-lovable-c458b) Initialize project database schema and configure monorepo dependencies

=== feat/fase-1-ai-core ===
(mesmo HEAD da main: 944e1ba — branches idênticas)

=== ai-platform-similar-to-lovable-c458b ===
8a33be9 Initialize project database schema and configure monorepo dependencies
4f7f560 Initialize monorepo structure with NestJS API and Next.js Web app dependencies ...
060e033 fix: align phase 0 with prompt master constraints and remove early-future tables/secret

=== ci/cd-authentication-audit-5d2e3 ===
6440cbd feat: implement JWT auth, CI/CD pipeline, and core project services
944e1ba feat(ai-core): adicionar pacote reutilizável Ollama   <- pai = main
9ff7e0a feat(ai-core): fase 1 - recon, arquitetura, tokens e OllamaProvider

=== vorqen-editor-mvp-d03f4 ===
d5f81d2 VORQEN MVP: Auth, Projects CRUD, JWT integration, WebContainer IDE, and E2E tests
944e1ba feat(ai-core): adicionar pacote reutilizável Ollama   <- pai = main
9ff7e0a feat(ai-core): fase 1 ...

=== vorqen-mvp-architecture-56c9d ===
93c68ad chore(web): AIConfigForm + settings page em src/, skill asd-ste100 em docs/, ste-lint em scripts/
need4dc6 chore(skills): drop __pycache__ from commit, ignore pyc in gitignore
ef1f454 feat(skills): implement asd-ste100 skill v0.4.0 (SKILL.md, references, examples, ste-lint.py)

=== vorqen-studio-identity-d0476 ===
62c3f07 task snapshot b3e5ad42-513b-49ea-9e65-5e7ac8a65d85
fd3ad30 task snapshot 61cc3d26-55a5-475b-971d-95944d036828
9f26368 task snapshot 8694beda-2531-4fe0-8f25-14d314c64c56

=== misael192-issue-fix ===
b925f1e fix: repair workspace builds and document branch audit
944e1ba feat(ai-core): adicionar pacote reutilizável Ollama   <- pai = main
9ff7e0a feat(ai-core): fase 1 ...
```

## Tabela comparativa

| Branch | Build passa? | Testes passam? | Arquivos-chave presentes | O que tem que main não tem |
|---|---|---|---|---|
| `main` (944e1ba) | **PARCIAL** — api Done; **web Failed** (`Your custom PostCSS configuration must export a 'plugins' key.`); ai-core sem script build | N/A — `pnpm -r run test` → `Scope: 3 of 4 workspace projects`, zero specs na main | `prisma/schema.prisma` (6 models), `docker-compose.yml`, `packages/ai-core/src/providers/OllamaProvider.ts` | — (base) |
| `feat/fase-1-ai-core` | igual main (mesmo SHA) | igual main | igual main | nada (idêntica à main) |
| `ai-platform-similar-to-lovable-c458b` | não testado isoladamente (é ancestral da main: 8a33be9 está contido em main) | — | schema inicial | nada além do histórico já na main |
| `ci/cd-authentication-audit-5d2e3` | **SIM** — saída literal: `packages/ai-core build: Done` / `apps/api build: Done` / `apps/web build: Done` | **SIM** — `ai-core: Tests 4 passed (4)` + `api: Test Suites: 1 passed / Tests: 5 passed` (9/9) | auth Nest completa (`auth.controller/service`, `jwt.strategy`, guards), `projects.*`, `IDEWorkspace.tsx` (textarea), `ChatPanel.tsx` (streaming client-side via `provider.streamChat` + `getReader`), `.github/workflows/ci.yml`, `postcss.config.js` correto, schema **8 models**, `OllamaProvider.ts` (usa SDK `Ollama`, host 11434), migrations init+phase4 | JWT auth + CRUD projetos + ProjectFile + ChatMessage + save-files/chat DTOs + CI yml + testes jest/vitest + postcss corrigido + build script ai-core |
| `vorqen-editor-mvp-d03f4` | **NÃO** — `apps/api build: Failed` / `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL api@1.0.0 build: nest build` (erros TS, incluindo `TS2339 useBodyParser`, `TS2559`, `MaxLength` ausente, implicit any) | NÃO roda (build quebra antes) | commit diz "WebContainer IDE" mas `git grep -il webcontainer` → **vazio**; sem Monaco; sem playwright config; **apaga** `packages/ai-core/src/providers/OllamaProvider.ts` (diff vs main: `1 file changed, 132 deletions(-)`) | seed?, rota `/editor/[id]` órfã; NÃO entrega o que o nome promete |
| `vorqen-mvp-architecture-56c9d` | **PARCIAL** — `packages/ai-core build: Done`, `apps/api build: Done`, `apps/web build: Failed` (postcss quebrado também) | não executado (web falha no gate de build) | `AIConfigForm.tsx` em DOIS caminhos duplicados (`components/settings/` e `src/components/`), skills python `asd-ste100` + `ste-lint.py`, build script no ai-core | codegen/config form/skills; schema ainda 6 models |
| `vorqen-studio-identity-d0476` | N/A — doc-only (sem apps/, sem prisma: `git show :prisma/schema.prisma` → erro; `grep '^model '` = 0) | N/A | cópia dos docs/ADRs produzidos em sessões anteriores + protótipo ai-core multimodelo | nada de código de produto |
| `misael192-issue-fix` | não executado nesta sessão; diff vs main = 4 arquivos (+159/−6) | — | `apps/web/postcss.config.js` corrigido (`module.exports = { plugins: { tailwindcss: {} } }`), ajuste em package.json, `docs/DIAGNOSTIC-BRANCHES.md` | hotfix mínimo do postcss da main + diagnóstico |

## Recomendação de base (SEM merge/cherry-pick — aguardando decisão do usuário)

**Base recomendada: `origin/ci/cd-authentication-audit-5d2e3` (6440cbd).**

Justificativa com evidência:
1. Única branch com `pnpm -r run build` inteiro verde (api+web+ai-core "Done") e testes passando (9/9) executados neste host hoje.
2. Contém exatamente o núcleo da Fase 2–6 do plano mestre: auth JWT, CRUD projetos, persistência de arquivos e chat, CI yml, schema 8 models compatível com BYOK futuro (`AiConnection` + `EncryptedCredential`).
3. Não destrói trabalho: preserva `OllamaProvider.ts` (ao contrário de editor-mvp, que o apaga −132 linhas).
4. Complementos a avaliar pelo usuário (não aplicados):
   - `misael192-issue-fix`: hotfix postcss para a main (relevante só se a base escolhida for main).
   - `vorqen-mvp-architecture`: `AIConfigForm` (deduplicar as 2 cópias) e skills `asd-ste100`/`ste-lint.py`.
   - Protótipo ai-core multimodelo (OpenAI-compatível/Anthropic/registry, 25 testes) existe em `/workspace/packages/ai-core` e nas snapshots `vorqen-studio-identity-d0476` — portável para qualquer base escolhida.

**Aguardando decisão do usuário antes de qualquer operação de branch.**
