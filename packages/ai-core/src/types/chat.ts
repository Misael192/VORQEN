/**
 * Core shared types for the VORQEN multi-model AI layer.
 * Clean-room implementation — written from scratch against public provider docs.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export type ContentPartType = "text" | "image";

export interface TextPart {
  type: "text";
  text: string;
}

/**
 * Image input. Either a base64 data URL (`dataUrl`) or an absolute https URL.
 * Providers without vision support must reject requests containing image parts
 * (see `reportCapabilities().vision`).
 */
export interface ImagePart {
  type: "image";
  /** e.g. "image/png" */
  mimeType?: string;
  dataUrl?: string;
  url?: string;
  alt?: string;
}

export type ContentPart = TextPart | ImagePart;

export interface ChatMessage {
  role: Role;
  /** Plain string for text-only messages, or structured parts for multimodal input. */
  content: string | ContentPart[];
  name?: string;
  /** Provider-side tool call id, when role === "tool". */
  toolCallId?: string;
}

export interface ToolDefinition {
  /** Stable name the model must use to invoke this tool. */
  name: string;
  description: string;
  /** JSON Schema describing the tool arguments. */
  parameters: Record<string, unknown>;
}

export type ResponseFormat = "text" | "json";

export interface ChatRequest {
  messages: ChatMessage[];
  /** Overrides the provider's currently selected model for this call only. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  responseFormat?: ResponseFormat;
  /** Abort signal forwarded to the underlying fetch. */
  signal?: AbortSignal;
  /** Free-form passthrough merged into the provider request body. */
  extra?: Record<string, unknown>;
}

export interface UsageReport {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Parsed arguments object (providers stream raw JSON strings; we parse once). */
  args: Record<string, unknown>;
  rawArguments?: string;
}

export interface ChatResponse {
  text: string;
  model: string;
  providerId: string;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | "error" | "unknown";
  toolCalls: ToolCall[];
  usage?: UsageReport;
  /** Raw provider payload kept for debugging; never contains secrets. */
  raw?: unknown;
}

export type ChunkKind = "text" | "tool_call" | "done";

export interface ChatChunk {
  kind: ChunkKind;
  /** Incremental text (kind === "text"). */
  delta?: string;
  /** Completed tool call, emitted once with kind === "tool_call". */
  toolCall?: ToolCall;
  /** Terminal metadata on the final `done` chunk. */
  finish?: {
    finishReason: ChatResponse["finishReason"];
    usage?: UsageReport;
    model?: string;
  };
}

export interface ModelInfo {
  id: string;
  vendor: string;
  contextWindow?: number;
  /** Whether the model accepts image inputs (best-effort static table). */
  vision?: boolean;
  createdAt?: string;
}

export interface ProviderCapabilities {
  tools: boolean;
  vision: boolean;
  jsonMode: boolean;
  maxContext: number;
  streaming: boolean;
}

export type NormalizedErrorKind =
  | "auth" // 401/403 / invalid key
  | "rate_limit" // 429
  | "timeout" // client-side deadline exceeded
  | "network" // DNS/connect failure
  | "invalid_request" // 400/422
  | "not_found" // 404 model/endpoint
  | "server" // 5xx
  | "unsupported" // feature not available for this provider/model
  | "unknown";

export interface NormalizedError {
  kind: NormalizedErrorKind;
  message: string;
  statusCode?: number;
  providerId: string;
  retryable: boolean;
  /** Original error, kept out of serialized output. */
  cause?: unknown;
}

export interface HealthReport {
  ok: boolean;
  latencyMs: number;
  detail?: string;
  checkedAt: string;
}

export interface ProviderIdentity {
  id: string;
  vendor: string;
  protocol: string;
  docsUrl: string;
}
