# VORQEN AI Studio

Plataforma de desenvolvimento de aplicações por linguagem natural: descreva o app, o agente planeja, gera arquivos reais, edita, executa em sandbox, mostra preview funcional, testa e corrige. Múltiplos provedores de IA (local e cloud), identidade própria, código aberto ao próprio dono.

**Isto não é uma interface de demonstração.** Todo recurso declarado tem estado explícito (`REAL`/`PARTIAL`/`BLOCKED`/`TODO`) com evidência em `docs/STATUS.md`.

## Estado atual (resumo honesto)
- Fase 1 (auditoria/planejamento): concluída, aguardando revisão do proprietário.
- Base de trabalho aprovada no plano: branch `ci/cd-authentication-audit-5d2e3` do repo https://github.com/Misael192/VORQEN (única com build+testes verdes: 9/9).
- Camada multimodelo `packages/ai-core` (interface `AIProvider`, adaptadores OpenAI-compatible/Anthropic/Ollama/custom): protótipo com 25/25 testes passando neste workspace; pendente de importação para o repo na Fase 2.
- Postgres, Ollama, credenciais cloud, sandbox de preview: indisponíveis neste host — ver bloqueios e instruções de desbloqueio em `docs/STATUS.md` e `docs/TESTING.md`.

## Estrutura
```
apps/web        Next.js (App Router) — dashboard, workspace, chat, editor, preview
apps/api        NestJS — auth JWT, projetos, arquivos, conversas, agente, execução
packages/ai-core     Interface AIProvider + adaptadores por provedor
packages/agent-core  Loop do agente, modos PLAN/CHAT/BUILD, ferramentas tipadas (Fase 7)
packages/replica-tools Wrappers backend das Replica Skills (Fases posteriores)
prisma/         Schema canônico (8 models) + migrations
docs/           STATUS, ARCHITECTURE, ROADMAP, SECURITY, TESTING, ADR/, DIAGNOSTIC-VALIDATED.md
replica/        recon.md, features.csv (artefatos da metodologia)
```

## Como rodar (quando a infra estiver disponível)
```bash
pnpm install
npx prisma generate
DATABASE_URL=<sua connection string> pnpm -r run build
pnpm -r run test
```
Configure credenciais apenas via `.env` (nomes em `.env.example`; nunca valores no chat/repo/log).

Provedores: `OLLAMA_*` para modelo local; `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` para cloud. Sem credencial, o chat responde com erro honesto `BLOCKED`, nunca com simulação.

## Documentos-chave
- `docs/DIAGNOSTIC-VALIDATED.md` — auditoria com evidência literal das 9 branches
- `docs/STATUS.md` — estado das 14 fases e capacidades
- `docs/ARCHITECTURE.md` · `docs/ROADMAP.md` · `docs/SECURITY.md` · `docs/TESTING.md`
- `docs/ADR/` — decisões arquiteturais (base, schema, preview, editor, camada de IA)
