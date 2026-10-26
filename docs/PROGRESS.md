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


---

# Fase 1 — Banco de Dados (Prisma Schema)

## Plano da fase
- Modelar as 6 tabelas essenciais do MVP: User, Project, ChatMessage, ProjectFile, ProjectSnapshot e AiModelConfig.
- Convenções: IDs `cuid()`, `createdAt`/`updatedAt` padrão, cascatas `onDelete: Cascade`.
- Relacionamentos: Project→User; ChatMessage/ProjectFile/ProjectSnapshot→Project; AiModelConfig→User (1:1 no MVP).

## Implementado
- `prisma/schema.prisma` reescrito com o modelo de dados da Fase 1 (substitui o esboço da Fase 0).
- Enums `ChatRole` (USER/ASSISTANT/SYSTEM) e `AiProvider` (OPENAI/ANTHROPIC/OLLAMA/CUSTOM).
- Índices: `projects(ownerId)`, `chat_messages(projectId, createdAt)`, `project_files(projectId)`, unique `(projectId, path)` em arquivos, unique `userId` em AiModelConfig.
- Versionamento: `ProjectSnapshot` ↔ `ProjectFile` via relação N:N (`_ProjectFileToProjectSnapshot`), permitindo rollback/previews por snapshot.
- Segurança: `apiTokenArmored` em AiModelConfig guarda token cifrado em repouso (AES-256-GCM + envelope); chave mestra fica fora do banco (KMS/env).

## Verificação executada
- `prisma validate` → schema válido ✅ (Prisma CLI 6.19.0)
- `prisma format` → formatado sem erros ✅
- `prisma migrate diff --from-empty --to-schema-datamodel --script` → SQL gerado corretamente com 6 tabelas + 1 junction table, 2 enums e todos os índices/uniques ✅

## Não verificado (requer Docker/Postgres local)
- `docker compose up -d`
- `pnpm prisma:migrate -- --name init` (aplicação real da migração)
- `psql \dt` para confirmar as tabelas no banco

## Como executar a migração
```bash
cp .env.example .env          # garante DATABASE_URL
docker compose up -d          # sobe PostgreSQL 16 (vorqen-postgres)
pnpm install                  # instala dependências do workspace
pnpm prisma:generate          # gera o Prisma Client (apps/api)
pnpm prisma:migrate           # prisma migrate dev --name init (aplica a migração)
docker compose exec postgres psql -U plataforma -d plataforma -c "\dt"  # confere as 7 tabelas
```

## Próxima fase
Fase 2 — Módulo de IA no NestJS (Controller + SSE streaming + parser de blocos de código estruturados).
