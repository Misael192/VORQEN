# VORQEN

VORQEN is a monorepo platform for AI-assisted software development. This first release contains:

- A NestJS API. It checks health and reads data with Prisma.
- A web app built with Next.js.
- PostgreSQL 16, started with Docker Compose.
- A Prisma schema with the six tables for the MVP.
- Validation of environment settings with Zod.

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

## ⚙️ IA Local (Opção A) — Requisitos de CORS no Ollama

Toda a inferência acontece **no navegador**, com fetch direto para
`http://localhost:11434` (pacote `packages/ai-core`). O backend NestJS
**nunca** recebe prompts, chaves ou streams de IA.

O navegador chama o Ollama local. Configure a origem antes:

```bash
# Linux/macOS (terminal)
OLLAMA_ORIGINS="*" ollama serve

# macOS (app Ollama)
launchctl setenv OLLAMA_ORIGINS "*"   # e reabra o app

# systemd (Linux)
sudo systemctl edit ollama.service    # [Service] Environment="OLLAMA_ORIGINS=*"
sudo systemctl restart ollama
```

Além disso, acesse a plataforma via **http://localhost:3000** (HTTP puro):
uma página servida em HTTPS não pode chamar um endpoint HTTP local
(bloqueio de *Mixed Content* do navegador).

Fluxo do usuário: `/settings/providers` (salva URL + modelo em
`localStorage["vorqen:ai-config"]`) → `/projects/<id>` (chat com streaming
direto do Ollama local).
