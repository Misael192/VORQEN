'use client';

import { Ollama } from 'ollama/browser';

export type ChatRole = 'user' | 'assistant';

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

export interface ILLMProvider {
  streamChat(input: {
    prompt: string;
    history: ChatHistoryMessage[];
    model: string;
  }): ReadableStream<string>;
}

export interface OllamaProviderOptions {
  baseURL: string;
  fetch?: typeof fetch;
}

const SYSTEM_PROMPT = `You are VORQEN, a coding assistant. Return only strict JSON, with no markdown fences or additional text, in exactly this shape:
{"files":[{"path":"src/App.tsx","content":"..."}]}

The files property must be an array. Every file must have a relative path and a string content. Do not include fields other than files, path, and content.`;

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

  constructor(options: OllamaProviderOptions) {
    const baseURL = options.baseURL.trim().replace(/\/+$/, '');

    if (!baseURL) {
      throw new OllamaConnectionError('Informe a URL da instância local do Ollama.');
    }

    try {
      const url = new URL(baseURL);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Unsupported protocol');
      }
    } catch (cause) {
      throw new OllamaConnectionError('A URL da instância Ollama é inválida.', { cause });
    }

    this.client = new Ollama({ host: baseURL, fetch: options.fetch });
  }

  streamChat(input: {
    prompt: string;
    history: ChatHistoryMessage[];
    model: string;
  }): ReadableStream<string> {
    const model = input.model.trim();
    if (!model) {
      throw new Error('Selecione um modelo Ollama antes de enviar a mensagem.');
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...input.history.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: input.prompt },
    ];
    const client = this.client;
    let iterator: AsyncIterator<{ message: { content: string } }> | undefined;

    return new ReadableStream<string>({
      async pull(controller: ReadableStreamDefaultController<string>) {
        try {
          if (!iterator) {
            const response = await client.chat({
              model,
              messages,
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

          const content = result.value.message.content;
          if (content) controller.enqueue(content);
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