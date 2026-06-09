import type { AgentActivityService } from "../agent/AgentActivityService";

export type ActionTimeoutTier = "light" | "medium" | "heavy";

/** Light: click, key, scroll. Medium: inspect, type, WebMCP. Heavy: navigate + page read. */
export const ACTION_TIMEOUT_MS: Record<ActionTimeoutTier, number> = {
  light: 10_000,
  medium: 25_000,
  heavy: 45_000,
};

export class ActionTimeoutError extends Error {
  readonly timedOut = true;

  constructor(
    public readonly actionLabel: string,
    public readonly timeoutMs: number,
  ) {
    super(
      `Action timed out after ${Math.round(timeoutMs / 1000)}s: ${actionLabel}. ` +
        "Try browserInspectPage and a different selector or approach.",
    );
    this.name = "ActionTimeoutError";
  }
}

export function isActionTimeoutError(error: unknown): boolean {
  return (
    error instanceof ActionTimeoutError ||
    (error instanceof Error && error.name === "ActionTimeoutError")
  );
}

export interface ActionTimeoutOptions {
  label: string;
  tier: ActionTimeoutTier;
  isCancelled?: () => boolean;
  agentActivity?: AgentActivityService | null;
  tabId?: string;
  url?: string;
  run: () => Promise<Record<string, unknown>>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withActionTimeout(
  options: ActionTimeoutOptions,
): Promise<Record<string, unknown>> {
  const timeoutMs = ACTION_TIMEOUT_MS[options.tier];
  const startedAt = Date.now();
  let finished = false;

  const heartbeat = setInterval(() => {
    if (finished || options.isCancelled?.()) return;
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    options.agentActivity?.emit({
      kind: "tool_running",
      label: `${options.label}… ${sec}s`,
      tabId: options.tabId,
      url: options.url,
    });
  }, 2500);

  const timeoutPromise = sleep(timeoutMs).then(() => {
    if (!finished) {
      throw new ActionTimeoutError(options.label, timeoutMs);
    }
    return {};
  });

  try {
    if (options.isCancelled?.()) {
      throw new Error("Agent run cancelled");
    }
    const result = await Promise.race([options.run(), timeoutPromise]);
    return result;
  } finally {
    finished = true;
    clearInterval(heartbeat);
  }
}

export function actionTimeoutFields(
  error: unknown,
): Record<string, unknown> | null {
  if (!isActionTimeoutError(error)) return null;
  const e = error as ActionTimeoutError;
  return {
    ok: false,
    timedOut: true,
    error: e.message,
    action: e.actionLabel,
    timeoutMs: e.timeoutMs,
    hint: "Action stuck — call browserInspectPage, then retry with another selector or path.",
  };
}
