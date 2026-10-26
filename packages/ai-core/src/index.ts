/**
 * Registry provider-agnostic. Futuros adaptadores (OpenAI, Anthropic)
 * apenas implementam AiProviderAdapter e se registram aqui.
 */
import { AiProviderAdapter, AiProviderId } from './types';
import { OllamaLocalProvider } from './providers/ollama';

const registry = new Map<AiProviderId, AiProviderAdapter>();

export function registerProvider(adapter: AiProviderAdapter): void {
  registry.set(adapter.id, adapter);
}

export function getProvider(id: AiProviderId): AiProviderAdapter {
  const adapter = registry.get(id);
  if (!adapter) {
    throw new Error(`Provider "${id}" não registrado em ai-core.`);
  }
  return adapter;
}

export function listRegisteredProviders(): AiProviderId[] {
  return [...registry.keys()];
}

// MVP — Opção A: apenas Ollama local.
registerProvider(new OllamaLocalProvider());

export * from './types';
export { OllamaLocalProvider };
