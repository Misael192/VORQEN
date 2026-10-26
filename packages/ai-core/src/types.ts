/**
 * VORQEN — ai-core
 * Camada de abstração provider-agnostic para IA local (Opção A).
 * Toda inferência acontece no navegador -> http://localhost:11434 (Ollama).
 * O backend NestJS NUNCA participa do fluxo de IA.
 */

export type AiProviderId = 'ollama' | 'openai' | 'anthropic';

export interface ProviderConfig {
  id: AiProviderId;
  /** Base URL do provedor. Para Ollama local: http://localhost:11434 */
  baseUrl: string;
  /** Modelo baixado localmente (ex: llama3.1, qwen2.5-coder). */
  model: string;
  /** API key — apenas para provedores de nuvem futuros. Nunca vai ao nosso backend. */
  apiKey?: string;
}

export interface ModelInfo {
  name: string;
  size?: number;
  modifiedAt?: string;
  digest?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  models: ModelInfo[];
  error?: string;
  hints?: string[];
}

export interface ChatMessageDto {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

/** Operações estruturadas de arquivos que o modelo retorna em JSON. */
export interface FileOperation {
  action: 'create' | 'edit' | 'delete';
  path: string;
  content?: string;
}

export interface AiProviderAdapter {
  readonly id: AiProviderId;
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
  testConnection(config: ProviderConfig): Promise<ConnectionTestResult>;
  streamChat(
    config: ProviderConfig,
    messages: ChatMessageDto[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamChunk>;
  generateFileOperations(
    config: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal,
  ): Promise<FileOperation[]>;
}

export class AiCoreError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'CONNECTION_REFUSED'
      | 'CORS_BLOCKED'
      | 'MIXED_CONTENT'
      | 'MODEL_NOT_FOUND'
      | 'INVALID_RESPONSE'
      | 'TIMEOUT',
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiCoreError';
  }
}
