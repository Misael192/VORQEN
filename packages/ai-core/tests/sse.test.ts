import { describe, it, expect } from "vitest";
import { SseParser } from "../src/utils/sse.js";

describe("SseParser", () => {
  it("parses a single event split across chunks", () => {
    const p = new SseParser();
    expect(p.push('data: {"a":')).toEqual([]);
    const evs = p.push('1}\n\ndata: two\n\n');
    expect(evs).toHaveLength(2);
    expect(evs[0]!.data).toBe('{"a":1}');
    expect(evs[1]!.data).toBe("two");
  });

  it("joins multi-line data and handles CRLF", () => {
    const p = new SseParser();
    const evs = p.push("event: delta\r\ndata: line1\r\ndata: line2\r\n\r\n");
    expect(evs[0]!.event).toBe("delta");
    expect(evs[0]!.data).toBe("line1\nline2");
  });

  it("ignores comments and empty frames", () => {
    const p = new SseParser();
    expect(p.push(": keep-alive\n\n")).toEqual([]);
  });
});
