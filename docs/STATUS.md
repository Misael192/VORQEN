# VORQEN AI Studio — STATUS

Atualizado: 2026-10-31 (Fase 1 — Reconhecimento e planejamento)
Fonte de verdade do código: https://github.com/Misael192/VORQEN (clone de diagnóstico em `~/vorqen-diag/vorqen`, branch `main` = 944e1ba).
Diagnóstico completo com evidência literal: `docs/DIAGNOSTIC-VALIDATED.md`.

## Estados usados
- REAL: testado e funcional ponta a ponta no ambiente atual.
- PARTIAL: funciona com limitação documentada.
- BLOCKED: depende de credencial/serviço/binário indisponível; motivo + desbloqueio abaixo.
- TODO: ainda não implementado.

## Fases (14)

| Fase | Escopo | Estado | Nota |
|---|---|---|---|
| 1 | Reconhecimento e planejamento | PARTIAL | Este STATUS + recon/features.csv + ADRs criados; auditoria das branches concluída com evidência. |
| 2 | Arquitetura e estrutura | TODO | Estrutura-alvo definida em ADR-0001; monorepo real ainda é o da branch ci/cd, não consolidado. |
| 3 | Autenticação e banco | PARTIAL | JWT+8 models+migrations existem na branch `ci/cd-authentication-audit-5d2e3` com 9/9 testes passando (build/test executados em clone limpo). BLOCKED para migrate/e2e contra Postgres real: sem Docker e porta 5432 fechada neste host. |
| 4 | Dashboard e projetos | PARTIAL | CRUD projects.service.ts + spec (5 testes verdes) na ci/cd. UI de dashboard/listagem ainda mínima. |
| 5 | Provedores de IA | PARTIAL | Protótipo multimodelo REAL como biblioteca em `/workspace/packages/ai-core` (OpenAI-compatible, Anthropic, Ollama, custom; build exit 0; 25/25 vitest). No repo GitHub só existe OllamaProvider simples. Chamada real a provider: BLOCKED (Ollama down 11434; sem OPENAI_API_KEY/ANTHROPIC_API_KEY no host). |
| 6 | Chat e modos | TODO | Chat existente (ci/cd) chama Ollama direto do browser, sem backend nem persistência server-side de provider; modos PLAN/CHAT/BUILD inexistentes. |
| 7 | Agente com ferramentas | TODO | Nada implementado. |
| 8 | Editor Monaco | TODO | Editor atual = `<textarea>` (evidência: `IDEWorkspace.tsx:120`). Monaco zero ocorrências no repo. |
| 9 | Execução e preview | BLOCKED | WebContainer NÃO existe em nenhuma branch (grep global = 0 ocorrências; alegação do hand-off refutada). Sandbox exige decisão ADR + infra (Docker ausente neste host). |
| 10 | Histórico e restauração | PARTIAL | Models ProjectVersion + snapshots presentes no schema ci/cd; UI/diff/restauração não comprovados. |
| 11 | GitHub integração | TODO | Zero código de OAuth/GitHub API em todas as branches. |
| 12 | Segurança e testes | PARTIAL | 9 testes api+ai-core verdes na ci/cd; auth com bcryptjs/passport-jwt. Sem Playwright, sem axe, sem teste formal de isolamento 2-usuários. npm audit não rodou nas branches (pendente). |
| 13 | Monetização | TODO | Stripe: zero código. Preços: decisão do proprietário, não inventar. |
| 14 | Deploy | BLOCKED | Nenhuma publicação sem autorização explícita do proprietário (R3). |

## Capacidades-chave (melhor branch = ci/cd-authentication-audit-5d2e3, commit 6440cbd)

| Capacidade | Status | Evidência / Desbloqueio |
|---|---|---|
| Auth JWT (register/login/guard) | PARTIAL → REAL com Postgres | código + 5 testes jest verdes; desbloqueio e2e: DATABASE_URL acessível |
| CRUD projetos/arquivos/chat persistidos | PARTIAL | services + spec verdes; migrations init+phase4 existem |
| Chat com IA real | BLOCKED | ChatPanel.tsx:30 aponta para http://localhost:11434 (porta fechada; `OLLAMA DOWN`). Desbloqueio: instalar Ollama + `ollama pull llama3.2` OU configurar OPENAI_API_KEY via env (R4) |
| ai-core multimodelo | REAL (biblioteca, fora do repo GitHub) | /workspace/packages/ai-core: `tsc` exit 0, vitest "Tests 25 passed (25)" (reexecutado nesta sessão) |
| Provider cloud OpenAI/Anthropic | PARTIAL (adaptadores prontos e testados com fetch mockado; chamada real BLOCKED por credencial) | desbloqueio: usuário define OPENAI_API_KEY / ANTHROPIC_API_KEY no .env local — nunca no chat/repo |
| OllamaProvider | PARTIAL | adaptador existe; healthCheck real falha <2s pois serviço está down |
| Monaco editor | TODO | substituição do textarea aprovada em ADR-0004; exige nova dependência → autorização R3 antes de `pnpm add` |
| Preview/WebContainer | BLOCKED | refutado que exista; decisão ADR-0003 pendente de viabilidade (Docker ausente) |
| Skills Replica (`replica-skill-main/`) | TODO/BLOCKED | pack NÃO existe no repo GitHub nem no workspace; scripts parity.py/sweep.py/etc. ausentes. Proprietário precisa fornecer o pack |
| Prisma engines download | OK neste host | binaries.prisma.sh acessível (alegação anterior REFUTADA) |
| Docker | BLOCKED | `bash: docker: command not found` |
| CI GitHub Actions | PARTIAL | `.github/workflows/ci.yml` presente na ci/cd; status de execução real requer acesso à aba Actions (não verificado) |

## Decisões registradas (ADRs)
- ADR-0001: base de trabalho = branch `ci/cd-authentication-audit-5d2e3` (única verde); imports seletivos de arch/editor-mvp; merge total proibido.
- ADR-0002: schema Prisma canônico = ci/cd (8 models + 2 migrations).
- ADR-0003: preview isolado — candidatos WebContainer vs container efêmero; decisão final na Fase 9 (host atual sem Docker).
- ADR-0004: editor = Monaco substituindo textarea, com gate de autorização de dependência.
- ADR-0005: camada IA = interface AIProvider do protótipo /workspace/packages/ai-core; Ollama primeiro, OpenAI-compatible segundo; chaves BYOK via EncryptedCredential.

## Riscos conhecidos
1. editor-mvp tem lockfile dessincronizado e build quebrado — nunca usar como base.
2. Duplicação AIConfigForm em 2 paths na branch arch — deduplicar ao importar.
3. Chat client-side direto ao provider vaza configuração para o browser — mover para API na Fase 6.
4. `postcss.config.js` da main/arch quebra build web (erro literal capturado no diagnóstico); o da ci/cd está correto — mais um motivo para a base ci/cd.
