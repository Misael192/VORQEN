# VORQEN — DIAGNOSTIC-VALIDATED

Data: 2026-10-31 (re-execução completa com clone limpo, sessão atual)
Repo clonado de: https://github.com/Misael192/VORQEN (público; `git clone` sem autenticação: "Cloning into 'vorqen'...")
Commit da `main` inspecionada: 944e1ba12b73069f2f6865876651c28282532bd2
Checkout de diagnóstico: `~/vorqen-diag/vorqen`, recriado do zero (`rm -rf ~/vorqen-diag` + clone novo). Workspace `/workspace` intocado nesta fase (única escrita: este arquivo). Clone devolvido a `main` ao final.

## Host de execução
- Node: v20.20.2 · git: 2.39.5 · Python: 3.12.10 · pnpm: 9.12.0 (root package.json declara `packageManager: pnpm@9.15.0`)
- Docker: **ausente** — evidência literal: `bash: docker: command not found`
- Acesso a binaries.prisma.sh: **OK neste host**. Evidência: `pnpm install --frozen-lockfile` → "Done in 3.4s" e `prisma generate` → "✔ Generated Prisma Client (v6.19.3) to ./../../node_modules/.prisma/client in 223ms". A alegação de hand-off "binaries.prisma.sh bloqueado" está **REFUTADA** neste host.
- Postgres localhost:5432: fechado (`PG DOWN` em teste TCP). Ollama localhost:11434: fechado (`OLLAMA DOWN`).

## Branches encontradas
```
* main
  remotes/origin/HEAD -> origin/main
  remotes/origin/ai-platform-similar-to-lovable-c458b
  remotes/origin/ci/cd-authentication-audit-5d2e3
  remotes/origin/feat/fase-1-ai-core
  remotes/origin/main
  remotes/origin/vorqen-editor-mvp-d03f4
  remotes/origin/vorqen-mvp-architecture-56c9d
  remotes/origin/vorqen-studio-identity-d0476   <- EXTRA, fora do roteiro (3 commits "task snapshot ...")
```
As 6 branches do roteiro existem. Diffs `main..branch`: ci/cd = 1 commit (6440cbd); editor-mvp = 1 commit (d5f81d2); arch = 8 commits (fc1d2ef..93c68ad); identity = 3 snapshots.

## Build e testes por branch

