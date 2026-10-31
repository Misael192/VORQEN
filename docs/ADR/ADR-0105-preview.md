# ADR-0105 — Preview: WebContainer vs container server-side (DECISÃO PENDENTE DO USUÁRIO)

Data: 2026-10-31 · Status: PROPOSTO — apresenta opções e pergunta; não decide sozinho

## Estado verificado
- **Nenhuma branch tem preview real.** Evidência: `git grep -il webcontainer origin/vorqen-editor-mvp-d03f4 -- '*.ts*'` → vazio, apesar do commit dizer "WebContainer IDE". Zero ocorrências de `@docker/sdk`, sandbox ou iframe de preview em main/ci-cd/arch. Monaco ausente em todas. Playwright ausente em todas.
- Host atual: `docker: command not found`; sem acesso confirmado a registry externo para imagens.

## Opções reais
| # | Opção | Como funciona | Prós | Contras / requisitos |
|---|---|---|---|---|
| A | **WebContainers (@webcontainer/api)** no browser | Vite/Node rodando no client via SharedArrayBuffer/COOP/COEP | isolamento forte (sandbox do browser); custo zero de servidor; demo rápida | exige cabeçalhos cross-origin isolation no Next; limitações nativas (sem PostgreSQL interno, ports restritos); precisa verificar compatibilidade Node p/ apps gerados |
| B | **Contêineres efêmeros server-side** (Docker per project) | API cria container isolado, roda dev-server, expõe porta via proxy + iframe | executa stack completa (inclui build tools pesadas); fiel ao mundo real | exige host com Docker + política de limites (CPU/mem/tempo/rede); custo operacional; surface de segurança maior |
| C | **Híbrido**: WebContainer para projetos front-only (MVP), container server-side depois | A agora, B quando houver infra | entrega preview funcional mais cedo; escala depois | duas codepaths de preview para manter |

## Recomendação
**Opção A (WebContainers) para o MVP da Fase 9**, porque o produto gera predominantemente apps web (React/Vite/Tailwind — exatamente o domínio dos WebContainers), não exige Docker no host onde você hospedar a API, e o isolamento é inerente. Registrar como gate de spike: prova de conceito rodando um app Vite gerado dentro do WebContainer com COOP/COEP no Next antes de assumir. Se o spike falhar (ex.: dependência npm que precisa native binaries), migramos para C/B com novo ADR.

## Pergunta ao usuário
1. Onde a plataforma será hospedada (você controla o host? há Docker disponível no ambiente-alvo?)? 
2. Aprova o spike WebContainer primeiro (A), ou prefere investir direto em containers server-side (B)?
3. Nada será instalado (`@webcontainer/api`) sem tua autorização de dependência (R3).
