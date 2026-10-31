# ADR-0106 — Execução segura de comandos (allowlist, timeout, limites)

Data: 2026-10-31 · Status: ACEITO como política (implementação na Fase 7; nenhuma execução existe hoje)

## Estado verificado
Hoje não há nenhuma ferramenta de execução no repo (nenhum `child_process`, nenhum runner). O risco é portanto futuro e este ADR define a política ANTES de existir código.

## Política decidida
1. **Nunca executar código de projeto no processo da API Nest.** Execução acontece apenas no ambiente de preview escolhido em ADR-0105 (browser sandbox ou container efêmero). A API orquestra; não executa.
2. **Allowlist explícita de comandos** por ferramenta tipada (`commands.run`): ex. `["npm install <pkg validado>", "pnpm install", "vite build", "next build", "vitest run", "tsc --noEmit"]`. Sem shell string: `spawn(bin, args[], {shell:false})` — proibida interpolação livre.
3. **Validação Zod em toda entrada de ferramenta**: path normalizado e confinado ao diretório do projeto (rejeitar `..`, symlink fora do root, caminhos absolutos), nome de pacote com regex estrita, tamanho máximo de conteúdo.
4. **Limites duros por execução**: timeout padrão 60s (máx 300s), máx output 1MB (truncate + flag), CPU/memória via cgroups/quota do container (server-side) ou limite do próprio WebContainer (browser), rede: allowlist de registries (npm) e nada além disso em BUILD.
5. **Cancelamento**: todo run recebe AbortSignal; UI expõe botão stop; kill garantido com grace period.
6. **Auditoria**: cada tool call registra `{userId, projectId, tool, argsSanitizadas, exitCode, durationMs, ts}` em AgentRun/ToolExecution (nova tabela na Fase 7, via migration aprovada — R3). Nunca logar segredos nem conteúdo completo de arquivos grandes.
7. **Confirmação humana obrigatória** para: deletar arquivo, instalar dependência fora da allowlist, qualquer comando fora do workspace do projeto, push/GitHub, deploy.
8. **Isolamento multi-tenant**: um projeto nunca enxerga FS/porta/env de outro; env vars do backend (DATABASE_URL, JWT_SECRET) jamais injetadas no ambiente de execução do usuário.

## Consequências
- Ferramentas do agente nascem já com contrato + schema + teste de path traversal (Fase 7/12).
- Custo: alguns fluxos ficam mais lentos (confirmações) — aceitável dado o risco.

## Rejeitado
Executar `eval`/shell genérico com LLM decidindo comandos livres: S1 garantido (injection + escape do processo da API).