### main (944e1ba)
- `pnpm install --frozen-lockfile`: OK — "resolved 676 ... Done in 3.4s"
- `pnpm -w run build`: FALHA — `ERR_PNPM_NO_SCRIPT Missing script: build` (raiz não define build)
- `apps/api build` (`nest build`): FALHA crua com 4 erros TS (`Module '"@prisma/client"' has no exported member 'PrismaClient'` etc.) — causa: client Prisma não gerado. Após `prisma generate --schema ../../prisma/schema.prisma`: **build OK (exit 0)**. Ou seja: compila somente com passo de generate (não há script de bootstrap que garanta isso na ordem certa).
- `apps/web build`: FALHA — linha exata: `Error: Your custom PostCSS configuration must export a \`plugins\` key.` (tracedor de `./app/globals.css`; causa: `apps/web/postcss.config.js` usa `exports.default = {...}` em arquivo CJS — Next 15 lê o módulo como `{default:{...}}` e não encontra `plugins`. Nota extra: linha 1 do mesmo arquivo tem import órfão suspeitoso `const { text } = require('node:stream/consumers');`)
- `pnpm -r run test`: nenhum projeto executa teste ("Scope: 3 of 4 workspace projects", zero suítes — find não retorna *.spec.ts/*.test.ts na main)
- Schema: `prisma/schema.prisma` existe; **zero migrations** (`find *.migration.sql` vazio)

### ci/cd-authentication-audit-5d2e3 (6440cbd)
- `pnpm install --frozen-lockfile`: OK — "Done in 1.8s"
- `pnpm -r run build`: falha cru com 4 erros TS idem (client não gerado); após `prisma generate`: **api Done + web Done** (web lista rotas incl. `/login`, First Load JS 100 kB). CI real roda `pnpm prisma:generate` antes de build (ci.yml linhas 32-36), então o pipeline está coerente.
- `pnpm -r run test`: **PASS** — api: `Test Suites: 1 passed, Tests: 5 passed` (projects.service.spec: create/ownership/upsert); ai-core vitest: `Test Files 1 passed (1), Tests 4 passed (4)` (ollama.spec.ts). Total: **9 testes, 9 passando**.
- Chaves: `.github/workflows/ci.yml` presente; schema com **8 models** (User, Session, Project, AiConnection, EncryptedCredential, ProjectFile, ChatMessage, ProjectVersion); migrations `20261025175706_init` + `20261026000000_phase4_projects_files_chat`; `IDEWorkspace.tsx` presente; auth JWT em src (bcryptjs/passport-jwt no package.json).
- Limitações honestas: chat via **Ollama direto do navegador** (`ChatPanel.tsx:30 createProvider('ollama', baseUrl)`, baseUrl default `http://localhost:11434` — IDEWorkspace.tsx:20). Não há provider cloud nem endpoint de chat no API. Sem Monaco/WebContainer/Playwright (grep em apps/web/package.json: "none of monaco/webcontainer/axe").

### vorqen-editor-mvp-d03f4 (d5f81d2)
- `pnpm install --frozen-lockfile`: **FALHA** — lockfile dessincronizado com package.json (mensagem literal: "specifiers in the lockfile ... don't match specs in package.json"; faltam @nestjs/jwt, passport, bcryptjs etc.). Com `--no-frozen-lockfile`: OK (com warning peer react-dom).
- `pnpm -r run build`: **FALHA** — api: "Found 5 error(s)" (ex.: TS4053 `Return type ... cannot be named 'SnapshotFile'` em projects.controller.ts:24; erro de tipo `snapshotJson` vs JsonNullValueInput). Web não chega a buildar no fluxo recursivo.
- `pnpm -r run test`: **FALHA** — `Test Suites: 1 failed, 1 passed; Tests: 3 passed`. Suite quebrada: `test/app.e2e-spec.ts:38:23 - error TS2349: This expression is not callable` (import default do supertest v7 incompatível). É teste de API com supertest, **não Playwright**.
- **WebContainer NÃO existe**: `grep -rn "WebContainer|@webcontainer|codesandbox|monaco"` em apps/ e packages/ → zero ocorrências; sem IDEWorkspace; sem dependência. O commit d5f81d2 se anuncia "WebContainer IDE", mas o código não contém WebContainer. **Refutado.**
- Apaga OllamaProvider: **CONFIRMADO** — `git diff main origin/vorqen-editor-mvp-d03f4 -- '*OllamaProvider*'` → `packages/ai-core/src/providers/OllamaProvider.ts | 132 -------  1 file changed, 132 deletions(-)`.
- Diff vs ci/cd: 45 files changed, +988/−4113 — é um fork anterior/divergente, não um superconjunto da ci/cd. Traz sim: `prisma/seed/seed.js` (+package.json) e o e2e supertest (quebrado).

### vorqen-mvp-architecture-56c9d (93c68ad)
- `pnpm install --frozen-lockfile`: OK — "Done in 990ms"
- `pnpm -r run build`: **parcial** — ai-core Done (tem script real `"build": "tsc -p tsconfig.build.json"`), api Done, **web Failed** — mesmo erro: `Error: Your custom PostCSS configuration must export a \`plugins\` key.` (postcss.config.js idêntico ao da main)
- `pnpm -r run test`: nada roda ("Scope: 3 of 4", sem scripts de teste executáveis)
- Chaves: `AIConfigForm.tsx` (presente em 2 locais: `apps/web/src/components/` e `apps/web/components/settings/` — duplicação), `ChatPanel.tsx` client-side (localStorage key `vorqen:ai-config`), `packages/ai-core/src/codegen.ts`, provider único `ollama.ts`, skill própria `asd-ste100`/`ste-lint.py` (não é skill Replica). Schema: **6 models** (User, Session→(não), Project, AiModelConfig, ProjectFile, ProjectSnapshot, ChatMessage) — divergente da ci/cd (sem EncryptedCredential/AiConnection/ProjectVersion).

### vorqen-studio-identity-d0476 (extra, não mapeada no roteiro)
- 3 commits "task snapshot". Não foi construída sobre a ci/cd; conteúdo não inspecionado em detalhe nesta fase (fora do escopo das 6 afirmativas). Registrada para honestidade.

## Validação das 8 afirmações de hand-off
| # | Afirmação | Status | Evidência |
|---|---|---|---|
| 1 | `main` == `feat/fase-1-ai-core` | **CONFIRMADO** | `git rev-parse`: ambos `944e1ba12b73069f2f6865876651c28282532bd2` |
| 2 | c458b já mergeada em main | **CONFIRMADO** | `git merge-base --is-ancestor origin/ai-platform-similar-to-lovable-c458b main` → exit 0 ("CONFIRMED: c458b is ancestor of main"); 8a33be9 aparece no log da main |
| 3 | ci/cd: JWT+CRUD+chat+IDEWorkspace+testes+CI+8 tabelas | **CONFIRMADO COM RESSALVA** | 8 models (grep `^model`), ci.yml presente, auth/{jwt.strategy,guard}, projects/, IDEWorkspace.tsx, 9/9 testes passando. Ressalva: "chat" = Ollama direto do browser (ChatPanel.tsx:30), sem backend de chat e sem provider cloud |
| 4 | editor-mvp: login+CRUD+IDE WebContainer+e2e+apaga OllamaProvider | **PARCIALMENTE REFUTADO** | CONFIRMADO: apaga OllamaProvider (diff: 132 deleções); auth/projects presentes. **REFUTADO: WebContainer não existe** (zero ocorrências em todo o repo da branch); e2e existe mas **falha** (TS2349 supertest); build da API falha (5 erros TS); install --frozen falha (lockfile dessincronizado) |
| 5 | arch: ai-core completo + AIConfigForm + schema divergente | **CONFIRMADO COM RESSALVA** | AIConfigForm ✓, codegen ✓, build script ✓, schema 6 models ≠ 8 da ci/cd ✓. Ressalva: "ai-core completo" = 1 provider (ollama.ts); web não builda (postcss) |
| 6 | Build da API passa na main | **REFUTADO (como estado cru)** | `nest build` cru: "Found 4 error(s)" (`PrismaClient` ausente). Passa somente após `prisma generate` manual (exit 0). A CI da ci/cd cobre isso com step dedicado; a main não tem CI |
| 7 | Build web falha na main por postcss.config.js | **CONFIRMADO** | Erro literal: `Error: Your custom PostCSS configuration must export a \`plugins\` key.`; arquivo usa `exports.default = { plugins: ['tailwindcss'] }` (CJS) — Next 15 não resolve `default` |
| 8 | ai-core sem script build no package.json | **CONFIRMADO na main** | `cat packages/ai-core/package.json`: apenas name/version/private/type/exports/dependencies — sem bloco `scripts`. (A branch arch adicionou `build: tsc -p tsconfig.build.json` — commit 81a0f7d) |

Correção à alegação de hand-off: "Prisma blocked por binaries.prisma.sh" → **REFUTADO neste host** (geração de client OK). O bloqueio real é Postgres/Ollama/Docker, não download de engines.

## Capacidades por módulo
Status avaliado na melhor branch (ci/cd-authentication-audit-5d2e3), pois é a única verde; capacidade inexistente em todas as branches = BLOCKED por ausência de código.

| Capacidade | Status | Evidência | Desbloqueio |
|---|---|---|---|
| Auth (login/cadastro) | **PARTIAL** | jwt.strategy.ts/guard + bcryptjs + tests 5/5; mas signup **sem verificação de email**, sessão em tabela mas token no client | Implementar verificação/reset de email (Resend/Postmark), cookie http-only; exige SMTP cred |
| CRUD de projetos | **PARTIAL** | projects.service.spec 5 casos OK (create/ownership/upsert) contra mocks; nunca exercitado contra Postgres real (porta fechada) | Subir Postgres (ver Docker abaixo) e rodar `prisma migrate deploy` + smoke |
| Chat com IA real (não mock) | **BLOCKED** | ChatPanel chama Ollama real (código ok), mas `localhost:11434` DOWN neste host; nenhum provider cloud no repo | Instalar Ollama + `ollama pull llama3.2`, OU adicionar adaptador OpenAI/Anthropic + chave via env (R11: valores só no .env) |
| Streaming de resposta de LLM | **PARTIAL** | ollama.spec.ts (4 testes vitest) cobre parsing; stream fim-a-fim não validado com servidor real aqui | Ídem acima + validar no browser com Ollama up |
| packages/ai-core (interface multimodelo) | **PARTIAL** | Repo: 1 provider (Ollama). Em /workspace existe implementação multimodelo local (OpenAI-compatible/Anthropic/Ollama/Custom + registry + retry) com build exit 0 e 25 testes vitest passando — **ainda não integrada ao repo remoto** | Fase B: adotar/substituir contratos cuidando de R10 (preservar ollama.spec existente) |
| OllamaProvider | **REAL como biblioteca** | presente em main/ci-cd/arch; 4 testes passando; editor-mvp o apaga (não usar essa branch) | — |
| Provider cloud (OpenAI/Anthropic/Gemini) | **BLOCKED** | `grep` em todas as branches: nenhum adaptador cloud | Escrever adaptador (já prototipado em /workspace/packages/ai-core) + `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` fornecidos pelo usuário via env |
| Editor de código (Monaco) | **BLOCKED** | monaco ausente de todos os package.json; IDEWorkspace usa textarea/lista simples | Adicionar dependência (R9: pedir autorização) e integrar |
| Preview (WebContainer/sandbox) | **BLOCKED** | Zero ocorrências de webcontainer/codesandbox em qualquer branch, incluindo a que alegava ter | Avaliar WebContainer (requer COOP/COEP headers no deploy) ou sandbox alternativo; decisão de Fase B/C |
| Execução de skill Replica (parity/contrast/sweep/listing/reviews/imgdiff) | **BLOCKED** | `git ls-tree -r` em TODAS as branches: nenhum dos 6 arquivos .py; `replica-skill-main/` não existe; `replica/` na main tem só artefatos md/csv | Implementar as ferramentas Python conforme pipeline (Etapa 1+) |
| Schema Prisma + migrations | **PARTIAL** | ci/cd: 8 models + 2 migrations versionadas; `prisma generate` OK; **migrate/DB nunca rodados aqui** (sem Postgres/Docker) | Postgres acessível: `docker compose up db` (host com Docker) ou DATABASE_URL externo; então `prisma migrate deploy` |
| Testes E2E (Playwright) | **BLOCKED** | `find playwright.config.*` → vazio em todas as branches; único "e2e" (editor-mvp) é supertest e está quebrado (TS2349) | Adicionar @playwright/test + axe-core (R9 aprovação p/ deps), escrever specs por fluxo |
| CI (GitHub Actions) | **PARTIAL** | ci.yml existe APENAS na branch ci/cd (steps: install→prisma:generate→build→test, coerente com o que passou aqui). Main sem workflow. **Run status no GitHub não verificável** (sem acesso às Actions runs) | Push da base escolhida + verificar primeira run verde no GitHub |
| Docker / containers no host | **BLOCKED** | `bash: docker: command not found` | Instalar Docker neste host OU usar Postgres gerenciado (Neon/Supabase/RDS) com DATABASE_URL |

## Bloqueios no host
1. **Docker ausente** → sem Postgres local via compose. Desbloqueio: instalar Docker, ou fornecer `DATABASE_URL` de Postgres gerenciado (usuário digita o valor no .env — R11).
2. **Ollama ausente** (porta 11434 fechada) → chat/streaming não exercitável fim-a-fim. Desbloqueio: instalar Ollama + `ollama pull llama3.2`, ou chave cloud no env.
3. **Sem credenciais cloud** → providers OpenAI/Anthropic não testáveis. Desbloqueio: usuário configura `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` no ambiente (nunca no prompt/repo).
4. **Actions do GitHub não inspecionadas** → status real do CI remoto desconhecido. Desbloqueio: acesso à aba Actions ou colar log da última run.

## Três decisões para Fase B
1. **Branch base:** `ci/cd-authentication-audit-5d2e3` (6440cbd). Justificativa: única branch com `pnpm -r run build` verde (api+web) e testes passando (9/9) neste host; traz auth JWT, CRUD, 8 models, migrations e CI. Da arch trazer **apenas**: script de build do ai-core, `codegen.ts`, `AIConfigForm` (uma cópia, deduplicar). Da editor-mvp trazer **apenas**: `prisma/seed/seed.js`; **nunca** mergear a branch inteira (apaga OllamaProvider: −132 linhas; lockfile quebrado; 5 erros TS).
2. **Schema canônico:** o da ci/cd (8 models + 2 migrations). Motivo técnico: é o único alinhado com código que compila e testa (EncryptedCredential/AiConnection sustentam o multimodelo; ProjectVersion dá snapshots). O da arch (6 models) é subconjunto divergente e sem migrations. Qualquer mudança de schema exige aprovação explícita (R9).
3. **Provider prioritário Fase C:** Ollama primeiro (único adaptador no repo, 4 testes verdes; desbloqueio barato: instalar ollama + pull llama3.2, zero custo/chave). Segundo: OpenAI-compatible via o pacote ai-core já prototipado e testado em /workspace (25 testes) — exige do usuário apenas `OPENAI_API_KEY` no env. Anthropic/Gemini depois do OpenAI-compatible estar plugado no chat do produto.

## O que NÃO foi verificado e por quê
- Rodar a aplicação fim-a-fim (API+web+DB): sem Postgres/Docker neste host.
- Migrations aplicadas de fato (`prisma migrate deploy`): requer DB.
- Chat/streaming com modelo real: requer Ollama instalado ou chave cloud.
- Runs de CI no GitHub (verde/vermelho histórico): sem acesso às Actions do repo.
- Conteúdo útil da branch extra `vorqen-studio-identity-d0476`: fora do roteiro; inspeção rasa apenas (3 task snapshots).
- Qualidade visual/acessibilidade das telas: não auditado (sem browser/axe no escopo desta fase).
- `replica/` artifacts na main (recon.md, features.csv): existem como documentos; nenhuma ferramenta Python correspondente foi validada (inexistentes).
