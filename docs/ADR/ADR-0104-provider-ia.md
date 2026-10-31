# ADR-0104 — Provider de IA prioritário (DECISÃO PENDENTE DO USUÁRIO)

Data: 2026-10-31 · Status: PROPOSTO — apresenta opções e pergunta; não decide sozinho

## Estado verificado
- Único adaptador no repo (todas as branches funcionais): `packages/ai-core/src/providers/OllamaProvider.ts` — host default `http://localhost:11434` (linha 39), SDK `ollama`. **Nenhum provider cloud implementado em nenhuma branch** (grep OpenAI/Anthropic/Gemini = zero adaptadores).
- Protótipo multimodelo fora do repo GitHub, testado neste ambiente: `/workspace/packages/ai-core` — interface AIProvider comum + OpenAICompatible + Anthropic + Ollama + registry + retry; **25/25 testes vitest passando**, tsc exit 0.
- Host atual: porta 11434 fechada (Ollama down), sem chaves cloud no env.

## Opções reais (sem inventar capacidade)
| # | Opção | O que exige de você | Vantagem | Limitação |
|---|---|---|---|---|
| A | **Ollama local primeiro** | instalar Ollama + `ollama pull llama3.2` (ou modelo que preferir) | zero custo, dados locais, código JÁ existe no repo e tem testes | qualidade inferior p/ geração de app grande; precisa máquina com recursos |
| B | **OpenAI-compatible primeiro** (OpenAI oficial OU OpenRouter/Groq/DeepSeek via baseURL) | `OPENAI_API_KEY` (ou equivalente) no `.env` — nunca colar no chat | melhor qualidade p/ tool-calling; adaptador pronto e testado no protótipo | custo por token; dado sai da máquina |
| C | **Anthropic primeiro** | `ANTHROPIC_API_KEY` no `.env` | forte em código; adaptador pronto e testado no protótipo | custo; sem listModels dinâmica rica |

## Recomendação
Comenzar por **A (Ollama)** para validar o pipeline fim-a-fim sem custo e sem espera de credencial, e imediatamente depois plugar **B** como provider principal de qualidade (BYOK). Os três convivem via registry do protótipo — a escolha de prioridade muda a ordem de teste, não a arquitetura.

## Pergunta ao usuário
1. Qual vai primeiro: A, B ou C?
2. Se B/C: qual endpoint/modelo padrão (ex.: `gpt-4o-mini`, `claude-sonnet-4-5`, `openrouter/deepseek-v3`)? 
3. Confirma portar o protótipo `/workspace/packages/ai-core` para dentro do repo (substituindo o pacote atual, preservando `ollama.spec.ts`)? Isso adiciona dependências de dev (vitest) ao pacote — aguardando OK (R3).
