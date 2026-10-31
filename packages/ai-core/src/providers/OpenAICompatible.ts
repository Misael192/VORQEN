import type {
  ChatChunk,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  HealthReport,
  ImagePart,
  ModelInfo,
  NormalizedError,
  ProviderCapabilities,
  ProviderIdentity,
  ToolCall,
} from "../types/chat.js";
import type { AIProvider as AIProviderContract } from "../types/provider.js";
import { ProviderError, kindFromStatus, withRetry } from "../errors/index.js";
import { sseIterable } from "../utils/sse.js";
import { partsOf } from "../utils/messages.js";

export interface OpenAICompatibleConfig {
  /** Unique instance id, e.g. "openai", "groq", "together". */
  id: string;
  vendor: string;
  baseUrl: string;
  /** Resolved API key (from env by the registry). Never logged. */
  apiKey?: string;
  defaultModel: string;
  docsUrl?: string;
  capabilities?: Partial<ProviderCapabilities>;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

const DEFAULT_CAPS: ProviderCapabilities = {
  tools: true,
  vision: true,
  jsonMode: true,
  streaming: true,
  maxContext: 128_000,
};

/**
 * Adapter for the OpenAI wire protocol (/v1/chat/completions + /v1/models),
 * which is also the de-facto compatible surface used by Groq, Together,
 * DeepSeek, LM Studio and many others. Written from the public API reference.
 */
export class OpenAICompatibleProvider implements AIProviderContract {
  readonly currentModel: string;
  private cfg: OpenAICompatibleConfig;
  private caps: ProviderCapabilities;
  private doFetch: typeof fetch;

  constructor(cfg: OpenAICompatibleConfig) {
    this.cfg = cfg;
    this.currentModel = cfg.defaultModel;
    this.caps = { ...DEFAULT_CAPS, ...cfg.capabilities };
    this.doFetch = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  identify(): ProviderIdentity {
    return {
      id: this.cfg.id,
      vendor: this.cfg.vendor,
      protocol: "openai-compatible",
      docsUrl: this.cfg.docsUrl ?? "https://platform.openai.com/docs/api-reference/chat",
    };
  }

  selectModel(modelId: string): void {
    if (!modelId.trim()) throw new ProviderError({ kind: "invalid_request", message: "empty model id", providerId: this.cfg.id });
    (this as { currentModel: string }).currentModel = modelId;
  }

  reportCapabilities(): ProviderCapabilities {
    return { ...this.caps };
  }

  async listModels(): Promise<ModelInfo[]> {
    const json = await this.request<{ data?: Array<{ id: string; created?: number }> }>(
      `${this.base()}/models`,
      undefined,
      "GET"
    );
    return (json.data ?? []).map((m) => ({
      id: m.id,
      vendor: this.cfg.vendor,
      createdAt: m.created ? new Date(m.created * 1000).toISOString() : undefined,
      vision: /vision|gpt-4o|gpt-4\.1|claude|gemini/i.test(m.id) || undefined,
    }));
  }

  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    this.assertSupported(req);
    const body = this.buildBody(req, false);
    const json = await this.request<OpenAICompletion>(`${this.base()}/chat/completions`, body);
    return this.toResponse(json);
  }

  async *streamMessage(req: ChatRequest): AsyncIterable<ChatChunk> {
    this.assertSupported(req);
    const body = { ...this.buildBody(req, true), stream_options: { include_usage: true } };
    const res = await withRetry(
      () => this.rawFetch(`${this.base()}/chat/completions`, body, "POST", req.signal),
      { attempts: 2, signal: req.signal }
    );
    if (!res.ok || !res.body) throw await this.httpError(res);
    let finish: ChatResponse["finishReason"] = "unknown";
    let usage: ChatResponse["usage"];
    let model = req.model ?? this.currentModel;
    // Accumulate tool-call deltas per index.
    const partialCalls = new Map<number, { id: string; name: string; args: string }>();

    for await (const ev of sseIterable(res.body)) {
      if (ev.data === "[DONE]") break;
      let parsed: OpenAIStreamChunk;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        continue;
      }
      if (parsed.usage) usage = normalizeUsage(parsed.usage);
      if (parsed.model) model = parsed.model;
      const choice = parsed.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta;
      if (delta?.content) yield { kind: "text", delta: delta.content };
      for (const tc of delta?.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        const cur = partialCalls.get(idx) ?? { id: "", name: "", args: "" };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        partialCalls.set(idx, cur);
      }
      if (choice.finish_reason) {
        finish = mapFinish(choice.finish_reason);
        for (const [, p] of partialCalls) {
          yield { kind: "tool_call", toolCall: toToolCall(p) };
        }
        yield { kind: "done", finish: { finishReason: finish, usage, model } };
      }
    }
  }

  handleError(err: unknown): NormalizedError {
    if (err instanceof ProviderError) return err.toNormalized();
    if (err instanceof Error && err.name === "AbortError") {
      return new ProviderError({ kind: "timeout", message: "request aborted/timed out", providerId: this.cfg.id }).toNormalized();
    }
    if (err instanceof TypeError) {
      return new ProviderError({ kind: "network", message: String(err.message), providerId: this.cfg.id }).toNormalized();
    }
    return new ProviderError({ kind: "unknown", message: String(err), providerId: this.cfg.id }).toNormalized();
  }

