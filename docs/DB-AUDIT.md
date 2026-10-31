# VORQEN — DB AUDIT (Fase 1, entregável C)

Data: 2026-10-31. Nenhum valor de `.env` reproduzido aqui além do que já está publicado no `.env.example` versionado (que contém uma connection string de exemplo local — ver GAPS).

## Schema Prisma da `main` (944e1ba) — colado inteiro

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  passwordHash String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  sessions     Session[]
  projects     Project[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  userAgent String?
  ipAddress String?
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Project {
  id          String          @id @default(cuid())
  ownerId     String
  name        String
  description String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  owner    User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  versions ProjectVersion[]
}

model AiConnection {
  id          String   @id @default(cuid())
  userId      String
  name        String
  providerType String
  protocol    String
  baseUrl     String?
  modelName   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  credential EncryptedCredential?
}

model EncryptedCredential {
  id          String   @id @default(cuid())
  connectionId String  @unique
  keyVersion  String
  algorithm   String   @default("AES-256-GCM")
  iv          String
  ciphertext  String
  authTag     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  connection AiConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
}

model ProjectVersion {
  id           String   @id @default(cuid())
  projectId    String
  snapshotJson Json
  createdAt    DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

Migrations na main: `prisma/migrations/20261025175706_init` + `migration_lock.toml` (1 migration).

## Contagem real vs README

- `grep -c '^model ' prisma/schema.prisma` → **6**. README (`README.md:8`): "Prisma schema with the initial six MVP tables". **CONFIRMADO** na main.
- Na base recomendada `ci/cd-authentication-audit-5d2e3`: **8 models** (+ProjectFile, +ChatMessage; migração extra `20261026000000_phase4_projects_files_chat`). O README da main não cobre essas duas — classificado como DRIFT por branch.

## Tabela por entidade (main)

| Tabela | Colunas | Relações | Índices/uniques | Status |
|---|---|---|---|---|
| User | id, email, passwordHash, createdAt, updatedAt | 1:N Session, 1:N Project | `@unique(email)` | OK |
| Session | id, userId, tokenHash, userAgent?, ipAddress?, expiresAt, timestamps | N:1 User (Cascade) | `@unique(tokenHash)` | **UNDOCUMENTED** — nenhuma query `session` no código da main; sem serviço de sessão em nenhuma branch testada (auth ci/cd usa JWT stateless; `grep session auth.service.ts` = 0). Órfã por design futuro. |
| Project | id, ownerId, name, description?, timestamps | N:1 User (Cascade); 1:N ProjectVersion | **nenhum índice em ownerId** | DRIFT — FK sem índice (full-scan em listagem por usuário). |
| AiConnection | id, userId, name, providerType, protocol, baseUrl?, modelName?, timestamps | 1:1 EncryptedCredential | **nenhum índice em userId**; sem FK para User (userId é scalar solto) | UNDOCUMENTED — nenhuma leitura/escrita desta tabela no código da main; modelo preparado p/ BYOK sem implementação. |
| EncryptedCredential | id, connectionId, keyVersion, algorithm(default AES-256-GCM), iv, ciphertext, authTag, timestamps | N:1 AiConnection (Cascade) | `@unique(connectionId)` | UNDOCUMENTED — idem; nenhum serviço de criptografia implementado em main/ci-cd. |
| ProjectVersion | id, projectId, snapshotJson, createdAt | N:1 Project (Cascade) | **nenhum índice em projectId** | DRIFT na main. Na ci/cd ganha uso real (snapshot antes de save-files). |

Extras na branch `ci/cd-authentication-audit-5d2e3`:

| Tabela | Colunas | Relações | Índices | Status |
|---|---|---|---|---|
| ProjectFile | id, projectId, path, content, timestamps | N:1 Project (Cascade) | `@@unique([projectId, path])`, `@@index([projectId])` (schema ci/cd:86–87) | OK |
| ChatMessage | id, projectId, role, content, createdAt | N:1 Project (Cascade) | `@@index([projectId, createdAt])` (ci/cd:99) | OK — `role` é String livre sem check constraint (S4/backlog: enum ou CHECK) |

## Observações estruturais

- `Session.tokenHash` sugere sessão server-side, mas a única auth implementada (ci/cd) é **JWT Bearer com token em localStorage** (`login/page.tsx:21` comentário literal: "token JWT salvo no localStorage e enviado como Bearer pelo api-client"). Contradição schema×código registrada em ADR-0002 como decisão pendente do usuário.
- `AiConnection.userId` sem FK com User — integridade referencial não garantida pelo banco (backlog S3).
- Sem `@@index` em toda FK scalar da main (ownerId, userId, projectId em ProjectVersion) — na ci/cd foi corrigido apenas para as tabelas novas.
- Dinheiro/tempo: não há colunas monetárias; timestamps são `DateTime` padrão Prisma (armazenados como timestamptz pelo driver postgres — conformidade OK).

## Estado de execução

- `pnpm --filter api prisma:generate` na main: **PASSOU** (exit 0; saída inclui `[fix-prisma-client] Diretório alvo no store .pnpm não encontrado; pulando.` — warning benigno do script auxiliar).
- `prisma migrate deploy/dev`: **BLOCKED** neste host — Postgres ausente (docker não instalado; porta 5432 fechada). Desbloqueio: `docker compose up -d` em host com Docker OU `DATABASE_URL` apontando para Postgres acessível. Nenhuma migration foi executada nesta auditoria (R3).
