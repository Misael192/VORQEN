# ADR-0101 — Monorepo e stack

Data: 2026-10-31 · Status: ACEITO (preservação; decisão do prompt mestre §4 "preserve as tecnologias do scaffold")

## Contexto
Evidência lida hoje: `pnpm-workspace.yaml` = `packages: ["apps/*", "packages/*"]`; root `package.json` com `packageManager: pnpm@9.15.0`, script `prisma:generate/migrate/lint`; `apps/api` NestJS 10 + Prisma 6.19.3 + Zod 3 + class-validator; `apps/web` Next 15.0.3 + React 19 + Tailwind 3.4; PostgreSQL 16 via `docker-compose.yml:5` (`image: postgres:16-alpine`).

## Decisão
Preservar integralmente: pnpm workspaces, Next.js App Router, NestJS, PostgreSQL 16, Prisma, Zod, Tailwind. Não trocar nenhuma tecnologia nesta fase.

## Consequências
- Zero risco de regressão por troca de stack (R3/R6).
- Inconsistência documentada: root `package.json` usa campo `workspaces` (npm-style) além do `pnpm-workspace.yaml` — redundante mas inofensivo; limpeza opcional na Fase 2.
- Nota: o prompt mestre pede validação com Zod "para contratos compartilhados"; hoje Zod está só no api. Mover schemas para `packages/shared` é evolução da Fase 2+, não troca de stack.

## Alternativas rejeitadas
Reescrever em outro framework/bundler: violaria R3 (preservação) sem evidência de necessidade.
