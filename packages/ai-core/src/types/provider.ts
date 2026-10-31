import type {
  ChatChunk,
  ChatRequest,
  ChatResponse,
  HealthReport,
  ModelInfo,
  NormalizedError,
  ProviderCapabilities,
  ProviderIdentity,
} from "./chat.js";

/**
 * The single contract every VORQEN provider adapter implements.
 *
 * Design notes (clean-room, derived from public API docs of each vendor):
 * - All network calls must honor `req.signal` and internal timeouts.
 * - `streamMessage` must be safe to break out of early (generator .return()).
 * - Adapters normalize their own errors via `handleError`; callers should only
 *   ever see `NormalizedError`.
 * - `healthCheck` has a hard 2s budget (R: pipeline contract) — it must fail
 *   fast so the UI can show provider status without blocking chat.
 */
export interface AIProvider {
  identify(): ProviderIdentity;
  listModels(): Promise<ModelInfo[]>;
  selectModel(modelId: string): void;
  readonly currentModel: string;
  sendMessage(req: ChatRequest): Promise<ChatResponse>;
  streamMessage(req: ChatRequest): AsyncIterable<ChatChunk>;
  reportCapabilities(): ProviderCapabilities;
  handleError(err: unknown): NormalizedError;
  healthCheck(): Promise<HealthReport>;
}