  async healthCheck(): Promise<HealthReport> {
    const started = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000); // hard 2s budget
    try {
      const res = await this.rawFetch(`${this.base()}/models`, undefined, "GET", ctrl.signal);
      return {
        ok: res.ok,
        latencyMs: Date.now() - started,
        detail: res.ok ? "models endpoint reachable" : `HTTP ${res.status}`,
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        detail: this.handleError(e).message,
        checkedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(t);
    }
  }

  // ── internals ────────────────────────────────────────────────────────────

  private base(): string {
    return this.cfg.baseUrl.replace(/\/+$/, "");
  }

  private assertSupported(req: ChatRequest): void {
    const hasImg = req.messages.some((m) => partsOf(m).some((p) => p.type === "image"));
    if (hasImg && !this.caps.vision) {
      throw new ProviderError({
        kind: "unsupported",
        message: `provider "${this.cfg.id}" does not support image inputs`,
        providerId: this.cfg.id,
      });
    }
    if (req.tools?.length && !this.caps.tools) {
      throw new ProviderError({
        kind: "unsupported",
        message: `provider "${this.cfg.id}" does not support tool calling`,
        providerId: this.cfg.id,
      });
    }
  }

  private buildBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: req.model ?? this.currentModel,
      messages: req.messages.map(toWireMessage),
      stream,
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.tools?.length) {
      body.tools = req.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }
    if (req.responseFormat === "json") {
      if (!this.caps.jsonMode) {
        throw new ProviderError({ kind: "unsupported", message: "json mode not supported", providerId: this.cfg.id });
      }
      body.response_format = { type: "json_object" };
    }
    if (req.extra) Object.assign(body, req.extra);
    return body;
  }

  private async rawFetch(url: string, body: unknown, method: "GET" | "POST", signal?: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.cfg.apiKey) headers.authorization = `Bearer ${this.cfg.apiKey}`;
    const timeout = this.cfg.requestTimeoutMs ?? 120_000;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      return await this.doFetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  private async request<T>(url: string, body: unknown, method: "GET" | "POST" = "POST", signal?: AbortSignal): Promise<T> {
    // Retry must cover the HTTP-status check too: a 429/5xx is only known
    // after we inspect the response, so wrap fetch+status together.
    const run = async (): Promise<T> => {
      const res = await this.rawFetch(url, body, method, signal);
      if (!res.ok) throw await this.httpError(res);
      return (await res.json()) as T;
    };
    return withRetry(run, { attempts: 2, signal });
  }

  private async httpError(res: Response): Promise<ProviderError> {
    let detail = "";
    try {
      const text = await res.text();
      // never echo back authorization material
      detail = text.slice(0, 500).replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[redacted]");
    } catch {
      /* ignore */
    }
    return new ProviderError({
      kind: kindFromStatus(res.status),
      statusCode: res.status,
      message: `HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
      providerId: this.cfg.id,
    });
  }

  private toResponse(json: OpenAICompletion): ChatResponse {
    const choice = json.choices?.[0];
    const toolCalls = (choice?.message?.tool_calls ?? []).map((tc) =>
      toToolCall({ id: tc.id, name: tc.function?.name ?? "", args: tc.function?.arguments ?? "" })
    );
    return {
      text: choice?.message?.content ?? "",
      model: json.model ?? this.currentModel,
      providerId: this.cfg.id,
      finishReason: mapFinish(choice?.finish_reason),
      toolCalls,
      usage: json.usage ? normalizeUsage(json.usage) : undefined,
    };
  }
}

// Wire types kept local & minimal — only fields we consume.
interface OpenAICompletion {
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null; tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }> };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}
interface OpenAIStreamChunk {
  model?: string;
  usage?: OpenAICompletion["usage"];
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
}

function toWireMessage(m: ChatMessage): Record<string, unknown> {
  if (typeof m.content === "string") {
    return { role: m.role === "tool" ? "tool" : m.role, content: m.content, ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}) };
  }
  const parts = m.content.map((p) => {
    if (p.type === "text") return { type: "text", text: p.text };
    const img = p as ImagePart;
    const url = img.dataUrl ?? img.url;
    if (!url) throw new Error("image part requires dataUrl or url");
    return { type: "image_url", image_url: { url } };
  });
  return { role: m.role, content: parts };
}

function toToolCall(p: { id: string; name: string; args: string }): ToolCall {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = p.args ? JSON.parse(p.args) : {};
  } catch {
    parsed = { _unparseable: p.args };
  }
  return { id: p.id || `call_${Math.random().toString(36).slice(2, 10)}`, name: p.name, args: parsed, rawArguments: p.args };
}

function mapFinish(r?: string): ChatResponse["finishReason"] {
  switch (r) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool_calls";
    case "content_filter":
      return "content_filter";
    default:
      return r ? "unknown" : "unknown";
  }
}

function normalizeUsage(u: NonNullable<OpenAICompletion["usage"]>) {
  return {
    promptTokens: u.prompt_tokens,
    completionTokens: u.completion_tokens,
    totalTokens: u.total_tokens,
  };
}
