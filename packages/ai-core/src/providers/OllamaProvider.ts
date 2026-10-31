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
import { ProviderError, kindFromStatus } from "../errors/index.js";


export interface OllamaConfig {
  id?: string;
  /** Local server base, default http://127.0.0.1:11434 */
  baseUrl?: string;
  defaultModel: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

/**
 * Adapter for Ollama's documented REST API (/api/tags, /api/generate,
 * /api/chat). Kept in the canonical stack on purpose: local execution is a
 * first-class target for VORQEN. Any branch that deletes this adapter is
 * incompatible with the multi-model architecture — do not merge such a branch.
 */
export class OllamaProvider implements AIProviderContract {
  readonly currentModel: string;
  private readonly id: string;
  private readonly baseUrl: string;
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(cfg: OllamaConfig) {
    this.id = cfg.id ?? "ollama";
    this.baseUrl = (cfg.baseUrl ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
    this.currentModel = cfg.defaultModel;
    this.doFetch = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = cfg.requestTimeoutMs ?? 300_000; // local models can be slow on CPU
  }

  identify(): ProviderIdentity {
    return {
      id: this.id,
      vendor: "Ollama",
      protocol: "ollama-native",
      docsUrl: "https://github.com/ollama/ollama/blob/main/docs/api.md",
    };
  }

  selectModel(modelId: string): void {
    if (!modelId.trim()) throw new ProviderError({ kind: "invalid_request", message: "empty model id", providerId: this.id });
    (this as { currentModel: string }).currentModel = modelId;
  }

  reportCapabilities(): ProviderCapabilities {
    // Native /api/chat has no tool protocol on most local models; vision
    // depends on the pulled model, so we advertise conservatively and let
    // callers pass `extra` for model-specific overrides.
    return { tools: false, vision: true, jsonMode: true, streaming: true, maxContext: 32_768 };
  }

  async listModels(): Promise<ModelInfo[]> {
    const json = await this.json<{ models?: Array<{ name: string; modified_at?: string; details?: { parameter_size?: string } }> }>(
      `${this.baseUrl}/api/tags`,
      undefined,
      "GET"
    );
    return (json.models ?? []).map((m) => ({
      id: m.name,
      vendor: "Ollama",
      createdAt: m.modified_at,
      contextWindow: /7b|13b/i.test(m.details?.parameter_size ?? "") ? 8192 : undefined,
    }));
  }

  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    const body = this.buildBody(req, false);
    const json = await this.json<OllamaChatResponse>(`${this.baseUrl}/api/chat`, body);
    return {
      text: json.message?.content ?? "",
      model: json.model ?? this.currentModel,
      providerId: this.id,
      finishReason: json.done_reason ? mapDone(json.done_reason) : json.done ? "stop" : "unknown",
      toolCalls: [],
      usage: json.prompt_eval_count || json.eval_count
        ? { promptTokens: json.prompt_eval_count, completionTokens: json.eval_count }
        : undefined,
    };
  }

  async *streamMessage(req: ChatRequest): AsyncIterable<ChatChunk> {
    const body = this.buildBody(req, true);
    const res = await this.raw(`${this.baseUrl}/api/chat`, body, req.signal);
    if (!res.ok || !res.body) throw await this.httpError(res);
    // Ollama streams newline-delimited JSON (not SSE).
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = pending.indexOf("\n")) !== -1) {
          const line = pending.slice(0, nl).trim();
          pending = pending.slice(nl + 1);
          if (!line) continue;
          const chunk = JSON.parse(line) as OllamaChatResponse;
          if (chunk.message?.content) yield { kind: "text", delta: chunk.message.content };
          if (chunk.done) {
            yield {
              kind: "done",
              finish: {
                finishReason: chunk.done_reason ? mapDone(chunk.done_reason) : "stop",
                model: chunk.model,
                usage: chunk.prompt_eval_count || chunk.eval_count
                  ? { promptTokens: chunk.prompt_eval_count, completionTokens: chunk.eval_count }
                  : undefined,
              },
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  handleError(err: unknown): NormalizedError {
    if (err instanceof ProviderError) return err.toNormalized();
    if (err instanceof Error && err.name === "AbortError") {
      return new ProviderError({ kind: "timeout", message: "aborted", providerId: this.id }).toNormalized();
    }
    if (err instanceof TypeError) {
      return new ProviderError({
        kind: "network",
        message: `${err.message} — is Ollama running? Try: ollama serve`,
        providerId: this.id,
      }).toNormalized();
    }
    return new ProviderError({ kind: "unknown", message: String(err), providerId: this.id }).toNormalized();
  }

  async healthCheck(): Promise<HealthReport> {
    const started = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    try {
      const res = await this.doFetch(`${this.baseUrl}/api/tags`, { method: "GET", signal: ctrl.signal });
      return {
        ok: res.ok,
        latencyMs: Date.now() - started,
        detail: res.ok ? "ollama reachable" : `HTTP ${res.status}`,
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

  // ── internals ───────────────────────────────────────────────────────────

  private buildBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: req.model ?? this.currentModel,
      messages: req.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : m.content.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join(""),
        images:
          typeof m.content === "string"
            ? undefined
            : m.content
                .filter((p) => p.type === "image")
                .map((p) => {
                  const img = p as { dataUrl?: string; url?: string };
                  const src = img.dataUrl ?? img.url;
                  if (!src) throw new ProviderError({ kind: "invalid_request", message: "image needs dataUrl/url", providerId: this.id });
                  return src.startsWith("data:") ? src.split(",")[1] ?? "" : src;
                }),
      })),
      stream,
    };
    const options: Record<string, unknown> = {};
    if (req.temperature !== undefined) options.temperature = req.temperature;
    if (req.maxTokens !== undefined) options.num_predict = req.maxTokens;
    if (req.responseFormat === "json") options.format = "json";
    if (Object.keys(options).length) body.options = options;
    if (req.extra) Object.assign(body, req.extra);
    return body;
  }

  private async raw(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      return await this.doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  private async json<T>(url: string, body: unknown, method: "GET" | "POST" = "POST"): Promise<T> {
    const res = await this.raw(url, body, undefined);
    if (!res.ok) throw await this.httpError(res);
    return (await res.json()) as T;
  }

  private async httpError(res: Response): Promise<ProviderError> {
    let msg = "";
    try {
      msg = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    return new ProviderError({
      kind: kindFromStatus(res.status),
      statusCode: res.status,
      message: `HTTP ${res.status}${msg ? `: ${msg}` : ""}`,
      providerId: this.id,
    });
  }
}

interface OllamaChatResponse {
  model?: string;
  created_at?: string;
  message?: { role: string; content: string };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

function mapDone(reason: string): ChatResponse["finishReason"] {
  if (reason === "stop" || reason === "eos") return "stop";
  if (reason === "length") return "length";
  return "unknown";
}



