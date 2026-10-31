# VORQEN AI Studio — ARCHITECTURE

Atualizado: 2026-10-31 · Consolida `replica/architecture.md` exigido pela Fase 2. Base: branch `ci/cd-authentication-audit-5d2e3` (ADR-0001). Nada aqui altera código; é plano com estado atual verificado.

## Componentes e responsabilidade (monorepo pnpm, sem microserviços)

| Caminho | Responsabilidade | Estado hoje |
|---|---|---|
| `apps/web` | Next.js App Router: dashboard, workspace (chat+editor+preview), auth UI | existe na ci/cd; editor = textarea (`IDEWorkspace.tsx:120`) |
| `apps/api` | NestJS: auth JWT, projects, files, chat, versions | existe na ci/cd, 9 testes verdes |
| `packages/ai-core` | interface `AIProvider` + adaptadores (Ollama, OpenAI-compatible, Anthropic, custom), SSE, retry, healthCheck 2s | protótipo REAL em /workspace (25/25 vitest); no GitHub só Ollama simples |
| `packages/agent-core` | loop do agente, modos PLAN/CHAT/BUILD, ferramentas tipadas (files.read/write/patch, commands.run allowlist, tests.run) | TODO — não criar antes da Fase 7 |
| `packages/replica-tools` | wrappers HTTP das skills Python (parity/contrast/sweep/listing/reviews/imgdiff) | BLOCKED — pack `replica-skill-main/` ainda não fornecido pelo proprietário |
| `packages/shared` | tipos/Zod compartilhados web↔api | TODO (Fase 2, mínimo) |
| `prisma/` | schema canônico 8 models (ADR-0002): User, Session, Project, AiConnection, EncryptedCredential, ProjectFile, ChatMessage, ProjectVersion | migrations init+phase4 existem; migrate contra Postgres BLOCKED (sem DB/Docker) |

## Ordem de build (fatia vertical primeiro)
1. **Fase 2**: branch `base/studio` a partir da ci/cd + imports seletivos (ADR-0001) + gate `pnpm -r run build && pnpm -r run test`.
2. **Fase 3–4**: Postgres via `DATABASE_URL` (user fornece ou instala Docker) → `prisma migrate deploy` → smoke auth/CRUD com 2 usuários (isolamento).
3. **Fase 5–6**: portar ai-core multimodelo para o repo; chat passa a ir pela API (nunca direto do browser ao provider); persistência BYOK em EncryptedCredential; streaming SSE server→client.
4. **Fase 7**: agent-core com tool calling; BUILD só com autorização; audit log por operação.
5. **Fase 8**: Monaco substituindo textarea (gate de dependência R3/ADR-0004).
6. **Fase 9**: sandbox de execução — decisão pendente (WebContainer vs container efêmero) após infra disponível (ADR-0003).
7. Fases 10–14 conforme STATUS.md.

## Regras transversais
- Autorização por projeto/usuário em toda query da API (ownership check no service layer).
- Segredos: só env + coluna criptografada; nunca no bundle de cliente nem em logs.
- Ferramentas do agente: entrada/saída Zod, timeout, allowlist de comandos, sem interpolação em shell.
- Skills Python rodam no backend via wrapper, parâmetros sanitizados.
