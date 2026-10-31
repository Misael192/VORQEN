# VORQEN — Fase A: Diagnóstico Validado

Data: 2026-10-31
Checkout inspecionado: `/workspace` (equivalente ao workspace esperado `C:\Users\Misael de Araujo\Documents\Projeto Vorqen`)
URL/caminho do repo real: **não fornecido**. Nenhum remote configurado. Nenhum clone foi tentado sem URL.

---

## 1. Estado literal do checkout

### 1.1 Git

```text
$ git status
On branch master
nothing to commit, working tree clean

$ git branch -a
* master

$ git log --oneline -5
c18bf6a (HEAD -> master) task snapshot 53ed0ed8-276c-4e2f-9cc7-92f771b70b72

$ git remote -v
(sem saída)

$ git show-ref
c18bf6a301fa2ccdf61f30b93601c2a2d839f222	refs/heads/master
```

**Conclusão:** o único ref existente é `master`, com 1 commit de snapshot de ferramenta. Não há branches, não há remote, não há tags.

### 1.2 Estrutura de arquivos

```text
$ ls apps prisma replica-skill-main
ls: cannot access 'apps': No such file or directory
ls: cannot access 'prisma': No such file or directory
ls: cannot access 'replica-skill-main': No such file or directory
```

Conteúdo real do checkout (excluindo `node_modules`/`dist`):

```text
.env.example
.gitignore
package.json                 # raiz pnpm (name "vorqen", scripts build/test delegados a @vorqen/ai-core)
pnpm-workspace.yaml          # packages: apps/*, packages/*
pnpm-lock.yaml
packages/ai-core/            # README, package.json, tsconfig, src/, tests/ (ver 1.3)
```

### 1.3 Inventário `packages/ai-core` (evidência: `find packages -type f`)

```text
packages/ai-core/package.json
packages/ai-core/tsconfig.json
packages/ai-core/README.md
packages/ai-core/src/index.ts
packages/ai-core/src/types/{chat.ts, provider.ts, schemas.ts, index.ts}
packages/ai-core/src/providers/{OpenAICompatible.ts, AnthropicProvider.ts, OllamaProvider.ts, CustomProvider.ts, registry.ts}
packages/ai-core/src/errors/index.ts
packages/ai-core/src/utils/{sse.ts, messages.ts}
packages/ai-core/tests/{openai-compatible.test.ts, anthropic-ollama.test.ts, registry.test.ts, retry.test.ts, sse.test.ts}
```

### 1.4 Builds e testes executados neste host (saída literal)

```text
$ cd packages/ai-core && pnpm build
> @vorqen/ai-core@0.1.0 build
> tsc -p tsconfig.json
BUILD_EXIT=0

$ pnpm test
 ✓ tests/retry.test.ts (4 tests) 6ms
 ✓ tests/sse.test.ts (3 tests) 3ms
 Test Files  5 passed (5)
      Tests  25 passed (25)
TEST_EXIT=0
```

---

## 2. Validação das afirmações do hand-off

| # | Afirmação (hand-off) | Veredito | Evidência |
|---|---|---|---|
| H1 | `main` existe | **REFUTADA** | `git branch -a` → apenas `master` (seção 1.1). |
| H2 | `feat/fase-1-ai-core` igual à main | **REFUTADA** | branch inexistente (`git show-ref`: só `refs/heads/master`). |
| H3 | `ai-platform-similar-to-lovable-c458b` incorporada à main | **NÃO VERIFICÁVEL** | nenhuma das duas branches existe neste checkout. |
| H4 | `ci/cd-authentication-audit-5d2e3` (login JWT, projetos, chat, IDEWorkspace, testes, CI, 8 tabelas Prisma) | **REFUTADA / AUSENTE** | branch inexistente; `apps/api`, `apps/web`, `prisma/` não existem no disco (seção 1.2). Nada de auth/JWT/CI neste checkout. |
| H5 | `vorqen-editor-mvp-d03f4` (WebContainer, e2e, apaga OllamaProvider) | **REFUTADA / AUSENTE** | branch inexistente; `OllamaProvider.ts` está presente em `packages/ai-core/src/providers/` (seção 1.3) — nada foi apagado neste checkout. |
| H6 | `vorqen-mvp-architecture-56c9d` (`ai-core` completo, `AIConfigForm`, schema próprio) | **PARCIALMENTE CONFIRMÁVEL** | branch inexistente. Um `ai-core` funcional existe **neste checkout** (build+testes verdes, seção 1.4), mas não é possível atribuí-lo à branch citada nem localizar `AIConfigForm` ou schema Prisma desta branch (arquivos ausentes). |
| H7 | Build da API passaria | **NÃO VERIFICÁVEL** | `apps/api` não existe (`ls: cannot access 'apps'`). |
| H8 | Build web falharia por `postcss.config.js` | **NÃO VERIFICÁVEL** | `apps/web` não existe; nenhum `postcss.config.js` no checkout. |
| H9 | `ai-core` sem script de build | **REFUTADA** | `packages/ai-core/package.json` possui `"build": "tsc -p tsconfig.json"`; execução acima: `BUILD_EXIT=0`. |
| H10 | Prisma/Postgres/Ollama `BLOCKED` neste host (binaries.prisma.sh bloqueado, sem Docker) | **CONFIRMADA POR AUSÊNCIA + NÃO REPRODUZIDA** | `prisma/` não existe no checkout (nada para migrar); sem `DATABASE_URL` configurada. Não executei teste de rede contra binaries.prisma.sh nesta sessão — registro como não reproduzido aqui. Instrução de desbloqueio na seção 4. |

