import type { ChatMessage, ContentPart, TextPart, ImagePart } from "../types/chat.js";

export function partsOf(message: ChatMessage): ContentPart[] {
  return typeof message.content === "string"
    ? [{ type: "text", text: message.content }]
    : message.content;
}

export function textOf(message: ChatMessage): string {
  return partsOf(message)
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function imagesOf(message: ChatMessage): ImagePart[] {
  return partsOf(message).filter((p): p is ImagePart => p.type === "image");
}

export function hasImages(messages: ChatMessage[]): boolean {
  return messages.some((m) => imagesOf(m).length > 0);
}

export function systemPrompt(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role === "system")
    .map(textOf)
    .join("\n\n");
}

export function nonSystem(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((m) => m.role !== "system");
}

/** Strip anything that could leak into logs. Keys are never logged anywhere. */
export function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 6) out = out.split(s).join("[redacted]");
  }
  return out;
}
