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
import { partsOf, systemPrompt, nonSystem } from "../utils/messages.js";

export interface AnthropicConfig {
  id?: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel: string;
  version?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

const VISION_MODELS = /claude-(3|4|sonnet|opus|haiku)|claude-[3-9]/i;

/**
 * Adapter for the Anthropic Messages API (public docs: docs.anthropic.com).
 * Clean-room implementation of the documented wire format:
 * POST /v1/messages with x-api-key + anthropic-version headers,
 * SSE events: message_start, content_block_{start,delta,stop}, message_delta, message_stop.
 */
export class AnthropicProvider implements AIProviderContract {
  readonly currentModel: string;
  private readonly id: string;
  private readonly baseUrl: string;
  private readonly version: string;
  private readonly apiKey?: string;
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(cfg: AnthropicConfig) {
    this.id = cfg.id ?? "anthropic";
    this.baseUrl = (cfg.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
    this.version = cfg.version ?? "2023-06-01";
    this.apiKey = cfg.apiKey;
    this.currentModel = cfg.defaultModel;
    this.doFetch = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = cfg.requestTimeoutMs ?? 120_000;
  }

  identify(): ProviderIdentity {
    return {
      id: this.id,
      vendor: "Anthropic",
      protocol: "anthropic-messages",
      docsUrl: "https://docs.anthropic.com/en/api/messages",
    };
  }

  selectModel(modelId: string): void {
    if (!modelId.trim()) throw new ProviderError({ kind: "invalid_request", message: "empty model id", providerId: this.id });
    (this as { currentModel: string }).currentModel = modelId;
  }

  reportCapabilities(): ProviderCapabilities {
    const vision = VISION_MODELS.test(this.currentModel);
    return { tools: true, vision, jsonMode: true, streaming: true, maxContext: 200_000 };
  }

  async listModels(): Promise<ModelInfo[]> {
    // /v1/models requires OAuth on some plans; degrade honestly instead of faking.
    const res = await this.raw(`${this.baseUrl}/v1/models`, undefined, "GET");
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError({
        kind: "auth",
        statusCode: res.status,
        message: "model listing requires key with models read scope; set default model explicitly",
        providerId: this.id,
      });
    }
    if (!res.ok) throw await this.httpError(res);
    const json = (await res.json()) as { data?: Array<{ id: string; display_name?: string }> };
    return (json.data ?? []).map((m) => ({
      id: m.id,
      vendor: "Anthropic",
      vision: VISION_MODELS.test(m.id) || undefined,
    }));
  }

  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    const body = this.buildBody(req, false);
    const res = await withRetry(() => this.raw(`${this.baseUrl}/v1/messages`, body, "POST", req.signal), {
      attempts: 2,
      signal: req.signal,
    });
    if (!res.ok) throw await this.httpError(res);
    const json = (await res.json()) as AnthropicCompletion;
    let text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    // If we forced JSON through the emit_json tool, unwrap it.
    const emit = (json.content ?? []).find((b) => b.type === "tool_use" && b.name === "emit_json");
    if (emit && !text) {
      const v = (emit.input as Record<string, unknown> | undefined)?.value;
      if (v !== undefined) text = JSON.stringify(v);
    }
    const toolCalls: ToolCall[] = (json.content ?? [])
      .filter((b) => b.type === "tool_use")
      .map((b) => ({ id: b.id ?? `call_${Math.random().toString(36).slice(2, 10)}`, name: b.name ?? "", args: (b.input as Record<string, unknown>) ?? {} }));
    return {
      text,
      model: json.model ?? this.currentModel,
      providerId: this.id,
      finishReason: mapStop(json.stop_reason),
      toolCalls,
      usage: json.usage
        ? { promptTokens: json.usage.input_tokens, completionTokens: json.usage.output_tokens }
        : undefined,
    };
  }

  async *streamMessage(req: ChatRequest): AsyncIterable<ChatChunk> {
    const body = this.buildBody(req, true);
    const res = await withRetry(() => this.raw(`${this.baseUrl}/v1/messages`, body, "POST", req.signal), {
      attempts: 2,
      signal: req.signal,
    });
    if (!res.ok || !res.body) throw await this.httpError(res);

    // Accumulate tool_use blocks by content index.
    const blocks = new Map<number, { type: string; id?: string; name?: string; json: string }>();
    let usage: ChatResponse["usage"];
    let model = req.model ?? this.currentModel;
    let finish: ChatResponse["finishReason"] = "unknown";

    for await (const ev of sseIterable(res.body)) {
      let data: AnthropicStreamEvent;
      try {
        data = JSON.parse(ev.data);
      } catch {
        continue;
      }
      switch (data.type) {
        case "message_start":
          model = data.message?.model ?? model;
          if (data.message?.usage) {
            usage = { promptTokens: data.message.usage.input_tokens, completionTokens: data.message.usage.output_tokens };
          }
          break;
        case "content_block_start": {
          const cb = data.content_block;
          if (cb?.type === "tool_use") {
            blocks.set(data.index ?? 0, { type: "tool_use", id: cb.id, name: cb.name, json: "" });
          } else if (cb?.type === "text" && cb.text) {
            yield { kind: "text", delta: cb.text };
          }
          break;
        }
        case "content_block_delta": {
          const d = data.delta;
          if (d?.type === "text_delta" && d.text) yield { kind: "text", delta: d.text };
          if (d?.type === "input_json_delta" && d.partial_json) {
            const cur = blocks.get(data.index ?? 0);
            if (cur) cur.json += d.partial_json;
          }
          break;
        }
        case "message_delta":
          if (data.delta?.stop_reason) finish = mapStop(data.delta.stop_reason);
          if (data.usage?.output_tokens !== undefined && usage) {
            usage = { ...usage, completionTokens: data.usage.output_tokens };
          }
          break;
        case "message_stop": {
          for (const [, b] of blocks) {
            if (b.type !== "tool_use") continue;
            let args: Record<string, unknown> = {};
            try {
              args = b.json ? JSON.parse(b.json) : {};
            } catch {
              args = { _unparseable: b.json };
            }
            yield { kind: "tool_call", toolCall: { id: b.id ?? "", name: b.name ?? "", args, rawArguments: b.json } };
          }
          yield { kind: "done", finish: { finishReason: finish, usage, model } };
          break;
        }
        case "error":
          throw new ProviderError({
            kind: "server",
            message: data.error?.message ?? "stream error",
            providerId: this.id,
          });
        default:
          break;
      }
    }
  }

