# VORQEN AI Studio — RECON (Fase 1)

Data: 2026-10-31. Alvo: o próprio produto VORQEN (projeto próprio, sem clone externo).
Método: auditoria das 9 refs do repo https://github.com/Misael192/VORQEN em clone limpo (`~/vorqen-diag/vorqen`), builds/testes executados neste host. Evidência literal completa em `docs/DIAGNOSTIC-VALIDATED.md`, `docs/BRANCH-AUDIT.md`, `docs/DB-AUDIT.md` e `docs/GAPS.md`.

## Estado atual por branch (resumo verificado)

| Branch | Build | Testes | Conteúdo relevante |
|---|---|---|---|
| main (= feat/fase-1-ai-core) | web FALHA (postcss.config.js), api OK só após `prisma generate` | nenhuma suíte roda | esqueleto monorepo, OllamaProvider inicial, schema sem migrations |
| ci/cd-authentication-audit-5d2e3 | api+web OK (após generate; CI cobre) | 9/9 passando (5 jest + 4 vitest) | JWT auth, CRUD projects/files/chat, IDEWorkspace (textarea), ChatPanel (Ollama browser), ci.yml, 8 models + 2 migrations |
| vorqen-editor-mvp-d03f4 | FALHA (5 erros TS api; lockfile dessincronizado) | falha (TS2349 supertest) | seed prisma, e2e supertest quebrado; apaga OllamaProvider (−132 linhas); WebContainer NÃO existe (refutado) |
| vorqen-mvp-architecture-56c9d | ai-core+api OK, web FALHA (postcss) | nada roda | AIConfigForm (duplicado), codegen.ts, build script no ai-core, schema divergente 6 models |
| ai-platform-similar-to-lovable-c458b | — | — | já é ancestral da main (confirmado via merge-base) |
| vorqen-studio-identity-d0476 | não inspecionada em detalhe | — | 3 task snapshots; registrada para honestidade |
| /workspace/packages/ai-core (protótipo local, fora do GitHub) | OK (tsc exit 0) | 25/25 vitest | interface AIProvider multimodelo: OpenAI-compatible, Anthropic, Ollama, custom; SSE parser; retry/backoff; healthCheck 2s |

## Telas/fluxos existentes vs alvo

Fluxo central hoje (branch ci/cd): register → login → criar projeto → abrir IDEWorkspace → chat com Ollama local → arquivos salvos via API (ProjectFile) → versão (ProjectVersion).
Estados por tela: vazio/loading/erro ainda não cobertos de forma sistemática. Mobile 390px não comprovado.

## Modelo de dados inferido (schema canônico ci/cd, confidence alta — lido direto do arquivo)
User, Session, Project, AiConnection, EncryptedCredential, ProjectFile, ChatMessage, ProjectVersion.

## Riscos e lacunas
- Chat fala com provider direto do navegador (sem backend de IA, sem BYOK seguro).
- Editor é textarea; sem Monaco; sem diff UI.
- Sem preview/sandbox real; WebContainer ausente em todo o repo.
- Sem ferramentas de agente; sem PLAN/CHAT/BUILD.
- Sem GitHub OAuth; sem Stripe; sem Playwright/axe.
- Skills Replica pack (`replica-skill-main/`) não fornecido no ambiente.
- Postgres/Ollama/Docker indisponíveis neste host (portas fechadas; docker not found).
