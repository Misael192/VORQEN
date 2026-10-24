# ADR 001: Decisões da Fase 0

- Date: 2026-10-24
- Status: Accepted

## Contexto
A plataforma VORQEN precisa iniciar com um monorepo mínimo, bem definido, que sustente API, web, banco e saúde do sistema. A fase 0 deve permitir levantar o projeto e validar a base antes de adicionar autenticação, conexões de IA e versionamento.

## Decisão
1. Usar monorepo com `pnpm` workspaces e estrutura em `apps/api` e `apps/web`.
2. Não criar `packages/` antes da Fase 2, porque o código compartilhado ainda é overhead.
3. Manter Prisma com as 8 tabelas iniciais: `User`, `Session`, `Project`, `AiConnection`, `EncryptedCredential`, `Conversation`, `Message`, `ProjectVersion`.
4. Implementar `Session.tokenHash` como SHA-256 do token opaco, mantendo o token em cookie/cliente e o hash no servidor.
5. Guardar `ProjectVersion.snapshotJson` em formato `{ files: { [path]: content } }` e validar antes de persistir.
6. Definir health check enviando `SELECT 1` via Prisma com timeout de 2 segundos.
7. Validar variáveis de ambiente com Zod e abortar imediatamente com `process.exit(1)` em caso de falha.
8. Usar PostgreSQL 16 em Docker Compose e volume persistente.
9. A camada web é mínima no início; a lógica de negócios e de IA entra em fases posteriores.

## Consequências
- O projeto sobe de forma previsível e oferece uma base para autenticação, IA e versionamento.
- A fase mantém o escopo enxuto e evita overengineering prematuro.
- Qualquer funcionalidade extra depende de testes reais, migração e validação do banco.
