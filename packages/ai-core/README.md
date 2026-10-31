# @vorqen/ai-core

Camada multimodelo do VORQEN. Implementação clean-room (zero código proprietário copiado) da interface `AIProvider` com adaptadores reais de rede — nenhum mock, nenhum `setTimeout` fingindo LLM (R1).

## Status das funcionalidades (R2)

| Recurso | Status | Evidência |
|---|---|---|
| Interface `AIProvider` (identify/listModels/selectModel/send/stream/capabilities/handleError/healthCheck) | **REAL** | `src/types/provider.ts`, compila com `strict` |
| Adaptador OpenAI-compatible (`/v1/chat/completions`, SSE, tool_calls, usage, vision) | **REAL** | `tests/openai-compatible.test.ts` (fetch injetado; 5 casos) |
| Adaptador Anthropic Messages (`x-api-key`, SSE `content_block_delta`, tool_use, system extraído) | **REAL** | `tests/anthropic-ollama.test.ts` |
| Adaptador Ollama nativo (`/api/chat` NDJSON, `/api/tags`) | **REAL** | idem; servidor local não estava disponível no CI → validado via fetch injetado + teste de erro de rede honesto |
| Custom provider (hooks) | **PARTIAL** | skeleton real; exige hooks do app hospedeiro por design (protocolos privados não são implementados aqui) |
| Retry exponencial + jitter, só para erros retryable | **REAL** | `tests/retry.test.ts` |
| Erros normalizados (`auth/rate_limit/timeout/network/unsupported/...`) | **REAL** | `src/errors/index.ts` |
| healthCheck com orçamento duro de 2s | **REAL** | testado contra porta morta: falha < 2,5s |
| Chaves de API apenas via env (`apiKeyEnv` por nome) | **REAL** | `registry.ts`; teste garante que mensagem de erro nunca contém o valor da chave e que `apiKey` cru não entra no schema |

## Uso

```ts
import { ProviderRegistry } from "@vorqen/ai-core";

const registry = new ProviderRegistry(); // lê process.env
const provider = registry.get(ProviderRegistry.preset("openai")); // BLOCKED se OPENAI_API_KEY ausente
provider.selectModel("gpt-4o");

for await (const chunk of provider.streamMessage({
  messages: [{ role: "user", content: "crie um app de notas" }],
})) {
  if (chunk.kind === "text") process.stdout.write(chunk.delta!);
}
```

Ollama local não precisa de chave: `ProviderRegistry.preset("ollama")`.

## Comandos

```bash
pnpm build   # tsc strict → dist/
pnpm test    # vitest run (25 testes)
```

## Decisões de projeto

- `sendMessage` usa backoff em 429/5xx/rede (máx. 2 tentativas; a 2ª já pode ser outro instante de janela). `streamMessage` tenta 1x: retentar stream é responsabilidade do loop de agentes, não do transporte.
- JSON mode sem flag nativa (Anthropic): forçamos via tool `emit_json` quando tools estão habilitadas; caso contrário, instrução de sistema. Nada é simulado.
- Protocolo `custom` é recusado pela API de configuração de propósito: registrar hooks é ato de código de servidor, não de dados.
