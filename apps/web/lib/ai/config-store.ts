/**
 * VORQEN — helper de persistência local da configuração de IA (Opção A).
 * Fonte única da verdade: localStorage. O backend NUNCA vê esta config.
 * ATENÇÃO: este arquivo NÃO reimplementa o provider — a inferência vive
 * exclusivamente em @vorqen/ai-core (packages/ai-core). Aqui só há I/O de config.
 */
import type { ProviderConfig } from '@vorqen/ai-core';

export const AI_CONFIG_STORAGE_KEY = 'vorqen.ai-provider-config';

const DEFAULT_BASE_URL = 'http://localhost:11434';

interface StoredConfig {
  id: 'ollama';
  baseUrl: string;
  model: string;
}

function fallback(): StoredConfig {
  return { id: 'ollama', baseUrl: DEFAULT_BASE_URL, model: '' };
}

export function readStoredAiConfig(): StoredConfig {
  if (typeof window === 'undefined') return fallback();
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return fallback();
    const parsed = JSON.parse(raw) as Partial<StoredConfig>;
    return {
      id: 'ollama',
      baseUrl: parsed.baseUrl?.trim() || DEFAULT_BASE_URL,
      model: parsed.model?.trim() ?? '',
    };
  } catch {
    return fallback();
  }
}

export function saveAiConfig(config: StoredConfig): void {
  window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

/** Config pronta para o ai-core; retorna null se incompleta (ex: falta modelo). */
export function loadAiProviderConfig(): ProviderConfig | null {
  const stored = readStoredAiConfig();
  if (!stored.baseUrl || !stored.model) return null;
  return { id: stored.id, baseUrl: stored.baseUrl, model: stored.model };
}
