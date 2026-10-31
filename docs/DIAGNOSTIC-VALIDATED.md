# VORQEN — DIAGNOSTIC-VALIDATED

Data: 2026-10-31
Repo clonado de: https://github.com/Misael192/VORQEN (clone público OK, sem autenticação)
Commit da `main` inspecionada: 944e1ba12b73069f2f6865876651c28282532bd2
Checkout de diagnóstico: `~/vorqen-diag/vorqen` (workspace `/workspace` intocado; única escrita: este arquivo)

## Host de execução
- Node: v20.20.2 · pnpm: 9.12.0 (corepack; package.json pede pnpm@9.15.0 — corepack baixou 9.15.0 no install) · git 2.39.5 · Python 3.12.10
- Docker: **ausente** (`bash: docker: command not found`)
- Acesso a binaries.prisma.sh: **OK neste host** — evidência: `pnpm install --frozen-lockfile` completou com `.../node_modules/@prisma/engines postinstall: Done` e `✔ Generated Prisma Client (v6.19.3)` (log: /tmp/install.log). A afirmação do hand-off "binaries.prisma.sh bloqueado" está **REFUTADA neste host**. (Obs.: `curl https://binaries.prisma.sh/` retorna 404 na raiz — esperado; o que importa é o download dos engines, que passou.)
- PostgreSQL localhost:5432: **fechado** (`Connection refused`); Ollama localhost:11434: **fechado** (`Failed to connect`).

## Branches encontradas (saída literal de `git branch -a`)
```
* main
  remotes/origin/HEAD -> origin/main
  remotes/origin/ai-platform-similar-to-lovable-c458b
  remotes/origin/ci/cd-authentication-audit-5d2e3
  remotes/origin/feat/fase-1-ai-core
  remotes/origin/main
  remotes/origin/vorqen-editor-mvp-d03f4
  remotes/origin/vorqen-mvp-architecture-56c9d
  remotes/origin/vorqen-studio-identity-d0476   ← NÃO estava no roteiro (extra)
```

## Build e testes por branch

### main (944e1ba)
- `pnpm install --frozen-lockfile`: **ok** (exit 0, "Done in 17s")
- `pnpm --filter api run build`: **ok** (exit 0, `nest build`)
- `pnpm --filter web run build`: **FALHOU** (exit 1). Erro literal: `Error: Your custom PostCSS configuration must export a 'plugins' key.` + warning `Your PostCSS configuration defines a field which is not supported ('default')`. Causa em `apps/web/postcss.config.js:3` (`exports.default = {...}` em arquivo CJS — Next lê `module.exports`, que fica `{}`).
- Testes: **nenhum** — `find . \( -name "*.spec.ts" -o -name "*.test.ts" \)` → vazio; sem script `test` nos pacotes.

### ci/cd-authentication-audit-5d2e3 (6440cbd)
- `pnpm install --frozen-lockfile`: ok
- API build: **ok** · Web build: **ok** (postcss.config.js corrigido: `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }`)
- `pnpm -r --if-present test`: **ok (exit 0)** — api: `Tests: 5 passed, 5 total` (projects.service.spec.ts); ai-core: `Tests: 4 passed, 4 total` (ollama.spec.ts). Total: **9 testes unitários passando**.
- Conteúdo confirmado: auth JWT completa (`apps/api/src/auth/{auth.controller,auth.service,jwt.strategy,jwt-auth.guard}.ts`), projects CRUD+files+chat (`apps/api/src/projects/*`), `IDEWorkspace.tsx`/`ChatPanel.tsx`/`AuthGate.tsx`, `.github/workflows/ci.yml`, schema com **8 models**, 2 migrations.

### vorqen-editor-mvp-d03f4 (d5f81d2)
- `pnpm install --frozen-lockfile`: **FALHOU** — `ERR_PNPM_OUTDATED_LOCKFILE` (lockfile não reflete apps/api/package.json). Com `--no-frozen-lockfile`: ok (modificou lock localmente; revertido).
- API build: **FALHOU** (exit 1). Erros literais: `src/main.ts:16:7 - error TS2339: Property 'useBodyParser' does not exist on type 'INestApplication'`; `register.dto.ts:8:17 - error TS2559` (@MinLength string msg); `save-files.dto.ts:34:4 - Cannot find name 'MaxLength'`; TS7006 implicit any em projects.service.ts.
- Web build: **FALHOU** (mesmo erro de postcss da main).
- Testes: não executáveis neste estado (build quebra). Existe `apps/api/test/app.e2e-spec.ts` (supertest real contra Postgres; header do arquivo: "Se o banco nao estiver acessivel, a suite falha (sem mocks/simulacoes)").
- `OllamaProvider.ts` de `packages/ai-core`: **APAGADO** — evidência: `git diff main origin/vorqen-editor-mvp-d03f4 -- '*OllamaProvider*'` → `packages/ai-core/src/providers/OllamaProvider.ts | 132 ------- 1 file changed, 132 deletions(-)`.

