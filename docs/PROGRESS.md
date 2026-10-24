# Fase 0 — Fundação mínima

## Plano da fase
- Criar o monorepo base com apps API e web.
- Preparar PostgreSQL e Prisma com as 6 tabelas principais da Fase 0.
- Validar ambientes e expor health check do banco.
- Registrar decisões de arquitetura e pendências iniciais.

## Implementado
- Scaffold inicial do monorepo VORQEN com API NestJS e web Next.js.
- Compose do PostgreSQL 16 com health check e volume persistente.
- Prisma schema com as 6 tabelas do MVP da Fase 0.
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
- Nenhuma verificação real foi executada nesta sessão porque o ambiente de terminal/Docker necessário não estava acessível.
- A fase foi corrigida para ficar alinhada ao escopo do prompt mestre, mas permanece "implementada, não verificada".

## Não verificado
- `docker compose up -d`
- `docker compose ps`
- `pnpm install`
- `pnpm prisma:generate`
- `pnpm prisma:migrate -- --name init`
- `docker compose exec postgres psql -U plataforma -d plataforma -c "\dt"`
- `pnpm dev:api`
- `curl -i http://localhost:4000/api/v1/health`
- `docker compose stop postgres`
- `time curl -i http://localhost:4000/api/v1/health`
- `docker compose start postgres`
- `pnpm audit --prod`

## Como executar
```bash
cp .env.example .env
docker compose up -d
docker compose ps
pnpm install
pnpm prisma:generate
pnpm prisma:migrate -- --name init
docker compose exec postgres psql -U plataforma -d plataforma -c "\dt"
pnpm dev:api
curl -i http://localhost:4000/api/v1/health
docker compose stop postgres
time curl -i http://localhost:4000/api/v1/health
docker compose start postgres
pnpm audit --prod
```

## Configuração necessária
- Variáveis de ambiente: `DATABASE_URL`, `PORT`, `NODE_ENV`
- Serviços externos: PostgreSQL 16 em Docker

## Limitações e pendências
- Verificação real de health check, migração e bootstrap depende de terminal local com Docker e pnpm disponíveis.
- A fase foi ajustada ao escopo da Fase 0, mas o estado exato continua sendo "implementada, não verificada" até execução real do fluxo acima.

## ADRs criados/atualizados
- `docs/architecture/001-phase0-decisions.md`

## Próxima fase
Aguardando autorização para iniciar a Fase 1 após validação local real da Fase 0.
