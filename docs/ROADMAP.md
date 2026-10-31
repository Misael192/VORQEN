# VORQEN AI Studio — ROADMAP

Fonte de verdade do estado: `docs/STATUS.md`. Este arquivo fixa fases e critérios (gates). Atualizado 2026-10-31.

| Fase | Gate de conclusão | Estado |
|---|---|---|
| 1 Reconhecimento | diagnóstico com evidência + STATUS + recon/features.csv + ADRs | **CONCLUÍDA** (DIAGNOSTIC-VALIDATED.md, 5 ADRs, recon.md, features.csv; revalidado em clone limpo nesta sessão) |
| 2 Arquitetura/estrutura | branch `base/studio` criada da ci/cd; imports seletivos aplicados; `pnpm -r run build` e `test` verdes na nova base | TODO (aguarda autorização — cria branch local, sem push) |
| 3 Banco/auth | `prisma migrate deploy` ok; register/login/logout testados contra Postgres real; isolamento 2 usuários comprovado | BLOCKED por infra (sem Docker/Postgres; desbloqueio: DATABASE_URL ou instalar Docker) |
| 4 Dashboard/projetos | criar/listar/abrir/renomear/excluir persistido e testado | PARTIAL (services+specs na ci/cd; falta UI/e2e) |
| 5 Provedores IA | ≥1 provider real ponta a ponta (chamada real), erros honestos, sem simulação | PARTIAL/BLOCKED (adaptadores prontos+testados com fetch mock; chamada real exige Ollama up ou OPENAI_API_KEY no .env) |
| 6 Chat/modos | resposta real persistida via API; PLAN/CHAT não escrevem; BUILD autoriza | TODO |
| 7 Agente/ferramentas | tarefa autorizada gera arquivos reais verificáveis; tool calls auditados | TODO |
| 8 Editor | Monaco abre/edita/salva arquivo real; diff visível | TODO |
| 9 Execução/preview | app de teste roda isolado e preview reflete edição | BLOCKED (decisão sandbox após infra; nunca iframe falso) |
| 10 Histórico/restauração | diff entre versões + restauração sem apagar histórico | PARTIAL (models existem; fluxo não comprovado) |
| 11 GitHub | OAuth+import+commit testados em repo de teste | TODO |
| 12 Segurança/testes | zero S1/S2 nos fluxos cobertos; axe+Playwright executados | TODO |
| 13 Monetização | só com preços aprovados pelo proprietário; Stripe test-mode | TODO |
| 14 Deploy | preflight + autorização explícita + smoke | BLOCKED por regra (R3) |

Regra de progressão: uma fatia vertical por vez; gate não executável = BLOCKED documentado, nunca sucesso simulado.
