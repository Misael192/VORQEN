# Fase 0 — Fundação mínima

## Plano da fase
- Criar o monorepo base com apps API e web.
- Preparar PostgreSQL e Prisma com as 8 tabelas principais.
- Validar ambientes e expor health check do banco.
- Registrar decisões de arquitetura e pendências iniciais.

## Implementado
- Scaffold inicial do monorepo VORQEN com API NestJS e web Next.js.
- Compose do PostgreSQL 16 com health check e volume persistente.
- Prisma schema com as 8 tabelas do MVP.
- Validação de ambiente Zod no backend e health endpoint.
- Documentação de arquitetura e progresso inicial.

## Arquivos-chave
- package.json — workspace root e scripts de desenvolvimento
- docker-compose.yml — serviço PostgreSQL 16
- prisma/schema.prisma — modelo de dados inicial
- apps/api/src/config/env.ts — validação de variáveis de ambiente
- apps/api/src/health/health.controller.ts — health endpoint
- docs/architecture/001-phase0-decisions.md — ADR da fase

## Banco de dados
- Migrações criadas: nenhuma ainda; schema pronto para `prisma migrate`
- Comando para aplicar: `pnpm prisma:migrate -- --name init`

## Verificação executada
- Não foi possível rodar os comandos de verificação neste ambiente porque o terminal/execução de Docker não está disponível na sessão atual.
- Os comandos esperados para execução local são:
  - `docker compose up -d`
  - `docker compose ps`
  - `pnpm install`
  - `pnpm prisma:generate`
  - `pnpm prisma:migrate -- --name init`
  - `pnpm dev:api`
  - `curl -i http://localhost:4000/api/v1/health`

## Como executar
```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm prisma:generate
pnpm prisma:migrate -- --name init
pnpm dev:api
```

## Configuração necessária
- Variáveis de ambiente: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`
- Serviços externos: PostgreSQL 16 em Docker

## Limitações e pendências
- Verificação real de health check e migração depende de ambiente local com Docker e pnpm disponíveis.
- A fase está implementada, mas não pode ser declarada concluída sem execução real dos comandos de validação.

## ADRs criados/atualizados
- `docs/architecture/001-phase0-decisions.md`

## Próxima fase
Aguardando autorização para iniciar a Fase 1.