### vorqen-mvp-architecture-56c9d (93c68ad)
- `pnpm install --frozen-lockfile`: ok · API build: ok · ai-core build: ok (`tsc -p tsconfig.build.json`) · Web build: **FALHOU** (mesmo erro postcss).
- Tem `AIConfigForm.tsx` (2 cópias: `apps/web/src/components/` e `apps/web/components/settings/`), chat client-side em `apps/web/app/projects/[id]/page.tsx`, `codegen.ts` no ai-core, skill `asd-ste100` (docs/) e `ste-lint.py` (scripts/). Schema com **6 models** (User, Project, ChatMessage, ProjectFile, ProjectSnapshot, AiModelConfig) — divergente do ci/cd. Migration própria: `20261026000000_init`.

## Validação das 8 afirmações de hand-off
| # | Status | Evidência |
|---|---|---|
| 1 | `main` == `feat/fase-1-ai-core` | **CONFIRMADO** — `git rev-parse`: ambos `944e1ba12b73069f...`; `git log main..origin/feat/fase-1-ai-core` → 0 commits |
| 2 | c458b já mergeada em main | **CONFIRMADO** — `git merge-base --is-ancestor origin/ai-platform-similar-to-lovable-c458b main` → exit 0 (8a33be9 é ancestral de 944e1ba) |
| 3 | ci/cd tem JWT+CRUD+chat+IDEWorkspace+testes+CI+8 tabelas | **CONFIRMADO** — arquivos listados acima; `grep -c '^model' prisma/schema.prisma` → 8; jest: 5 passed; vitest: 4 passed; `.github/workflows/ci.yml` existe |
| 4 | editor-mvp tem login+CRUD+WebContainer+e2e+apaga OllamaProvider | **PARCIALMENTE REFUTADO** — CONFIRMADO: login (`app/login/page.tsx`), CRUD (auth/projects no diff), apaga OllamaProvider (diff 132 deleções), e2e supertest existe. **REFUTADO: WebContainer** — `grep -ri webcontainer apps/web` → zero ocorrências; editor navega para `/editor/${id}` mas `git ls-tree` mostra que só existem páginas `globals.css/layout/login/page` (rota órfã); nenhum iframe/preview/monaco em files.ts |
| 5 | arch tem ai-core completo + AIConfigForm + schema divergente | **CONFIRMADO** — ai-core com build script + codegen.ts + ollama.ts; AIConfigForm.tsx presente; schema 6 models vs 8 do ci/cd |
| 6 | Build da API passa na main | **CONFIRMADO** — `API_BUILD_EXIT=0` (/tmp/build-api-main.log) |
| 7 | Build web falha na main por postcss.config.js | **CONFIRMADO** — `WEB_BUILD_EXIT=1`; erro literal `Error: Your custom PostCSS configuration must export a 'plugins' key.`; causa: `exports.default` em `apps/web/postcss.config.js:3` |
| 8 | ai-core sem script build na main | **CONFIRMADO** — `git show main:packages/ai-core/package.json | grep -c '"build"'` → 0 (só name/exports/deps ollama) |

Extra (fora das 8): a branch `vorqen-studio-identity-d0476` também existe no remoto (commits "task snapshot") — conteúdo não inspecionado nesta fase.

