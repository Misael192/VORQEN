# VORQEN

VORQEN is the foundation for a monorepo AI development platform. The initial scaffold includes:

- NestJS API with health checks and Prisma integration
- Next.js web app shell
- PostgreSQL 16 via Docker Compose
- Prisma schema with the initial six MVP tables
- Config validation using Zod and environment checks

## Quick start

```bash
cp .env.example .env
# adjust environment values if needed
docker compose up -d
pnpm install
pnpm prisma:generate
pnpm prisma:migrate -- --name init
pnpm dev:api
```

The API listens on `http://localhost:4000`.
The web app listens on `http://localhost:3000`.