  handleError(err: unknown): NormalizedError {
    if (err instanceof ProviderError) return err.toNormalized();
    if (err instanceof Error && err.name === "AbortError") {
      return new ProviderError({ kind: "timeout", message: "aborted", providerId: this.id }).toNormalized();
    }
    if (err instanceof TypeError) {
      return new ProviderError({ kind: "network", message: err.message, providerId: this.id }).toNormalized();
    }
    return new ProviderError({ kind: "unknown", message: String(err), providerId: this.id }).toNormalized();
  }

  async healthCheck(): Promise<HealthReport> {
    const started = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    try {
      // Cheapest authenticated call: a 1-token generation is not free;
      // use the models endpoint and treat 401/403 as auth failure, 200 as ok.
      const res = await this.doFetch(`${this.baseUrl}/v1/models?limit=1`, {
        method: "GET",
        headers: this.headers(),
        signal: ctrl.signal,
      });
      const ok = res.ok;
      return {
        ok,
        latencyMs: Date.now() - started,
        detail: ok ? "reachable" : `HTTP ${res.status}`,
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - started, detail: String(e), checkedAt: new Date().toISOString() };
    } finally {
      clearTimeout(t);
    }
  }

  // ── internals ───────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json", "anthropic-version": this.version };
    if (this.apiKey) h["x-api-key"] = this.apiKey;
    return h;
  }

  private async raw(url: string, body: unknown, method: "GET" | "POST", signal?: AbortSignal): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      return await this.doFetch(url, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  private async httpError(res: Response): Promise<ProviderError> {
    let msg = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      msg = j.error?.message ?? "";
    } catch {
      /* ignore */
    }
    return new ProviderError({
      kind: kindFromStatus(res.status),
      statusCode: res.status,
      message: `HTTP ${res.status}${msg ? `: ${msg.slice(0, 300)}` : ""}`,
      providerId: this.id,
    });
  }

  private buildBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
    const hasImg = req.messages.some((m) => partsOf(m).some((p) => p.type === "image"));
    if (hasImg && !VISION_MODELS.test(req.model ?? this.currentModel)) {
      throw new ProviderError({ kind: "unsupported", message: "selected Claude model does not accept images", providerId: this.id });
    }
    const body: Record<string, unknown> = {
      model: req.model ?? this.currentModel,
      max_tokens: req.maxTokens ?? 4096, // required by the API
      messages: toAnthropicMessages(nonSystem(req.messages)),
      stream,
    };
    const sys = systemPrompt(req.messages);
    if (sys) body.system = sys;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.tools?.length) {
      body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    }
    if (req.responseFormat === "json") {
      // No dedicated json flag on this API: enforce shape with a forced
      // single-tool call ("emit_json") when tools are allowed, otherwise
      // instruct via system suffix. Both are documented patterns.
      if (this.reportCapabilities().tools) {
        body.tool_choice = { type: "tool", name: "emit_json" };
        const list = (body.tools as Array<Record<string, unknown>> | undefined) ?? [];
        body.tools = [
          ...list,
          {
            name: "emit_json",
            description: "Emit the final answer as a structured JSON object.",
            input_schema: { type: "object", properties: { value: { type: "object", additionalProperties: true } }, required: ["value"] },
          },
        ];
      } else {
        body.system = ((body.system as string | undefined) ?? "") + "\nRespond ONLY with a valid JSON object, no prose, no code fences.";
      }
    }
    if (req.extra) Object.assign(body, req.extra);
    return body;
  }
}

function toAnthropicMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: typeof m.content === "string" ? m.content : "" }],
      });
      continue;
    }
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const parts = m.content.map((p) => {
      if (p.type === "text") return { type: "text", text: p.text };
      const img = p as ImagePart;
      if (img.dataUrl) {
        const [meta, data] = img.dataUrl.split(",");
        const mime = /data:(.*?);/.exec(meta ?? "")?.[1] ?? img.mimeType ?? "image/png";
        return { type: "image", source: { type: "base64", media_type: mime, data } };
      }
      if (img.url) return { type: "image", source: { type: "url", url: img.url } };
      throw new Error("image part requires dataUrl or url");
    });
    out.push({ role: m.role, content: parts });
  }
  return out;
}

function mapStop(r?: string): ChatResponse["finishReason"] {
  switch (r) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    default:
      return "unknown";
  }
}

interface AnthropicCompletion {
  model?: string;
  stop_reason?: string;
  content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}
interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: { stop_reason?: string; type?: string; text?: string; partial_json?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
  content_block?: { type: string; id?: string; name?: string; text?: string };
  message?: { model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
  error?: { message?: string };
}