## Capacidades por módulo
| Capacidade | Status | Evidência | Desbloqueio |
|---|---|---|---|
| Auth (login/cadastro JWT) | **PARTIAL** | Código real na ci/cd (auth.service/controller/jwt.strategy) + 5 testes jest passando; nunca exercitado contra Postgres real aqui (porta 5432 fechada) | Subir Postgres (docker-compose.yml existe, mas Docker ausente neste host) e rodar `prisma migrate deploy` + e2e |
| CRUD de projetos | **PARTIAL** | projects.service.ts + spec com ownership tests (Forbidden/NotFound) verdes; sem teste ponta a ponta com banco real neste host | idem |
| Chat com IA real (não mock) | **PARTIAL** | ChatPanel usa `createProvider('ollama', baseUrl)` + `provider.streamChat()` de verdade (ChatPanel.tsx:30,50) — sem setTimeout fake; porém requer Ollama local, porta 11434 fechada | Rodar Ollama + modelo `llama3.1`, ou adicionar provider cloud (Fase C) |
| Streaming de resposta de LLM | **PARTIAL** | `streamChat` com ReadableStream reader no ChatPanel; 4 testes vitest em ollama.spec.ts passando | idem (endpoint vivo p/ smoke manual) |
| packages/ai-core (interface multimodelo) | **BLOCKED** | Só implementa `ILLMProvider` com **Ollama**; `createProvider` lança `Provedor "openai"/"anthropic" ainda não implementado` (index.ts:8); não satisfaz o contrato `<arquitetura_multimodelo>` (identify/listModels/reportCapabilities/healthCheck ausentes) | Implementar adaptadores OpenAI/Anthropic + contrato AIProvider (escopo Fase C; existe referência local em /workspace/packages/ai-core com testes) |
| OllamaProvider | **PARTIAL** | Real, testado (4/4 vitest na ci/cd); APAGADO na editor-mvp (132 deleções) — não fazer merge dessa branch inteira | idem chat |
| Provider cloud (OpenAI/Anthropic/Gemini) | **BLOCKED** | Nenhum código em nenhuma branch (`git ls-tree` arch: só ollama.ts) | Implementar + chaves via env do usuário (R11) |
| Editor de código (Monaco) | **BLOCKED** | Zero ocorrências de "monaco" em qualquer branch (git grep); IDEWorkspace.tsx = textarea + lista de arquivos | Adicionar dependência (R9: exige autorização) |
| Preview (WebContainer / sandbox) | **BLOCKED** | Zero ocorrências de "webcontainer"/"@stackblitz" no repo inteiro; nenhuma página /editor/[id] na editor-mvp | Decisão de arquitetura Fase B/C (WebContainer exige COOP/COEP headers + HTTPS) |
| Execução de skill Replica (parity/contrast/sweep/listing) | **BLOCKED** | Diretório `replica-skill-main/` não existe em nenhuma branch; só artefatos estáticos em `replica/` na main (recon.md, features.csv, design) e skill `asd-ste100` na arch | Escrever as ferramentas Python (Etapa 1–10 do pipeline) |
| Schema Prisma + migrations | **PARTIAL** | Migrations versionadas em todas as branches (init 20261025175706; phase4 na ci/cd); generate ok; `migrate`/`db push` nunca rodou aqui (sem DB) | Postgres acessível + `pnpm prisma:migrate` |
| Testes E2E (Playwright) | **BLOCKED** | Nenhum `playwright.config.*` em nenhuma branch; único e2e é supertest (editor-mvp, build quebrado) | Adicionar Playwright (R9) + app rodando |
| CI (GitHub Actions) | **PARTIAL** | `.github/workflows/ci.yml` existe na ci/cd (install→generate→build→test, Node 20/pnpm 9); status de execução no GitHub não verificável daqui (sem gh/auth) | Conferir aba Actions do repo |
| Docker / containers no host | **BLOCKED** | `bash: docker: command not found` | Instalar Docker ou usar Postgres gerenciado/NativePostgres |

## Bloqueios no host
1. **Sem Docker** → desbloqueio: instalar Docker Engine ou apontar `DATABASE_URL` para Postgres externo.
2. **Postgres 5432 fechado** → desbloqueio: `docker compose up -d` (compose existe na main) quando Docker disponível, ou `scripts/setup-local-db.sh`, ou Postgres gerenciado.
3. **Ollama 11434 fechado** → desbloqueio: instalar Ollama + `ollama pull llama3.1`, OU configurar chave cloud via env (nomes em .env.example; valores só pelo usuário — R11).
4. **editor-mvp com lockfile dessincronizado** → desbloqueio: `pnpm install --no-frozen-lockfile` + commit do lock na Fase B (se a branch for aproveitada).

## Três decisões para Fase B

1. **Branch base do VORQEN Studio: `ci/cd-authentication-audit-5d2e3`.** É a única com web+api builds verdes ao mesmo tempo, testes passando (9/9), CI, auth JWT, 8 tabelas e postcss corrigido. Justificativa de rebranding (R3): o nome da branch referencia "authentication audit"; renomear para `base/studio` antes de evoluir. Da `vorqen-mvp-architecture` trazer apenas `codegen.ts`/`AIConfigForm`/skill `asd-ste100` se úteis; da `vorqen-editor-mvp` trazer apenas `test/app.e2e-spec.ts` + seed (`prisma/seed/`) — **nunca merge inteiro** (apaga OllamaProvider e quebra o build).
2. **Schema Prisma canônico: o da ci/cd (8 models, migrations init+phase4).** Motivo técnico: é o único compatível com o código de auth/projects que compila e testa verde; o da arch (6 models, AiModelConfig) conflita e não tem serviço correspondente funcional. Divergência a resolver: adicionar tabela de credencial criptografada já existe (EncryptedCredential) — vantagem sobre arch.
3. **Provider de IA prioritário para Fase C: Ollama local primeiro, OpenAI-compatible segundo.** Ollama já é REAL-PARTIAL (único adaptador existente, com testes); para o produto funcionar neste host basta o usuário instalar Ollama + `llama3.1`. Cloud vem em seguida porque hoje **não existe nenhum** adaptador cloud nas branches — o usuário precisa fornecer `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` via variável de ambiente (nunca em código/prompt — R11).

## O que NÃO foi verificado e por quê
- Execução real de auth/CRUD/chat ponta a ponta: sem Postgres nem Ollama neste host.
- Status verde/vermelho do GitHub Actions: exige acesso autenticado ao repo.
- Branch `vorqen-studio-identity-d0476`: fora do escopo pedido; não inspecionada além da existência.
- `pnpm -w run build` na raiz da main: main não tem script `build` raiz (só ci/cd tem); usei builds filtrados por pacote com evidência de exit code.
- Qualidade visual/acessibilidade das telas: fora do escopo da Fase A.
