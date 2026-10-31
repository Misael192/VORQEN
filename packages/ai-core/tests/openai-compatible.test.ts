import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleProvider } from "../src/providers/OpenAICompatible.js";
import type { ChatRequest } from "../src/types/chat.js";
import { ProviderError } from "../src/errors/index.js";

function sseResponse(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const enc = new TextEncoder();
      for (const f of frames) ctrl.enqueue(enc.encode(f));
      ctrl.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const req: ChatRequest = { messages: [{ role: "user", content: "oi" }] };

describe("OpenAICompatibleProvider", () => {
  it("sendMessage posts chat/completions and parses text + usage", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(String(_url)).toBe("https://api.example.com/v1/chat/completions");
      const body = JSON.parse(String(init!.body));
      expect(body.model).toBe("gpt-test");
      expect(body.stream).toBe(false);
      expect(body.messages[0]).toMatchObject({ role: "user", content: "oi" });
      return new Response(
        JSON.stringify({
          model: "gpt-test",
          choices: [{ finish_reason: "stop", message: { content: "olá!" } }],
          usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const p = new OpenAICompatibleProvider({
      id: "unit",
      vendor: "Unit",
      baseUrl: "https://api.example.com/v1/",
      apiKey: "sk-test",
      defaultModel: "gpt-test",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const res = await p.sendMessage(req);
    expect(res.text).toBe("olá!");
    expect(res.finishReason).toBe("stop");
    expect(res.usage).toEqual({ promptTokens: 5, completionTokens: 7, totalTokens: 12 });
    expect(res.providerId).toBe("unit");
    // auth header present but never leaked in response object
    const headers = (fetchMock.mock.calls[0]![1]!.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-test");
    expect(JSON.stringify(res)).not.toContain("sk-test");
  });

  it("streamMessage yields text deltas, tool call and done chunk", async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"write_file","arguments":"{\\"pa"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"th\\":\\"a.ts\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\n',
        "data: [DONE]\n\n",
      ])
    );
    const p = new OpenAICompatibleProvider({
      id: "unit",
      vendor: "Unit",
      baseUrl: "https://api.example.com/v1",
      defaultModel: "m",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const chunks = [];
    for await (const c of p.streamMessage(req)) chunks.push(c);
    expect(chunks.map((c) => c.kind)).toEqual(["text", "text", "tool_call", "done"]);
    expect(chunks[2]!.toolCall).toMatchObject({ id: "call_1", name: "write_file", args: { path: "a.ts" } });
    expect(chunks[3]!.finish?.finishReason).toBe("tool_calls");
    expect(chunks[3]!.finish?.usage?.totalTokens).toBe(5);
  });

  it("maps 429 to rate_limit and keeps it retryable via handleError", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429 }));
    const p = new OpenAICompatibleProvider({
      id: "unit",
      vendor: "Unit",
      baseUrl: "https://api.example.com/v1",
      apiKey: "k",
      defaultModel: "m",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    // 2 attempts configured internally; both get 429.
    await expect(p.sendMessage(req)).rejects.toBeInstanceOf(ProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    try {
      await p.sendMessage(req);
    } catch (e) {
      const norm = p.handleError(e);
      expect(norm.kind).toBe("rate_limit");
      expect(norm.retryable).toBe(true);
    }
  });

  it("refuses images when vision capability is off", async () => {
    const p = new OpenAICompatibleProvider({
      id: "unit",
      vendor: "Unit",
      baseUrl: "https://x",
      defaultModel: "m",
      capabilities: { vision: false },
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    const imgReq: ChatRequest = {
      messages: [{ role: "user", content: [{ type: "text", text: "see?" }, { type: "image", dataUrl: "data:image/png;base64,AAAA" }] }],
    };
    await expect(p.sendMessage(imgReq)).rejects.toMatchObject({ kind: "unsupported" });
  });

  it("healthCheck fails fast (≤ ~2.2s) when server unreachable", async () => {
    const p = new OpenAICompatibleProvider({
      id: "unit",
      vendor: "Unit",
      baseUrl: "http://127.0.0.1:9", // nothing listens here
      defaultModel: "m",
    });
    const started = Date.now();
    const report = await p.healthCheck();
    expect(report.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(2500);
  });
});
