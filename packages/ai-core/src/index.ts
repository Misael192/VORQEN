import { OllamaProvider } from './providers/OllamaProvider';
import type { ILLMProvider } from './types';

export type ProviderType = 'ollama' | 'openai' | 'anthropic';

export function createProvider(type: ProviderType, baseUrl?: string): ILLMProvider {
  if (type === 'ollama') return new OllamaProvider(baseUrl);
  throw new Error(`Provedor "${type}" ainda não implementado.`);
}

export * from './types';
export * from './providers/OllamaProvider';