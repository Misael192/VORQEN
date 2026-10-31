# ADR-0103 — Estrutura de pastas

Data: 2026-10-31 · Status: ACEITO com ajuste (confirmar existente; NÃO recriar do zero)

## Estado verificado hoje (main e ci/cd)
```
apps/api/src/{auth,projects,prisma,config}      # NestJS, controllers+services+DTOs
apps/web/app/...                                # App Router (páginas)
apps/web/src/{components,lib}                   # componentes + api-client + ai/OllamaProvider
packages/ai-core/src/providers/                 # OllamaProvider (+spec na ci/cd)
prisma/{schema.prisma,migrations/}              # schema canônico único na raiz
docker-compose.yml, .github/workflows/ci.yml    # infra local + CI
scripts/fix-prisma-client.cjs                   # helper pós-generate
```

## Decisão
Confirmar a estrutura existente como base. Não criar `apps/web/src` vs `app` duplicado nem mover páginas agora. Evoluções planejadas (Fases 2–7, cada uma com diff pequeno):
1. `packages/shared` (Zod de contratos web+api) — criar só quando houver o primeiro contrato duplicado real.
2. `packages/agent-core` — criado na Fase 7 (agente), não antes.
3. `packages/replica-tools` — wrapper backend das skills, Fase correspondente às Replica Skills.
4. Prisma permanece **um único schema** em `prisma/` (evitar `packages/db` duplicado por ora; se nascer, precisa ADR próprio).
5. `docs/ADR/`, `docs/STATUS.md`, `replica/` já existem neste layout — manter.

## Alternativa rejeitada
Reorganizar tudo para o layout de referência do prompt mestre de uma vez: criaria churn sem ganho funcional e violaria R3 (preservação). O layout de referência é "adaptar ao repositório existente", conforme §4 do próprio prompt mestre.
