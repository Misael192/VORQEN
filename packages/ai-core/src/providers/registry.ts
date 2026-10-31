import { z } from "zod";
import type { AIProvider } from "../types/provider.js";
import { aiConfigInputSchema, type AiConfigInput } from "../types/schemas.js";
import { OpenAICompatibleProvider } from "./OpenAICompatible.js";
import { AnthropicProvider } from "./AnthropicProvider.js";
import { OllamaProvider } from "./OllamaProvider.js";

export const BUILTIN_PRESETS = [
  {
    protocol: "openai-compatible",
    id: "openai",
    displayName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
  },
  {
    protocol: "anthropic",
    id: "anthropic",
    displayName: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-20250514",
  },
  {
    protocol: "ollama",
    id: "ollama",
    displayName: "Ollama (local)",
    baseUrl: "http://127.0.0.1:11434",
    defaultModel: "llama3.1",
  },
] as const satisfies Partial<AiConfigInput>[];

const presetSchema = z.enum(["openai", "anthropic", "ollama"]);
export type PresetName = z.infer<typeof presetSchema>;

export interface RegistryOptions {
  /** Env source, defaults to process.env. Keys are NEVER returned to callers. */
  env?: Record<string, string | undefined>;
  /** Inject fetch for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Central place where provider configs become live adapters.
 * Rules enforced here:
 * - Secrets are resolved from environment variables by NAME (`apiKeyEnv`),
 *   never stored in config objects that cross the API boundary (R11).
 * - Unknown protocol / missing key => explicit error, no silent fallback.
 */
export class ProviderRegistry {
  private env: Record<string, string | undefined>;
  private fetchImpl?: typeof fetch;
  private instances = new Map<string, AIProvider>();

  constructor(opts: RegistryOptions = {}) {
    this.env = opts.env ?? (typeof process !== "undefined" ? process.env : {});
    this.fetchImpl = opts.fetchImpl;
  }

  /** Validate + store a config. Returns the sanitized config (no secrets). */
  static parseConfig(input: unknown): AiConfigInput {
    return aiConfigInputSchema.parse(input);
  }

  static preset(name: PresetName): AiConfigInput {
    const p = BUILTIN_PRESETS.find((x) => x.id === name);
    if (!p) throw new Error(`unknown preset "${name}"`);
    return aiConfigInputSchema.parse(p);
  }

  resolveKey(cfg: AiConfigInput): string | undefined {
    if (!cfg.apiKeyEnv) return undefined;
    return this.env[cfg.apiKeyEnv] || undefined;
  }

  get(cfgInput: AiConfigInput): AIProvider {
    const cfg = ProviderRegistry.parseConfig(cfgInput);
    const cacheKey = `${cfg.id}:${cfg.defaultModel}`;
    const hit = this.instances.get(cacheKey);
    if (hit) return hit;
    const provider = this.build(cfg);
    this.instances.set(cacheKey, provider);
    return provider;
  }

  private build(cfg: AiConfigInput): AIProvider {
    const apiKey = this.resolveKey(cfg);
    const caps = cfg.capabilities;
    switch (cfg.protocol) {
      case "openai-compatible":
        if (!cfg.baseUrl) throw new Error(`provider "${cfg.id}": baseUrl required`);
        if (cfg.apiKeyEnv && !apiKey) {
          throw new Error(
            `provider "${cfg.id}" is BLOCKED: set ${cfg.apiKeyEnv} in the server environment (never in the browser)`
          );
        }
        return new OpenAICompatibleProvider({
          id: cfg.id,
          vendor: cfg.displayName,
          baseUrl: cfg.baseUrl,
          apiKey,
          defaultModel: cfg.defaultModel,
          fetchImpl: this.fetchImpl,
          ...(caps ? { capabilities: caps } : {}),
        });
      case "anthropic":
        if (cfg.apiKeyEnv && !apiKey) {
          throw new Error(
            `provider "${cfg.id}" is BLOCKED: set ${cfg.apiKeyEnv} in the server environment (never in the browser)`
          );
        }
        return new AnthropicProvider({
          id: cfg.id,
          ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
          apiKey,
          defaultModel: cfg.defaultModel,
          ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
        });
      case "ollama":
        return new OllamaProvider({
          id: cfg.id,
          ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
          defaultModel: cfg.defaultModel,
          ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
        });
      case "custom":
        // Custom providers must be registered programmatically via
        // CustomProvider + hooks by the host app; configuring one over HTTP
        // would mean shipping arbitrary code — refused by design.
        throw new Error(`provider "${cfg.id}": protocol "custom" must be registered in server code, not via config API`);
      default:
        throw new Error(`unknown protocol`);
    }
  }

  clear(): void {
    this.instances.clear();
  }
}
