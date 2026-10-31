# ADR-0003 — Preview/execução isolada: decisão adiada para Fase 9

Data: 2026-10-31 · Status: ADIADO-BLOCKED (registrado com candidatos)

## Contexto
Nenhuma branch do repo contém WebContainer, Monaco ou sandbox (grep global = 0 ocorrências; alegação de hand-off "IDE com WebContainer" foi REFUTADA com evidência). O prompt mestre proíbe executar código de usuário no processo da API.

## Candidatos (avaliar na Fase 9)
1. WebContainer (@webcontainer/api): roda no browser, sem custo de infra; limitações (npm registry próprio, sem processos nativos, requer https/COOP-COEP headers). Não testado neste host ainda.
2. Container Docker efêmero por projeto: isolamento forte; BLOCKED aqui — `bash: docker: command not found`.
3. Serviço externo de sandbox: avalia-se custo/privacidade quando houver requisito.

## Decisão parcial
Nenhum preview simulado será entregue enquanto a opção real não estiver implementada e testada (R1). Até lá, capacidade marcada BLOCKED com esta lista de desbloqueio. Gate de mudança de infraestrutura exige autorização (R3).
