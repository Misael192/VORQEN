import type { NormalizedError, NormalizedErrorKind } from "../types/chat.js";

/** Error thrown by adapters carrying a normalized shape plus the original cause. */
export class ProviderError extends Error implements NormalizedError {
  readonly kind: NormalizedErrorKind;
  readonly statusCode?: number;
  readonly providerId: string;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(params: {
    kind: NormalizedErrorKind;
    message: string;
    providerId: string;
    statusCode?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "ProviderError";
    this.kind = params.kind;
    this.providerId = params.providerId;
    this.statusCode = params.statusCode;
    this.retryable = params.retryable ?? defaultRetryable(params.kind, params.statusCode);
    this.cause = params.cause;
  }

  toNormalized(): NormalizedError {
    return {
      kind: this.kind,
      message: this.message,
      statusCode: this.statusCode,
      providerId: this.providerId,
      retryable: this.retryable,
    };
  }
}

export function defaultRetryable(kind: NormalizedErrorKind, status?: number): boolean {
  if (kind === "rate_limit") return true;
  if (kind === "timeout" || kind === "network") return true;
  if (kind === "server") return true;
  if (status && status >= 500) return true;
  return false;
}

const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 8_000;

export interface RetryOptions {
  attempts: number;
  baseMs?: number;
  maxMs?: number;
  signal?: AbortSignal;
  onRetry?: (err: unknown, nextAttempt: number, delayMs: number) => void;
}

/** Returns true for errors worth retrying. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof ProviderError) return err.retryable;
  // Unwrap standard Error#cause chains so wrapped fetch failures still count.
  if (err instanceof Error && err.cause) return isRetryable(err.cause);
  // Node fetch failures surface as TypeError("fetch failed") or errno codes.
  if (err instanceof Error && (err.name === "TypeError" || (err as NodeJS.ErrnoException).code)) {
    return true;
  }
  return false;
}

/** Exponential backoff with jitter. Only retries `isRetryable` errors. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const base = opts.baseMs ?? RETRY_BASE_MS;
  const max = opts.maxMs ?? RETRY_MAX_MS;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    if (opts.signal?.aborted) throw abortError(opts.signal);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort || !isRetryable(err) || attempt === opts.attempts) throw err;
      const delay = Math.min(max, base * 2 ** (attempt - 1)) * (0.5 + Math.random() * 0.5);
      opts.onRetry?.(err, attempt + 1, Math.round(delay));
      await sleep(delay, opts.signal);
    }
  }
  throw lastErr;
}

export function abortError(signal: AbortSignal): Error {
  const e = new Error("Aborted");
  e.name = "AbortError";
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason instanceof Error) return reason;
  return e;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(abortError(signal));
      },
      { once: true }
    );
  });
}

/** Map HTTP status to normalized kind. Shared across adapters. */
export function kindFromStatus(status: number): NormalizedErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit";
  if (status === 400 || status === 422) return "invalid_request";
  if (status >= 500) return "server";
  return "unknown";
}
