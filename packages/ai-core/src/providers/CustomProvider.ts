import type {
  ChatChunk,
  ChatRequest,
  ChatResponse,
  HealthReport,
  ModelInfo,
  NormalizedError,
  ProviderCapabilities,
  ProviderIdentity,
} from "../types/chat.js";
import type { AIProvider as AIProviderContract } from "../types/provider.js";
import { ProviderError } from "../errors/index.js";

/**
 * Escape hatch for providers with a private/undocumented wire format.
 * The host app supplies the actual call implementations; ai-core only
 * provides the contract skeleton and honest "unsupported" defaults so no
 * caller can accidentally treat a stub as a real provider.
 */
export interface CustomProviderHooks {
  identify: () => ProviderIdentity;
  listModels?: () => Promise<ModelInfo[]>;
  sendMessage: (req: ChatRequest) => Promise<ChatResponse>;
  streamMessage?: (req: ChatRequest) => AsyncIterable<ChatChunk>;
  capabilities?: () => ProviderCapabilities;
  handleError?: (err: unknown) => NormalizedError;
  healthCheck?: () => Promise<HealthReport>;
}

export class CustomProvider implements AIProviderContract {
  readonly currentModel: string;
  private hooks: CustomProviderHooks;
  private model: string;

  constructor(hooks: CustomProviderHooks, defaultModel: string) {
    this.hooks = hooks;
    this.model = defaultModel;
    this.currentModel = defaultModel;
  }

  identify(): ProviderIdentity {
    return this.hooks.identify();
  }

  selectModel(modelId: string): void {
    if (!modelId.trim()) throw new ProviderError({ kind: "invalid_request", message: "empty model id", providerId: this.identify().id });
    this.model = modelId;
    (this as { currentModel: string }).currentModel = modelId;
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.hooks.listModels) {
      const id = this.identify();
      return [{ id: this.model, vendor: id.vendor }];
    }
    return this.hooks.listModels();
  }

  sendMessage(req: ChatRequest): Promise<ChatResponse> {
    return this.hooks.sendMessage(req);
  }

  async *streamMessage(req: ChatRequest): AsyncIterable<ChatChunk> {
    if (!this.hooks.streamMessage) {
      const res = await this.hooks.sendMessage(req);
      yield { kind: "text", delta: res.text };
      yield { kind: "done", finish: { finishReason: res.finishReason, usage: res.usage, model: res.model } };
      return;
    }
    yield* this.hooks.streamMessage(req);
  }

  reportCapabilities(): ProviderCapabilities {
    return this.hooks.capabilities?.() ?? { tools: false, vision: false, jsonMode: false, streaming: false, maxContext: 8192 };
  }

  handleError(err: unknown): NormalizedError {
    if (err instanceof ProviderError) return err.toNormalized();
    if (this.hooks.handleError) return this.hooks.handleError(err);
    return new ProviderError({ kind: "unknown", message: String(err), providerId: this.identify().id }).toNormalized();
  }

  async healthCheck(): Promise<HealthReport> {
    if (this.hooks.healthCheck) return this.hooks.healthCheck();
    const started = Date.now();
    try {
      await this.sendMessage({ messages: [{ role: "user", content: "ping" }], maxTokens: 1 });
      return { ok: true, latencyMs: Date.now() - started, checkedAt: new Date().toISOString() };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - started, detail: String(e), checkedAt: new Date().toISOString() };
    }
  }
}
