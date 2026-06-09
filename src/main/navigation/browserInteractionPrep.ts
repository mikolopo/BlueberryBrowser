import type { Tab } from "../Tab";
import type { BrowserActionContext } from "./browserActionExecutors";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** True when browser automation may focus the page tab (not while user types in chat). */
export function shouldStealFocus(ctx: BrowserActionContext): boolean {
  if (ctx.focusForInteraction === false) return false;
  if (ctx.window?.isSidebarFocused()) return false;
  return true;
}

export async function prepareTabForInteraction(
  ctx: BrowserActionContext,
  options?: { forceFocus?: boolean },
): Promise<Tab> {
  const tab = ctx.window?.activeTab;
  if (!tab) throw new Error("No active tab");

  const focus = options?.forceFocus === true || shouldStealFocus(ctx);
  if (focus) {
    ctx.window?.focusActiveTabForInteraction({ force: true });
  }
  await tab.prepareForInteraction({ focus });
  return tab;
}

export async function runInteractionWithRetry<T>(
  action: () => Promise<T>,
  isValid: (result: T) => boolean,
  retries = 1,
): Promise<T> {
  let last: T | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await action();
    if (isValid(last)) return last;
    if (attempt < retries) await sleep(400);
  }
  return last as T;
}
