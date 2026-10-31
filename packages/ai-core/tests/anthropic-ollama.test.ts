import { describe, it, expect, vi } from "vitest";
import { AnthropicProvider } from "../src/providers/AnthropicProvider.js";
import { OllamaProvider } from "../src/providers/OllamaProvider.js";
import type { ChatRequest } from "../src/types/chat.js";

const req: ChatRequest = {
  messages: [
    { role: "system", content: "You are terse." },
    { role: "user", content: "hi" },
  ],
};

describe("AnthropicProvider", () => {
  it("builds /v1/messages body with system extraction and x-api-key header", async () => {
    const fetchMock = vi.fn(async (_u: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      expect(body.model).toBe("claude-sonnet-4-20250514");
      expect(body.system).toBe("You are terse.");
      expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
      expect(body.max_tokens).toBeGreaterThan(0);
      const h = init!.headers as Record<string, string>;
      expect(h["x-api-key"]).toBe("sk-ant-test");
      expect(h["anthropic-version"]).toBe("2023-06-01");
      return new Response(
        JSON.stringify({
          model: "claude-sonnet-4-20250514",
          stop_reason: "end_turn",
          content: [{ type: "text", text: "hello" }],
          usage: { input_tokens: 9, output_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const p = new AnthropicProvider({ apiKey: "sk-ant-test", defaultModel: "claude-sonnet-4-20250514", fetchImpl: fetchMock as unknown as typeof fetch });
    const res = await p.sendMessage(req);
    expect(res.text).toBe("hello");
    expect(res.finishReason).toBe("stop");
    expect(res.usage?.promptTokens).toBe(9);
  });

  it("streams anthropic SSE events into normalized chunks", async () => {
    const frames = [
      'event: message_start\ndata: {"type":"message_start","message":{"model":"claude-x","usage":{"input_tokens":3}}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Par"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"cel"}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tu_1","name":"run_cmd"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"cmd\\":\\"ls\\"}"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":6}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];
    const fetchMock = vi.fn(async () => {
      const enc = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          for (const f of frames) c.enqueue(enc.encode(f));
          c.close();
        },
      });
      return new Response(body, { status: 200 });
    });
    const p = new AnthropicProvider({ defaultModel: "claude-x", fetchImpl: fetchMock as unknown as typeof fetch });
    const out = [];
    for await (const c of p.streamMessage(req)) out.push(c);
    expect(out.map((c) => c.kind)).toEqual(["text", "text", "tool_call", "done"]);
    expect(out[2]!.toolCall).toMatchObject({ id: "tu_1", name: "run_cmd", args: { cmd: "ls" } });
    expect(out[3]!.finish?.finishReason).toBe("tool_calls");
  });

  it("rejects image input on non-vision models", async () => {
    const p = new AnthropicProvider({ defaultModel: "claude-2.1", fetchImpl: vi.fn() as unknown as typeof fetch });
    const imgReq: ChatRequest = {
      messages: [{ role: "user", content: [{ type: "image", dataUrl: "data:image/png;base64,AA==" }] }],
    };
    await expect(p.sendMessage(imgReq)).rejects.toMatchObject({ kind: "unsupported" });
  });
});

describe("OllamaProvider", () => {
  it("posts to /api/chat with options and parses NDJSON stream", async () => {
    const lines = [
      '{"model":"llama3.1","message":{"role":"assistant","content":"O"},"done":false}\n',
      '{"model":"llama3.1","message":{"role":"assistant","content":"l!"},"done":false}\n',
      '{"model":"llama3.1","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","prompt_eval_count":4,"eval_count":5}\n',
    ];
    const fetchMock = vi.fn(async (_u: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      expect(body.stream).toBe(true);
      expect(body.options.num_predict).toBe(64);
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          for (const l of lines) c.enqueue(enc.encode(l));
          c.close();
        },
      });
      return new Response(stream, { status: 200 });
    });
    const p = new OllamaProvider({ defaultModel: "llama3.1", fetchImpl: fetchMock as unknown as typeof fetch });
    const chunks = [];
    for await (const c of p.streamMessage({ messages: [{ role: "user", content: "hi" }], maxTokens: 64 })) chunks.push(c);
    expect(chunks.filter((c) => c.kind === "text").map((c) => c.delta).join("")).toBe("Ol!");
    expect(chunks.at(-1)!.kind).toBe("done");
  });

  it("reports network error honestly when server is down", async () => {
    const p = new OllamaProvider({ baseUrl: "http://127.0.0.1:9", defaultModel: "x" });
    const report = await p.healthCheck();
    expect(report.ok).toBe(false);
    expect(report.detail).toMatch(/Ollama running|fetch failed|aborted/i);
  });
});
