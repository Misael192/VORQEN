# ADR-0005 — Camada de IA: interface AIProvider multimodelo

Data: 2026-10-31 · Status: ACEITO (protótipo verificado localmente)

## Decisão
Adotar a interface comum `AIProvider` (identify/listModels/selectModel/sendMessage/streamMessage/reportCapabilities/handleError/healthCheck com timeout 2s) do pacote prototipado `/workspace/packages/ai-core`, verificado nesta sessão: `tsc` exit 0 e `vitest run` → "Test Files 5 passed (5), Tests 25 passed (25)".

Provedores na ordem de prioridade:
1. **Ollama** (existente no repo e no protótipo; único adaptador hoje no GitHub). Chamada real BLOCKED neste host: porta 11434 fechada. Desbloqueio: instalar Ollama + `ollama pull llama3.2`.
2. **OpenAI-compatible** (cobre OpenAI, OpenRouter, Groq, DeepSeek, Together, Mistral, LM Studio, vLLM via baseUrl). Real quando o usuário definir `OPENAI_API_KEY` no .env (R4 — chave nunca no chat/repo/logs).
3. **Anthropic** (adaptador pronto e testado com fetch mockado; real com `ANTHROPIC_API_KEY`).
4. Gemini: TODO — implementar na Fase 5 se escolhido; não declarar suporte sem adaptador real.

## Regras técnicas registradas
- Chat do app deve chamar provider via backend da API (nunca direto do browser como hoje em ChatPanel.tsx:30).
- Chaves BYOK persistidas via EncryptedCredential (schema ci/cd), nunca retornadas completas ao frontend.
- Retry apenas para erros transitórios (rate_limit/network/timeout), sem repetir 401; cancelamento via AbortSignal; logs redigidos de segredos.
- Sem capacidades falsas: reportCapabilities reflete o que o protocolo realmente suporta (ex.: vision negado quando modelo não declara).
