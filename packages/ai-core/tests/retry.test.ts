import { describe, it, expect } from "vitest";
import { withRetry, ProviderError, isRetryable } from "../src/errors/index.js";

describe("withRetry", () => {
  it("retries retryable errors then succeeds", async () => {
    let calls = 0;
    const out = await withRetry(
      async () => {
        calls++;
        if (calls < 3) {
          throw new ProviderError({ kind: "rate_limit", message: "429", providerId: "test" });
        }
        return "ok";
      },
      { attempts: 4, baseMs: 1, maxMs: 2 }
    );
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry non-retryable errors", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new ProviderError({ kind: "auth", message: "bad key", providerId: "test", statusCode: 401 });
        },
        { attempts: 3, baseMs: 1 }
      )
    ).rejects.toBeInstanceOf(ProviderError);
    expect(calls).toBe(1);
  });

  it("honors abort signal between attempts", async () => {
    const ctrl = new AbortController();
    let calls = 0;
    const p = withRetry(
      async () => {
        calls++;
        ctrl.abort();
        throw new ProviderError({ kind: "server", message: "boom", providerId: "test", statusCode: 500 });
      },
      { attempts: 5, baseMs: 5, signal: ctrl.signal }
    );
    await expect(p).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("classifies retryability", () => {
    expect(isRetryable(new ProviderError({ kind: "network", message: "x", providerId: "t" }))).toBe(true);
    expect(isRetryable(new ProviderError({ kind: "invalid_request", message: "x", providerId: "t", statusCode: 400 }))).toBe(false);
  });
});
