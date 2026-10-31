# ADR-0001 — Branch base de trabalho: ci/cd-authentication-audit-5d2e3

Data: 2026-10-31 · Status: PROPOSTO (aguarda autorização do proprietário para virar branch ativa)

## Decisão
A base do VORQEN AI Studio será a branch `origin/ci/cd-authentication-audit-5d2e3` (commit 6440cbd), renomeada em nova branch local `base/studio`. Merges inteiros das demais branches ficam proibidos.

## Justificativa (evidência executada nesta sessão)
- Única branch com `pnpm -r run build` verde (api+web, após `prisma generate`, coberto pelo ci.yml) e testes passando: 9/9 (5 jest projects + 4 vitest ollama).
- Contém auth JWT, CRUD projects/files/chat, IDEWorkspace, schema 8 models + 2 migrations, CI yml.
- main e arch têm web quebrado por `postcss.config.js` (`Error: Your custom PostCSS configuration must export a \`plugins\` key.`); o postcss da ci/cd está correto (`module.exports = { plugins: {...} }`, verificado literalmente no clone).
- editor-mvp não compila (5 erros TS), lockfile dessincronizado e apaga OllamaProvider (diff: −132 linhas).

## Imports seletivos permitidos
- De `vorqen-mvp-architecture-56c9d`: script de build do ai-core (`tsc -p tsconfig.build.json`), `codegen.ts`, `AIConfigForm.tsx` (deduplicando as 2 cópias). Nunca o schema de 6 models.
- De `vorqen-editor-mvp-d03f4`: `prisma/seed/` apenas. O e2e supertest só após corrigir TS2349.
- Do protótipo local `/workspace/packages/ai-core`: camada multimodelo completa (verificada: tsc exit 0, 25/25 vitest reexecutado nesta sessão).

## Reversão
Branch local; nenhuma força/destruição de branches remotas.
