import { describe, it, expect } from "vitest";
import { ProviderRegistry, BUILTIN_PRESETS } from "../src/providers/registry.js";
import { chatRequestSchema, aiConfigInputSchema } from "../src/types/schemas.js";

describe("ProviderRegistry", () => {
  it("builds OpenAI-compatible adapter only when env key exists; BLOCKED otherwise", () => {
    const cfg = ProviderRegistry.preset("openai");
    const empty = new ProviderRegistry({ env: {} });
    expect(() => empty.get(cfg)).toThrow(/BLOCKED.*OPENAI_API_KEY/);
    const filled = new ProviderRegistry({ env: { OPENAI_API_KEY: "sk-real" } });
    const p = filled.get(cfg);
    expect(p.identify().protocol).toBe("openai-compatible");
    expect(p.currentModel).toBe("gpt-4o-mini");
    // error message must not contain the key value
    try {
      empty.get(cfg);
    } catch (e) {
      expect(String(e)).not.toContain("sk-real");
    }
  });

  it("ollama preset needs no key", () => {
    const reg = new ProviderRegistry({ env: {} });
    const p = reg.get(ProviderRegistry.preset("ollama"));
    expect(p.identify().vendor).toBe("Ollama");
    expect(p.reportCapabilities().tools).toBe(false);
  });

  it("selectModel switches model and rejects empty ids", () => {
    const reg = new ProviderRegistry({ env: {} });
    const p = reg.get(ProviderRegistry.preset("ollama"));
    p.selectModel("qwen2.5-coder");
    expect(p.currentModel).toBe("qwen2.5-coder");
    expect(() => p.selectModel("  ")).toThrow();
  });

  it("refuses custom protocol via config API", () => {
    const reg = new ProviderRegistry({ env: {} });
    const cfg = aiConfigInputSchema.parse({
      protocol: "custom",
      id: "weird",
      displayName: "Weird",
      defaultModel: "m",
    });
    expect(() => reg.get(cfg)).toThrow(/server code/);
  });

  it("presets all pass zod validation", () => {
    for (const preset of BUILTIN_PRESETS) {
      expect(() => aiConfigInputSchema.parse(preset)).not.toThrow();
    }
  });
});

describe("chatRequestSchema", () => {
  it("accepts multimodal content", () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [
        { role: "user", content: [{ type: "text", text: "look" }, { type: "image", dataUrl: "data:image/png;base64,AAAA" }] },
      ],
      temperature: 0.2,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects image without dataUrl/url and empty messages", () => {
    expect(
      chatRequestSchema.safeParse({ messages: [{ role: "user", content: [{ type: "image" }] }] }).success
    ).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
  });

  it("config schema never accepts a raw api key field", () => {
    const attempt = aiConfigInputSchema.safeParse({
      protocol: "openai-compatible",
      id: "x",
      displayName: "X",
      defaultModel: "m",
      apiKey: "sk-should-not-be-here",
    });
    // unknown keys are stripped by zod default; parse succeeds but output has no apiKey
    if (attempt.success) expect((attempt.data as Record<string, unknown>)).not.toHaveProperty("apiKey");
  });
});