**Resumo honesto:** as quatro branches nomeadas no contexto técnico **não existem neste ambiente**. O repositório real do VORQEN não está acessível em `/workspace`. Portanto, a leitura "end-to-end" de `apps/api`, `apps/web`, `prisma/` e testes deles **não pôde ser feita** — não por falha de análise, mas porque os artefatos não estão presentes. Nenhuma conclusão sobre esse código foi inventada.

---

## 3. Classificação de capacidades (apenas o que existe no checkout)

| Capacidade | Status | Motivo / evidência | Instrução de desbloqueio |
|---|---|---|---|
| `packages/ai-core` — contrato `AIProvider` + adaptadores OpenAI/Anthropic/Ollama/Custom + registry + erros/retry + parser SSE | **REAL (camada de código)** | build exit 0; 25/25 testes passando (seção 1.4). Testes usam fetch mockado em nível de rede — o protocolo é exercitado de verdade, a chamada remota não. | Para operação ponta a ponta: definir `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` no ambiente (nomes já em `.env.example`; valores nunca no repo — R11) e rodar um smoke `healthCheck()` contra o provedor real. |
| Chat IA com provider real (produto) | **BLOCKED** | não há `apps/api`/`apps/web` que consumam ai-core neste checkout. | Fornecer URL/caminho do repo real (branch `ci/cd-authentication-audit-5d2e3` ou equivalente) para conectar a UI/API ao pacote. |
| Login JWT / projetos / auth | **BLOCKED** | código ausente (afirmação H4 não verificável aqui). | idem — repo real. |
| Preview WebContainer | **BLOCKED** | código ausente (afirmação H5 não verificável aqui). | idem — repo real. |
| Prisma / PostgreSQL | **BLOCKED** | `prisma/` ausente; sem `DATABASE_URL`. | repo real + Postgres acessível (Docker ou instância gerenciada) + `pnpm prisma generate/migrate`. |
| Ollama local | **BLOCKED** | binário/serviço não disponível neste host; adaptador existe e é testado offline, mas nunca chamou um `/api/chat` real aqui. | instalar/rodar Ollama no host do usuário e apontar `OLLAMA_BASE_URL`. |
| Pipeline Replica (`replica-skill-main/`, `packages/replica-tools/`) | **BLOCKED** | diretórios ausentes. | importar/criar as skills (Etapa 1+ do pipeline). |
| CI/CD | **BLOCKED** | nenhum workflow no checkout. | repo real (a branch ci/cd supostamente traz). |

Nota de precisão (R2): `ai-core` é classificado **REAL como biblioteca** (compila, testes de protocolo passam). Ele **não** é "chat funcional ponta a ponta" porque não há aplicação usando-o neste checkout — por isso o produto permanece BLOCKED.

---

## 4. Decisões pendentes para a Fase B

Não posso validar as decisões pedidas (branch base, schema canônico, provider prioritário) contra branches inexistentes. Registro a recomendação condicionada:

1. **Branch base:** decisão suspensa. Recomendação do roteiro era `ci/cd-authentication-audit-5d2e3`; não verificável aqui. Pré-requisito: obter acesso ao repo real.
2. **Schema Prisma canônico:** decisão suspensa — nenhum `schema.prisma` existe neste checkout para comparar.
3. **Provider prioritário:** **OpenAI-compatible via `OpenAICompatible.ts`** — única escolha sustentada por evidência local (implementação + testes verdes; menor atrito de credencial). Anthropic como segundo (também testado); Ollama mantido obrigatoriamente (multimodelo; a branch que o apaga deve ser descartada conforme contexto técnico).

---

## 5. Bloqueio principal e pedido ao usuário

**Bloqueio:** o checkout real do VORQEN não está acessível. `/workspace` contém apenas um snapshot de sessão anterior (ai-core + scaffolding pnpm), sem as branches citadas.

**Para desbloquear (qualquer uma das opções):**
- Informar a URL do remote (ex.: `https://github.com/<user>/vorqen.git`) para eu executar `git remote add origin <url> && git fetch --all` e então validar H1–H10 com evidência literal; ou
- Montar/copiar o checkout real para dentro deste ambiente.

Esta fase não alterou código, schema, dependências ou configuração. A única escrita foi este arquivo (`docs/DIAGNOSTIC-VALIDATED.md`).
