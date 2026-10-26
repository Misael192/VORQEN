import { describe, it, expect, vi } from 'vitest';
import { OllamaProvider, OllamaConnectionError } from './OllamaProvider';

/** fetch simulado que reproduz um erro de rede (ex.: Ollama desligado ou CORS). */
function failingFetch(): typeof fetch {
  return vi.fn(async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
}

describe('OllamaProvider.testConnection', () => {
  it('retorna false quando ocorre erro de rede (sem lançar exceção)', async () => {
    const provider = new OllamaProvider('http://localhost:11434', failingFetch());

    await expect(provider.testConnection()).resolves.toBe(false);
  });

  it('retorna true quando o Ollama responde com sucesso', async () => {
    const okFetch = vi.fn(async () =>
      new Response(JSON.stringify({ models: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const provider = new OllamaProvider('http://localhost:11434', okFetch);

    await expect(provider.testConnection()).resolves.toBe(true);
  });

  it('lança OllamaConnectionError em listModels quando a rede falha', async () => {
    const provider = new OllamaProvider('http://localhost:11434', failingFetch());

    await expect(provider.listModels()).rejects.toBeInstanceOf(OllamaConnectionError);
  });

  it('rejeita URLs inválidas no construtor', () => {
    expect(() => new OllamaProvider('ftp://invalido')).toThrow(OllamaConnectionError);
  });
});
