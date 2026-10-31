# VORQEN AI Studio — TESTING

Atualizado: 2026-10-31. Como executar e interpretar testes no estado real do projeto.

## O que roda hoje neste host (comandos executados e resultados literais)

### Protótipo `packages/ai-core` (workspace local, fora do GitHub)
```bash
cd packages/ai-core
pnpm install --frozen-lockfile   # "Done in 1.7s"
pnpm run build                    # tsc -p tsconfig.json, exit 0
pnpm test                         # vitest: Test Files 5 passed (5); Tests 25 passed (25)
```
Cobertura dos 25 testes: parsing SSE fragmentado/CRLF; corpos/headers dos protocolos OpenAI-compatible, Anthropic e Ollama; stream com tool_call incremental; NDJSON Ollama; mapeamento 429→rate_limit com retry; recusa de vision sem capability; healthCheck <2,5s em porta morta; registry BLOCKED sem chave no env sem vazar valor; schema Zod recusando apiKey crua.

### Branch `ci/cd-authentication-audit-5d2e3` (clone limpo `~/vorqen-diag/vorqen`)
```bash
pnpm install && npx prisma generate
pnpm -r run build                  # api+web OK
pnpm -r run test                   # 9/9: 5 jest (auth/projects) + 4 vitest (ollama)
```

## O que NÃO roda neste host (motivo literal)
- `prisma migrate` / testes contra Postgres: porta 5432 fechada, `docker: command not found`. Desbloqueio: `DATABASE_URL` de Postgres acessível ou instalar Docker.
- Chamadas reais a providers: Ollama down (porta 11434 fechada); sem `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` no env. Nunca simular.
- Playwright/axe: não instalados no repo (zero configs encontradas por `find`). Entram na Fase 12 como dependências novas (gate R3).
- E2E supertest da branch editor-mvp: falha TS2349 documentada em DIAGNOSTIC-VALIDATED.md; corrigir antes de adotar.

## Severidade usada nos relatórios
S1 segurança/perda de dados/fluxo essencial bloqueado · S2 função central quebrada sem workaround · S3 com workaround · S4 cosmético. Gates exigem zero S1/S2.

## Matriz de testes obrigatória ao longo das fases
unit (services/adaptadores) → integração (API+DB, isolamento 2 usuários) → e2e (register→login→criar projeto→chat→editar→salvar→preview) → a11y (axe) → responsivo (390px/1440px) → audit de dependências (`pnpm audit`).
