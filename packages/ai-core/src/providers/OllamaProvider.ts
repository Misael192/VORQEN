import { Ollama } from 'ollama/browser';
import type { ILLMProvider, Message } from '../types';

const SYSTEM_PROMPT = `You are VORQEN, a coding assistant. Return only strict JSON with no markdown fences or additional text, in exactly this shape:
{"files":[{"path":"src/App.tsx","content":"..."}]}

The files property must be an array. Every file must have a relative path and string content. Do not include fields other than files, path, and content.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  required: ['files'],
  additionalProperties: false,
};

export class OllamaConnectionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OllamaConnectionError';
  }
}

export class OllamaProvider implements ILLMProvider {
  private readonly client: Ollama;

  constructor(baseUrl = 'http://localhost:11434', fetchImplementation?: typeof fetch) {
    const normalizedUrl = baseUrl.trim().replace(/\/+$/, '');

    try {
      const url = new URL(normalizedUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Unsupported protocol');
      }
    } catch (cause) {
      throw new OllamaConnectionError('A URL da instância Ollama é inválida.', { cause });
    }

    this.client = new Ollama({ host: normalizedUrl, fetch: fetchImplementation });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<{ id: string; name: string }[]> {
    try {
      const response = await this.client.list();
      return response.models.map(({ name }) => ({ id: name, name }));
    } catch (error) {
      throw toConnectionError(error);
    }
  }

  streamChat(messages: Message[], model: string): ReadableStream<string> {
    const selectedModel = model.trim();
    if (!selectedModel) {
      throw new Error('Selecione um modelo Ollama antes de enviar a mensagem.');
    }

    const client = this.client;
    const chatMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
    let iterator: AsyncIterator<{ message: { content: string } }> | undefined;

    return new ReadableStream<string>({
      async pull(controller) {
        try {
          if (!iterator) {
            const response = await client.chat({
              model: selectedModel,
              messages: chatMessages,
              format: RESPONSE_SCHEMA,
              stream: true,
            });
            iterator = response[Symbol.asyncIterator]();
          }

          const result = await iterator.next();
          if (result.done) {
            controller.close();
            return;
          }

          if (result.value.message.content) {
            controller.enqueue(result.value.message.content);
          }
        } catch (error) {
          controller.error(toConnectionError(error));
        }
      },
      cancel: () => client.abort(),
    });
  }
}

function toConnectionError(error: unknown): OllamaConnectionError {
  const cause = error instanceof Error ? error : new Error(String(error));
  const message = cause.message.toLowerCase();
  const isNetworkError =
    cause instanceof TypeError ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('cors');

  if (isNetworkError) {
    return new OllamaConnectionError(
      'Não foi possível conectar ao Ollama local. Verifique se ele está em execução, se a URL está correta e se a origem do VORQEN está permitida em OLLAMA_ORIGINS.',
      { cause },
    );
  }

  return new OllamaConnectionError(`Falha na comunicação com o Ollama: ${cause.message}`, {
    cause,
  });
}