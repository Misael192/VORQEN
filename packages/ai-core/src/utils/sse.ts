/** Minimal SSE (Server-Sent Events) frame parser, shared by all adapters. */

export interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

export class SseParser {
  private buffer = "";

  /** Feed a decoded text chunk; returns any complete events found so far. */
  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];
    // Event boundaries: blank line (\n\n). Normalize \r\n and lone \r first.
    let idx: number;
    const normalized = this.buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    this.buffer = normalized;
    while ((idx = this.buffer.indexOf("\n\n")) !== -1) {
      const rawFrame = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      const ev = parseFrame(rawFrame);
      if (ev) events.push(ev);
    }
    return events;
  }
}

function parseFrame(frame: string): SseEvent | null {
  let event = "message";
  let id: string | undefined;
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue; // comment / keep-alive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "event":
        event = value;
        break;
      case "data":
        dataLines.push(value);
        break;
      case "id":
        id = value;
        break;
      default:
        break;
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n"), id };
}

/** Async helper: iterate SSE events from a fetch Response body. */
export async function* sseIterable(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const ev of parser.push(decoder.decode(value, { stream: true }))) yield ev;
    }
    const tail = decoder.decode();
    if (tail) for (const ev of parser.push(tail + "\n\n")) yield ev;
  } finally {
    reader.releaseLock();
  }
}
