export interface LlmErrorDetails {
  message: string;
  headers?: Record<string, string>;
  code?: string;
}

export function extractLlmErrorDetails(error: unknown): LlmErrorDetails {
  if (!error || typeof error !== "object") {
    return { message: String(error ?? "Unknown error") };
  }

  const record = error as Record<string, unknown>;

  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    return {
      message: String(nested.message ?? record.message ?? "Unknown error"),
      headers: normalizeHeaders(nested.headers),
      code: typeof nested.code === "string" ? nested.code : undefined,
    };
  }

  return {
    message: String(record.message ?? "Unknown error"),
    headers: normalizeHeaders(record.responseHeaders ?? record.headers),
    code: typeof record.code === "string" ? record.code : undefined,
  };
}

/** Hard quota exhaustion (daily/billing caps) — retrying will not help. */
export function isQuotaExhaustedError(error: unknown): boolean {
  const { message, code } = extractLlmErrorDetails(error);
  const lower = message.toLowerCase();

  return (
    code === "insufficient_quota" ||
    lower.includes("insufficient_quota") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("free_tier_requests") ||
    lower.includes("perday") ||
    (lower.includes("quota") && lower.includes("per day"))
  );
}

export function formatQuotaExhaustedMessage(provider: string): string {
  if (provider === "gemini") {
    return (
      "Gemini free-tier quota is used up for today (e.g. 20 requests/day on gemini-2.5-flash). " +
      "Switch the provider or model in Settings, wait for the daily reset, or enable billing in Google AI Studio. " +
      "Note: each agent task uses several requests, so the free tier runs out fast."
    );
  }
  if (provider === "openai") {
    return "OpenAI quota exhausted — check your plan and billing, or switch provider in Settings.";
  }
  return "LLM provider quota exhausted — check billing or switch the provider in Settings.";
}

export function isRetriableLlmError(error: unknown): boolean {
  if (isQuotaExhaustedError(error)) return false;

  const { message, code } = extractLlmErrorDetails(error);
  const lower = message.toLowerCase();

  return (
    code === "rate_limit_exceeded" ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("429") ||
    lower.includes("tokens per min") ||
    lower.includes("tpm") ||
    lower.includes("overloaded") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("timeout") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("server error")
  );
}

export function parseRetryDelayMs(error: unknown, attempt: number): number {
  const { message, headers } = extractLlmErrorDetails(error);

  if (headers) {
    const resetTokens = headers["x-ratelimit-reset-tokens"];
    if (resetTokens) {
      const parsed = parseDurationToken(resetTokens);
      if (parsed !== undefined) return clampDelay(parsed + 750);
    }

    const retryAfterMs = headers["retry-after-ms"];
    if (retryAfterMs) {
      const parsed = Number.parseFloat(retryAfterMs);
      if (!Number.isNaN(parsed)) return clampDelay(parsed + 250);
    }

    const retryAfter = headers["retry-after"];
    if (retryAfter) {
      const asSeconds = Number.parseFloat(retryAfter);
      if (!Number.isNaN(asSeconds)) return clampDelay(asSeconds * 1000 + 250);
    }
  }

  const tryAgain = message.match(/(?:try again|retry) in ([\d.]+)\s*(ms|s)/i);
  if (tryAgain) {
    const value = Number.parseFloat(tryAgain[1]);
    const unit = tryAgain[2].toLowerCase();
    if (!Number.isNaN(value)) {
      return clampDelay(unit === "s" ? value * 1000 + 500 : value + 250);
    }
  }

  // TPM windows are ~60s; back off a bit more on repeated hits.
  const base = 8_000;
  return clampDelay(base * 2 ** Math.min(attempt, 4));
}

export function formatRetryStatus(
  error: unknown,
  delayMs: number,
  attempt: number,
): string {
  const { message } = extractLlmErrorDetails(error);
  const seconds = Math.max(1, Math.ceil(delayMs / 1000));
  const reason = message.toLowerCase().includes("rate limit")
    ? "Rate limit reached"
    : "Provider busy";

  return `${reason} — Berry will retry in ${seconds}s (attempt ${attempt})…`;
}

const clampDelay = (ms: number): number =>
  Math.min(120_000, Math.max(1_000, Math.ceil(ms)));

const normalizeHeaders = (
  value: unknown,
): Record<string, string> | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue === "string") {
      out[key.toLowerCase()] = headerValue;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const parseDurationToken = (value: string): number | undefined => {
  const trimmed = value.trim().toLowerCase();
  const msMatch = trimmed.match(/^([\d.]+)ms$/);
  if (msMatch) return Number.parseFloat(msMatch[1]);

  const secMatch = trimmed.match(/^([\d.]+)s$/);
  if (secMatch) return Number.parseFloat(secMatch[1]) * 1000;

  const minSecMatch = trimmed.match(/^(\d+)m([\d.]+)s$/);
  if (minSecMatch) {
    return (
      (Number.parseInt(minSecMatch[1], 10) * 60 +
        Number.parseFloat(minSecMatch[2])) *
      1000
    );
  }

  return undefined;
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
