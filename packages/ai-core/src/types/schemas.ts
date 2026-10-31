import { z } from "zod";

/**
 * Zod schemas used at provider boundaries (API layer validates with these
 * before touching any adapter). Kept intentionally permissive on unknown keys.
 */

export const imagePartSchema = z
  .object({
    type: z.literal("image"),
    mimeType: z.string().optional(),
    dataUrl: z
      .string()
      .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/, "expected base64 image data URL")
      .optional(),
    url: z.string().url().optional(),
    alt: z.string().optional(),
  })
  .refine((v) => Boolean(v.dataUrl || v.url), { message: "image part requires either dataUrl or url" });

export const textPartSchema = z.object({ type: z.literal("text"), text: z.string() });

export const contentPartSchema = z.union([textPartSchema, imagePartSchema]);

export const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(contentPartSchema).min(1)]),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
});

export const toolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.unknown()),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  tools: z.array(toolDefinitionSchema).optional(),
  responseFormat: z.enum(["text", "json"]).optional(),
  extra: z.record(z.unknown()).optional(),
});

export const aiConfigInputSchema = z.object({
  /** Which adapter to instantiate. */
  protocol: z.enum(["openai-compatible", "anthropic", "ollama", "custom"]),
  /** Human-readable unique id, e.g. "openai-main", "ollama-local". */
  id: z.string().min(1).max(64),
  displayName: z.string().min(1).max(80),
  baseUrl: z.string().url().optional(),
  /** Never logged, never returned to the client bundle. */
  apiKeyEnv: z.string().min(1).max(128).optional(),
  defaultModel: z.string().min(1).max(128),
  capabilities: z
    .object({
      tools: z.boolean().default(false),
      vision: z.boolean().default(false),
      jsonMode: z.boolean().default(false),
      streaming: z.boolean().default(true),
      maxContext: z.number().int().positive().default(8192),
    })
    .optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type AiConfigInput = z.infer<typeof aiConfigInputSchema>;
