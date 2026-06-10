import type { Tab } from "../Tab";
import type { Window } from "../Window";
import type { AgentActivityService } from "../agent/AgentActivityService";
import { normalizeNavigationUrl, buildSearchUrl } from "../navigationUrl";
import {
  showAgentPageOverlay,
  hideAgentPageOverlay,
  highlightAgentElement,
} from "../agent/agentPageOverlay";
import {
  readPageWithSignals,
  PAGE_PROBE_SCRIPT,
  validateYouTubeWatchNavigation,
} from "../navigation/youtubeNavigation";
import {
  BROWSER_INSPECT_PAGE_SCRIPT,
  BROWSER_SEARCH_RESULTS_SCRIPT,
  buildBrowserClickScript,
  buildBrowserKeyScript,
  buildBrowserScrollScript,
  buildBrowserTypeScript,
} from "../navigation/browserInteract";
import {
  sendNativeKey,
  sendNativeWheel,
} from "../navigation/browserNativeInput";
import {
  prepareTabForInteraction,
  runInteractionWithRetry,
  shouldStealFocus,
} from "../navigation/browserInteractionPrep";
import {
  type ActionTimeoutTier,
  actionTimeoutFields,
  isActionTimeoutError,
  withActionTimeout,
} from "./actionTimeout";

export interface RecordedAction {
  type: "navigate" | "search" | "click" | "type" | "scroll";
  url?: string;
  query?: string;
  selector?: string;
  text?: string;
  pressEnter?: boolean;
}

export interface BrowserActionContext {
  window: Window | null;
  agentActivity: AgentActivityService | null;
  maxPageTextLength: number;
  isCancelled?: () => boolean;
  /** When false, never steal focus from sidebar (background tasks). Default: respect sidebar focus. */
  focusForInteraction?: boolean;
  /** Callback to log a runtime action for automation code generator */
  onActionRecorded?: (action: RecordedAction) => void;
}

function throwIfCancelled(ctx: BrowserActionContext): void {
  if (ctx.isCancelled?.()) {
    throw new Error("Agent run cancelled");
  }
}

function getTab(ctx: BrowserActionContext): Tab {
  const t = ctx.window?.activeTab;
  if (!t) throw new Error("No active tab");
  return t;
}

function timeoutOpts(
  ctx: BrowserActionContext,
  label: string,
  tier: ActionTimeoutTier,
  tab?: Tab,
): {
  label: string;
  tier: ActionTimeoutTier;
  isCancelled?: () => boolean;
  agentActivity: AgentActivityService | null;
  tabId?: string;
  url?: string;
} {
  return {
    label,
    tier,
    isCancelled: ctx.isCancelled,
    agentActivity: ctx.agentActivity,
    tabId: tab?.id,
    url: tab?.url,
  };
}

async function runTimedAction(
  ctx: BrowserActionContext,
  label: string,
  tier: ActionTimeoutTier,
  tab: Tab | undefined,
  run: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  return withActionTimeout({
    ...timeoutOpts(ctx, label, tier, tab),
    run,
  });
}

function buildWebMcpToolResult(
  ctx: BrowserActionContext,
  tab: Tab,
): Record<string, unknown> {
  const snapshot = ctx.window?.webMcpService.registry.getForTab(tab.id);
  const toolNames = snapshot?.tools.map((t) => t.name) ?? [];
  const active = toolNames.length > 0;
  return {
    webMcp: {
      active,
      toolsAvailable: toolNames,
      pageUrl: tab.url,
      ...(active
        ? {
            useWebMcpTools: true,
            hint: "WebMCP page detected — call matching WebMCP tools (searchFlights, searchProducts, addTask, etc.) instead of browserClick/browserType for the same action.",
          }
        : {}),
    },
  };
}

export async function execBrowserNavigate(
  ctx: BrowserActionContext,
  rawUrl: string,
): Promise<Record<string, unknown>> {
  const target = normalizeNavigationUrl(rawUrl.trim());
  console.log(`[BrowserAction:Navigate] URL: "${target}"`);
  const ytError = validateYouTubeWatchNavigation(target);
  if (ytError) throw new Error(ytError);

  const activeTab = getTab(ctx);
  return runTimedAction(ctx, "Navigate", "heavy", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "navigating",
      label: `Navigating to ${target}`,
      tabId: activeTab.id,
      url: target,
    });

    await activeTab.loadURL(target);
    void hideAgentPageOverlay(activeTab); // page reloads — overlay DOM is gone
    await activeTab.ensureAgentCursor();
    if (ctx.window) await ctx.window.probeWebMcpAfterLoad(activeTab);
    ctx.agentActivity?.setViewportUrl(
      activeTab.id,
      activeTab.url,
      activeTab.title,
    );

    const read = await readPageWithSignals(
      target,
      () => getTab(ctx).getTabText(),
      () => activeTab.runJs(PAGE_PROBE_SCRIPT),
      ctx.maxPageTextLength,
    );

    ctx.agentActivity?.emit({
      kind: "reading_page",
      label: "Reading new page…",
      tabId: activeTab.id,
      url: target,
    });

    console.log(
      `[BrowserAction:Navigate] SUCCESS. Loaded: "${target}" (Title: "${read.pageSignals.pageTitle}")`,
    );

    if (ctx.onActionRecorded) {
      ctx.onActionRecorded({ type: "navigate", url: target });
    }

    return {
      ok: true,
      navigatedTo: target,
      pageTitle: read.pageSignals.pageTitle,
      pageTextExcerpt: read.pageTextExcerpt,
      pageSignals: {
        youtubeUnavailable: read.pageSignals.youtubeUnavailable,
        youtubeWatchLinks: read.pageSignals.youtubeWatchLinks,
      },
      ...buildWebMcpToolResult(ctx, activeTab),
    };
  });
}

export async function execBrowserSearch(
  ctx: BrowserActionContext,
  query: string,
): Promise<Record<string, unknown>> {
  const q = query.trim();
  if (!q) throw new Error("Missing search query");

  const target = buildSearchUrl(q);
  const activeTab = getTab(ctx);
  console.log(`[BrowserAction:Search] Query: "${q}" on Tab: ${activeTab.id}`);

  return runTimedAction(ctx, "Search", "heavy", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "navigating",
      label: `Searching: ${q}`,
      tabId: activeTab.id,
      url: activeTab.url,
    });

    await activeTab.loadURL(target);
    await activeTab.ensureAgentCursor();
    await sleep(800);

    const searchPage = await activeTab.runJs(BROWSER_SEARCH_RESULTS_SCRIPT);
    const results = Array.isArray(searchPage?.results)
      ? searchPage.results
      : [];

    ctx.agentActivity?.emit({
      kind: "reading_page",
      label: "Reading search results…",
      tabId: activeTab.id,
      url: target,
    });

    const read = await readPageWithSignals(
      target,
      () => getTab(ctx).getTabText(),
      () => activeTab.runJs(PAGE_PROBE_SCRIPT),
      ctx.maxPageTextLength,
    );

    console.log(
      `[BrowserAction:Search] SUCCESS. Found ${results.length} results.`,
    );

    if (ctx.onActionRecorded) {
      ctx.onActionRecorded({ type: "search", query: q });
    }

    return {
      ok: true,
      searchQuery: q,
      navigatedTo: target,
      engine: searchPage?.engine ?? "google.com",
      searchResults: results,
      resultCount: results.length,
      pageTitle: read.pageSignals.pageTitle ?? searchPage?.pageTitle,
      pageTextExcerpt: read.pageTextExcerpt,
      hint:
        results.length > 0
          ? "Pick the best searchResults[].href and browserNavigate to it, or browserClick searchResults[].selector."
          : "No structured results — use browserInspectPage links[] or refine search query.",
      ...buildWebMcpToolResult(ctx, activeTab),
    };
  });
}

export async function execBrowserInspect(
  ctx: BrowserActionContext,
): Promise<Record<string, unknown>> {
  const activeTab = getTab(ctx);
  console.log(
    `[BrowserAction:Inspect] Tab: ${activeTab.id} (${activeTab.url})`,
  );
  return runTimedAction(ctx, "Inspect page", "medium", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "reading_page",
      label: "Inspecting page…",
      tabId: activeTab.id,
      url: activeTab.url,
    });
    if (ctx.window) await ctx.window.probeWebMcpAfterLoad(activeTab);
    const result = await activeTab.runJs(BROWSER_INSPECT_PAGE_SCRIPT);
    if (!result || typeof result !== "object")
      throw new Error("Page inspect failed");
    console.log(
      `[BrowserAction:Inspect] SUCCESS. Inputs: ${result.inputs?.length ?? 0}, Buttons: ${result.buttons?.length ?? 0}, Checkboxes: ${result.checkboxes?.length ?? 0}, Links: ${result.links?.length ?? 0}`,
    );
    return {
      ...(result as Record<string, unknown>),
      ...buildWebMcpToolResult(ctx, activeTab),
    };
  });
}

export async function execBrowserClick(
  ctx: BrowserActionContext,
  selector: string,
): Promise<Record<string, unknown>> {
  throwIfCancelled(ctx);
  const activeTab = await prepareTabForInteraction(ctx);
  console.log(
    `[BrowserAction:Click] Selector: "${selector}" on Tab: ${activeTab.id} (${activeTab.url})`,
  );
  return runTimedAction(ctx, "Click", "light", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "clicking",
      label: "Clicking on page…",
      tabId: activeTab.id,
      url: activeTab.url,
      selector,
    });
    // Show overlay and highlight the target element
    await showAgentPageOverlay(activeTab);
    await highlightAgentElement(activeTab, selector);
    const result = await runInteractionWithRetry(
      () => activeTab.runInteractionJs(buildBrowserClickScript(selector)),
      (r) => Boolean(r?.ok),
      1,
    );
    if (!result?.ok) throw new Error(result?.error ?? "Click failed");
    await sleep(450);
    console.log(`[BrowserAction:Click] SUCCESS for selector: "${selector}"`);

    if (ctx.onActionRecorded) {
      ctx.onActionRecorded({ type: "click", selector });
    }

    return result;
  });
}

export async function execBrowserType(
  ctx: BrowserActionContext,
  selector: string,
  text: string,
  pressEnter?: boolean,
): Promise<Record<string, unknown>> {
  throwIfCancelled(ctx);
  const activeTab = await prepareTabForInteraction(ctx);
  console.log(
    `[BrowserAction:Type] Selector: "${selector}" Text length: ${text.length} (pressEnter: ${pressEnter})`,
  );
  return runTimedAction(ctx, "Type", "medium", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "tool_running",
      label: "Typing on page…",
      tabId: activeTab.id,
      url: activeTab.url,
    });
    // Show overlay and highlight the target input
    await showAgentPageOverlay(activeTab);
    await highlightAgentElement(activeTab, selector, "#22c55e");
    const result = await activeTab.runInteractionJs(
      buildBrowserTypeScript(selector, text, {
        pressEnter: Boolean(pressEnter),
      }),
    );
    if (!result?.ok) throw new Error(result?.error ?? "Type failed");
    console.log(`[BrowserAction:Type] SUCCESS for selector: "${selector}"`);

    if (ctx.onActionRecorded) {
      ctx.onActionRecorded({ type: "type", selector, text, pressEnter });
    }

    return result;
  });
}

export async function execBrowserScroll(
  ctx: BrowserActionContext,
  direction: "up" | "down",
  amount?: number,
): Promise<Record<string, unknown>> {
  throwIfCancelled(ctx);
  const activeTab = await prepareTabForInteraction(ctx);
  const px = amount ?? 720;
  console.log(
    `[BrowserAction:Scroll] Direction: ${direction}, Amount: ${px}px`,
  );
  return runTimedAction(ctx, "Scroll", "light", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "tool_running",
      label: direction === "down" ? "Scrolling down…" : "Scrolling up…",
      tabId: activeTab.id,
      url: activeTab.url,
    });

    const wheelDelta = direction === "down" ? px : -px;
    const focus = shouldStealFocus(ctx);
    let nativeWheel: Record<string, unknown> | undefined;
    try {
      nativeWheel = await sendNativeWheel(activeTab, wheelDelta, { focus });
    } catch {
      /* fallback to JS scroll below */
    }

    const jsResult = await activeTab.runInteractionJs(
      buildBrowserScrollScript(direction, px),
    );
    if (!jsResult?.ok && !nativeWheel) throw new Error("Scroll failed");
    await sleep(350);
    console.log(`[BrowserAction:Scroll] SUCCESS.`);

    if (ctx.onActionRecorded) {
      ctx.onActionRecorded({ type: "scroll", selector: "body" });
    }

    return { ok: true, direction, amount: px, nativeWheel, jsScroll: jsResult };
  });
}

export async function execBrowserKey(
  ctx: BrowserActionContext,
  key: string,
): Promise<Record<string, unknown>> {
  throwIfCancelled(ctx);
  const activeTab = await prepareTabForInteraction(ctx);
  console.log(`[BrowserAction:Key] Key: "${key}"`);
  return runTimedAction(ctx, `Key ${key}`, "light", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "tool_running",
      label: `Key: ${key}`,
      tabId: activeTab.id,
      url: activeTab.url,
    });

    const focus = shouldStealFocus(ctx);

    try {
      await sendNativeKey(activeTab, key, { focus });
    } catch {
      const result = await activeTab.runJs(buildBrowserKeyScript(key));
      if (!result?.ok) throw new Error("Key press failed");
      await sleep(300);
      console.log(`[BrowserAction:Key] SUCCESS (JS).`);
      return result;
    }

    await sleep(300);
    console.log(`[BrowserAction:Key] SUCCESS (Native).`);
    return { ok: true, key, method: "native" };
  });
}

export async function execBrowserWait(
  ms: number,
  isCancelled?: () => boolean,
): Promise<{ ok: true; waitedMs: number }> {
  const capped = Math.min(ms, 120_000);
  await withActionTimeout({
    label: "Wait",
    tier: "medium",
    isCancelled,
    run: async () => {
      const step = 200;
      let waited = 0;
      while (waited < capped) {
        if (isCancelled?.()) throw new Error("Agent run cancelled");
        const chunk = Math.min(step, capped - waited);
        await sleep(chunk);
        waited += chunk;
      }
      return { ok: true, waitedMs: capped };
    },
  });
  return { ok: true, waitedMs: capped };
}

export async function execBrowserRefresh(
  ctx: BrowserActionContext,
): Promise<Record<string, unknown>> {
  const activeTab = getTab(ctx);
  return runTimedAction(ctx, "Refresh page", "medium", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "navigating",
      label: "Refreshing page…",
      tabId: activeTab.id,
      url: activeTab.url,
    });
    activeTab.reload();
    await activeTab.prepareForInteraction();
    if (ctx.window) await ctx.window.probeWebMcpAfterLoad(activeTab);
    ctx.agentActivity?.setViewportUrl(
      activeTab.id,
      activeTab.url,
      activeTab.title,
    );

    const read = await readPageWithSignals(
      activeTab.url,
      () => getTab(ctx).getTabText(),
      () => activeTab.runJs(PAGE_PROBE_SCRIPT),
      ctx.maxPageTextLength,
    );

    ctx.agentActivity?.emit({
      kind: "reading_page",
      label: "Reading refreshed page…",
      tabId: activeTab.id,
      url: activeTab.url,
    });

    return {
      ok: true,
      pageTitle: read.pageSignals.pageTitle,
      pageTextExcerpt: read.pageTextExcerpt,
      pageSignals: {
        youtubeUnavailable: read.pageSignals.youtubeUnavailable,
        youtubeWatchLinks: read.pageSignals.youtubeWatchLinks,
      },
      ...buildWebMcpToolResult(ctx, activeTab),
    };
  });
}

export async function execBrowserWaitTool(
  ctx: BrowserActionContext,
  ms: number,
): Promise<Record<string, unknown>> {
  const activeTab = ctx.window?.activeTab;
  const targetMs = Math.min(Math.max(ms, 500), 30000);
  console.log(`[BrowserAction:Wait] Duration: ${targetMs}ms`);
  ctx.agentActivity?.emit({
    kind: "reading_page",
    label: `Waiting ${targetMs}ms…`,
    tabId: activeTab?.id,
    url: activeTab?.url,
  });

  await execBrowserWait(targetMs, ctx.isCancelled);

  if (activeTab) {
    const read = await readPageWithSignals(
      activeTab.url,
      () => activeTab.getTabText(),
      () => activeTab.runJs(PAGE_PROBE_SCRIPT),
      ctx.maxPageTextLength,
    );
    console.log(`[BrowserAction:Wait] SUCCESS. Finished waiting.`);
    return {
      ok: true,
      waitedMs: targetMs,
      pageTitle: read.pageSignals.pageTitle,
      pageTextExcerpt: read.pageTextExcerpt,
      ...buildWebMcpToolResult(ctx, activeTab),
    };
  }

  console.log(`[BrowserAction:Wait] SUCCESS. Finished waiting.`);
  return { ok: true, waitedMs: targetMs };
}

export async function execBrowserTabCreate(
  ctx: BrowserActionContext,
  url?: string,
): Promise<Record<string, unknown>> {
  if (!ctx.window) throw new Error("Window context is missing");
  const newTab = ctx.window.createTab(url);
  console.log(
    `[BrowserAction:TabCreate] URL: "${url ?? "none"}", Allocated Tab ID: ${newTab.id}`,
  );

  return runTimedAction(ctx, "Create tab", "heavy", newTab, async () => {
    await newTab.prepareForInteraction();
    if (ctx.window) await ctx.window.probeWebMcpAfterLoad(newTab);
    ctx.agentActivity?.setViewportUrl(newTab.id, newTab.url, newTab.title);

    const read = await readPageWithSignals(
      newTab.url,
      () => newTab.getTabText(),
      () => newTab.runJs(PAGE_PROBE_SCRIPT),
      ctx.maxPageTextLength,
    );

    console.log(`[BrowserAction:TabCreate] SUCCESS. New Tab ID: ${newTab.id}`);
    return {
      ok: true,
      tabId: newTab.id,
      pageTitle: read.pageSignals.pageTitle,
      pageTextExcerpt: read.pageTextExcerpt,
      ...buildWebMcpToolResult(ctx, newTab),
    };
  });
}

export async function execBrowserTabSwitch(
  ctx: BrowserActionContext,
  tabId: string,
): Promise<Record<string, unknown>> {
  if (!ctx.window) throw new Error("Window context is missing");
  const tab = ctx.window.getTab(tabId);
  if (!tab) {
    console.error(
      `[BrowserAction:TabSwitch] FAILED. Tab ID ${tabId} not found.`,
    );
    throw new Error(`Tab not found: ${tabId}`);
  }

  console.log(`[BrowserAction:TabSwitch] Switching to Tab ID: ${tabId}`);
  ctx.window.switchActiveTab(tabId);
  const activeTab = ctx.window.activeTab;
  if (!activeTab) throw new Error("No active tab");

  return runTimedAction(ctx, "Switch tab", "medium", activeTab, async () => {
    await activeTab.prepareForInteraction();
    if (ctx.window) await ctx.window.probeWebMcpAfterLoad(activeTab);
    ctx.agentActivity?.setViewportUrl(
      activeTab.id,
      activeTab.url,
      activeTab.title,
    );

    const read = await readPageWithSignals(
      activeTab.url,
      () => activeTab.getTabText(),
      () => activeTab.runJs(PAGE_PROBE_SCRIPT),
      ctx.maxPageTextLength,
    );

    console.log(
      `[BrowserAction:TabSwitch] SUCCESS. Switched to Tab ID: ${activeTab.id}`,
    );
    return {
      ok: true,
      tabId: activeTab.id,
      pageTitle: read.pageSignals.pageTitle,
      pageTextExcerpt: read.pageTextExcerpt,
      ...buildWebMcpToolResult(ctx, activeTab),
    };
  });
}

export async function execBrowserTabClose(
  ctx: BrowserActionContext,
  tabId: string,
): Promise<Record<string, unknown>> {
  if (!ctx.window) throw new Error("Window context is missing");
  console.log(`[BrowserAction:TabClose] Closing Tab ID: ${tabId}`);
  const closed = ctx.window.closeTab(tabId);
  if (!closed) {
    console.error(
      `[BrowserAction:TabClose] FAILED. Failed to close tab: ${tabId}`,
    );
    throw new Error(`Failed to close tab: ${tabId}`);
  }

  const activeTab = ctx.window.activeTab;
  if (activeTab) {
    const read = await readPageWithSignals(
      activeTab.url,
      () => activeTab.getTabText(),
      () => activeTab.runJs(PAGE_PROBE_SCRIPT),
      ctx.maxPageTextLength,
    );
    console.log(
      `[BrowserAction:TabClose] SUCCESS. Focus shifted to Tab ID: ${activeTab.id}`,
    );
    return {
      ok: true,
      closedTabId: tabId,
      activeTabId: activeTab.id,
      pageTitle: read.pageSignals.pageTitle,
      pageTextExcerpt: read.pageTextExcerpt,
      ...buildWebMcpToolResult(ctx, activeTab),
    };
  }

  console.log(`[BrowserAction:TabClose] SUCCESS.`);
  return { ok: true, closedTabId: tabId };
}

export async function execBrowserTabList(
  ctx: BrowserActionContext,
): Promise<Record<string, unknown>> {
  if (!ctx.window) throw new Error("Window context is missing");
  const snapshot = ctx.window.getTabsSnapshot();
  console.log(`[BrowserAction:TabList] Found ${snapshot.length} tabs.`);
  return {
    ok: true,
    tabs: snapshot,
  };
}

export async function execBrowserWaitFor(
  ctx: BrowserActionContext,
  options: {
    selector?: string;
    text?: string;
    timeoutMs?: number;
  },
): Promise<Record<string, unknown>> {
  const activeTab = getTab(ctx);
  const timeoutMs = Math.min(
    Math.max(options.timeoutMs ?? 15000, 1000),
    120000,
  );
  const sel = options.selector?.trim() || null;
  const txt = options.text?.trim() || null;

  if (!sel && !txt) {
    throw new Error("Provide either selector or text to wait for");
  }

  const label = `Wait for ${sel ? `selector "${sel}"` : `text "${txt}"`}`;
  console.log(
    `[BrowserAction:WaitFor] Target: ${sel ? `selector "${sel}"` : `text "${txt}"`}, Timeout: ${timeoutMs}ms`,
  );

  return runTimedAction(ctx, label, "medium", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "reading_page",
      label: `Waiting for ${sel ? `selector` : `text`} (${Math.round(timeoutMs / 1000)}s max)…`,
      tabId: activeTab.id,
      url: activeTab.url,
    });

    const start = Date.now();
    const deadline = start + timeoutMs;
    const intervalMs = 300;
    let found = false;
    let snippet = "";
    let matchText = "";
    let matchGroups: string[] | undefined = undefined;

    while (Date.now() <= deadline) {
      if (ctx.isCancelled?.()) {
        throw new Error("Agent run cancelled");
      }

      const pageState = await activeTab.runJs(`
        (() => {
          const getPageText = (doc) => {
            let text = doc.body?.innerText || doc.documentElement?.innerText || "";
            try {
              var inputs = doc.querySelectorAll('input, textarea');
              for (var i = 0; i < inputs.length; i++) {
                text += " " + (inputs[i].value || "");
              }
            } catch (e) {}

            const iframes = Array.from(doc.querySelectorAll("iframe"));
            for (const iframe of iframes) {
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                  const iframeText = getPageText(iframeDoc);
                  if (iframeText.trim()) {
                    text += "\\n\\n" + iframeText;
                  }
                }
              } catch (e) {}
            }
            return text;
          };

          const isSelectorVisible = (s) => {
            try {
              var el = document.querySelector(s);
              if (el && el.offsetParent !== null) return true;
              
              var iframes = document.querySelectorAll('iframe');
              for (var f = 0; f < iframes.length; f++) {
                try {
                  var doc = iframes[f].contentDocument || iframes[f].contentWindow.document;
                  if (doc) {
                    var subEl = doc.querySelector(s);
                    if (subEl && subEl.offsetParent !== null) return true;
                  }
                } catch (e) {}
              }
            } catch (e) {}
            return false;
          };

          const expectedText = ${txt ? JSON.stringify(txt) : "null"};
          const selector = ${sel ? JSON.stringify(sel) : "null"};

          if (selector && isSelectorVisible(selector)) {
            try {
              var el = document.querySelector(selector);
              if (el && el.offsetParent !== null) {
                return {
                  found: true,
                  snippet: "Selector visible: " + (el.innerText || el.textContent || "").slice(0, 320),
                  match: el.outerHTML.slice(0, 500)
                };
              }
              var iframes = document.querySelectorAll('iframe');
              for (var f = 0; f < iframes.length; f++) {
                try {
                  var doc = iframes[f].contentDocument || iframes[f].contentWindow.document;
                  if (doc) {
                    var subEl = doc.querySelector(selector);
                    if (subEl && subEl.offsetParent !== null) {
                      return {
                        found: true,
                        snippet: "Selector visible in iframe: " + (subEl.innerText || subEl.textContent || "").slice(0, 320),
                        match: subEl.outerHTML.slice(0, 500)
                      };
                    }
                  }
                } catch (e) {}
              }
            } catch (e) {}
            return { found: true, snippet: "Selector visible", match: selector };
          }

          if (expectedText) {
            const normalizeText = (value) =>
              String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\\u0300-\\u036f]/g, "");

            const text = getPageText(document);
            const cleanExpected = String(expectedText || "").trim();

            const regexMatch = cleanExpected.match(/^\\/(.*)\\/([dgimsuvy]*)$/);
            if (regexMatch) {
              try {
                const flags = regexMatch[2].replace("g", "");
                const regex = new RegExp(regexMatch[1], flags);
                const m = text.match(regex);
                if (m) {
                  const matchStr = m[0];
                  const index = m.index ?? text.indexOf(matchStr);
                  const snippetStart = Math.max(0, index - 120);
                  return {
                    found: true,
                    snippet: text.slice(snippetStart, snippetStart + 320),
                    match: matchStr,
                    groups: m.slice(1)
                  };
                }
              } catch (e) {}
            } else {
              const normalizedText = normalizeText(text);
              const alternatives = cleanExpected.includes("|")
                ? cleanExpected.split("|")
                : [cleanExpected];

              for (let a = 0; a < alternatives.length; a++) {
                const part = normalizeText(alternatives[a].trim());
                if (part) {
                  const index = normalizedText.indexOf(part);
                  if (index !== -1) {
                    const snippetStart = Math.max(0, index - 120);
                    return {
                      found: true,
                      snippet: text.slice(snippetStart, snippetStart + 320),
                      match: text.slice(index, index + part.length)
                    };
                  }
                }
              }
            }
          }

          return { found: false, snippet: "" };
        })()
      `);

      if (pageState && pageState.found) {
        found = true;
        snippet = pageState.snippet;
        matchText = pageState.match || "";
        matchGroups = pageState.groups || undefined;
        break;
      }

      await sleep(intervalMs);
    }

    await activeTab.prepareForInteraction();
    if (ctx.window) await ctx.window.probeWebMcpAfterLoad(activeTab);

    const read = await readPageWithSignals(
      activeTab.url,
      () => activeTab.getTabText(),
      () => activeTab.runJs(PAGE_PROBE_SCRIPT),
      ctx.maxPageTextLength,
    );

    console.log(
      `[BrowserAction:WaitFor] FINISHED. Condition met: ${found}. Waited: ${Date.now() - start}ms`,
    );
    return {
      ok: true,
      conditionMet: found,
      waitedMs: Date.now() - start,
      snippet: snippet || undefined,
      match: matchText || undefined,
      groups: matchGroups,
      pageTitle: read.pageSignals.pageTitle,
      pageTextExcerpt: read.pageTextExcerpt,
      ...buildWebMcpToolResult(ctx, activeTab),
    };
  });
}

export async function execBrowserFindInPage(
  ctx: BrowserActionContext,
  query: string,
): Promise<Record<string, unknown>> {
  const activeTab = getTab(ctx);
  console.log(
    `[BrowserAction:FindInPage] Query: "${query}" on Tab: ${activeTab.id} (${activeTab.url})`,
  );

  return runTimedAction(
    ctx,
    `Find in page: ${query}`,
    "medium",
    activeTab,
    async () => {
      const result = await activeTab.runJs(`
      (() => {
        const getPageText = (doc) => {
          let text = doc.body?.innerText || doc.documentElement?.innerText || "";
          try {
            var inputs = doc.querySelectorAll('input, textarea');
            for (var i = 0; i < inputs.length; i++) {
              text += " " + (inputs[i].value || "");
            }
          } catch (e) {}

          const iframes = Array.from(doc.querySelectorAll("iframe"));
          for (const iframe of iframes) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (iframeDoc) {
                const iframeText = getPageText(iframeDoc);
                if (iframeText.trim()) {
                  text += "\\n\\n" + iframeText;
                }
              }
            } catch (e) {}
          }
          return text;
        };

        const text = getPageText(document);
        const cleanQuery = ${JSON.stringify(query.trim())};

        const matches = [];
        const normalizeText = (value) =>
          String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\\u0300-\\u036f]/g, "");

        const regexMatch = cleanQuery.match(/^\\/(.*)\\/([dgimsuvy]*)$/);
        if (regexMatch) {
          try {
            const flags = regexMatch[2].replace("g", "") + "g";
            const regex = new RegExp(regexMatch[1], flags);
            let match;
            while ((match = regex.exec(text)) !== null) {
              const matchStr = match[0];
              const index = match.index;
              const snippetStart = Math.max(0, index - 100);
              const snippetEnd = Math.min(text.length, index + matchStr.length + 100);
              matches.push({
                match: matchStr,
                index: index,
                snippet: text.slice(snippetStart, snippetEnd),
                groups: match.slice(1)
              });
              if (regex.lastIndex === index) {
                regex.lastIndex++;
              }
              if (matches.length >= 10) break;
            }
          } catch (e) {
            return { ok: false, error: "Invalid regex: " + e.message };
          }
        } else {
          const normText = normalizeText(text);
          const normQuery = normalizeText(cleanQuery);
          let index = normText.indexOf(normQuery);
          while (index !== -1) {
            const snippetStart = Math.max(0, index - 100);
            const snippetEnd = Math.min(text.length, index + cleanQuery.length + 100);
            matches.push({
              match: text.slice(index, index + cleanQuery.length),
              index: index,
              snippet: text.slice(snippetStart, snippetEnd)
            });
            index = normText.indexOf(normQuery, index + 1);
            if (matches.length >= 10) break;
          }
        }

        return { ok: true, matches: matches };
      })()
    `);

      return result;
    },
  );
}

export { isActionTimeoutError, actionTimeoutFields };

// ─── Feature: Background HTTP Fetch ─────────────────────────────────────────

/**
 * Fetch a URL in the background without navigating the active tab.
 * Useful for reading external API responses or pages without losing current state.
 */
export async function execBrowserFetchUrl(
  ctx: BrowserActionContext,
  url: string,
  maxChars = 15000,
): Promise<Record<string, unknown>> {
  const cleanUrl = url.trim();
  if (!cleanUrl) throw new Error("Missing url");

  // Basic safety: reject file:// and local network addresses
  if (/^(file|data|javascript):/i.test(cleanUrl)) {
    throw new Error("Unsafe URL scheme — only http/https allowed");
  }
  try {
    const parsed = new URL(cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`);
    const host = parsed.hostname.toLowerCase();
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
      throw new Error("Private/local URLs are not allowed for background fetch");
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("not allowed")) throw e;
    throw new Error(`Invalid URL: ${cleanUrl}`);
  }

  const targetUrl = cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`;
  const capped = Math.min(Math.max(maxChars, 1000), 30000);

  console.log(`[BrowserAction:FetchUrl] Fetching: "${targetUrl}" (max ${capped} chars)`);

  ctx.agentActivity?.emit({
    kind: "reading_page",
    label: `Fetching ${targetUrl} in background…`,
    url: targetUrl,
  });

  return withActionTimeout({
    label: "Background fetch",
    tier: "heavy",
    isCancelled: ctx.isCancelled,
    run: async () => {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) BlueberryBrowser/1.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          statusText: response.statusText,
          url: targetUrl,
          error: `HTTP ${response.status} ${response.statusText}`,
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      const raw = await response.text();
      let text: string;

      if (contentType.includes("json")) {
        // Pretty-print JSON
        try {
          text = JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          text = raw;
        }
      } else {
        // Strip HTML tags for readability
        text = raw
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
      }

      const truncated = text.slice(0, capped);
      console.log(
        `[BrowserAction:FetchUrl] SUCCESS. Status: ${response.status}, chars: ${truncated.length}`,
      );
      return {
        ok: true,
        url: targetUrl,
        status: response.status,
        contentType,
        textContent: truncated,
        truncated: text.length > capped,
        totalChars: text.length,
      };
    },
  });
}

// ─── Feature: Scoped Page Inspection ─────────────────────────────────────────

/**
 * Inspect only a specific section of the page identified by a CSS selector.
 * Returns inputs, buttons, links, and text from just that container.
 * Much cheaper in tokens than a full-page inspect for complex pages.
 */
export async function execBrowserInspectScoped(
  ctx: BrowserActionContext,
  scopeSelector: string,
): Promise<Record<string, unknown>> {
  const activeTab = getTab(ctx);
  const sel = scopeSelector.trim();
  if (!sel) throw new Error("Missing scopeSelector");

  console.log(
    `[BrowserAction:InspectScoped] Selector: "${sel}" on Tab: ${activeTab.id} (${activeTab.url})`,
  );

  return runTimedAction(ctx, "Inspect scoped", "medium", activeTab, async () => {
    ctx.agentActivity?.emit({
      kind: "reading_page",
      label: `Inspecting section: ${sel}…`,
      tabId: activeTab.id,
      url: activeTab.url,
    });

    const escapedSel = JSON.stringify(sel);
    const result = await activeTab.runJs(`
      (() => {
        function findRoot(s) {
          var el = document.querySelector(s);
          if (el) return { el: el, doc: document };
          try {
            var iframes = document.querySelectorAll("iframe");
            for (var f = 0; f < iframes.length; f++) {
              try {
                var doc = iframes[f].contentDocument || iframes[f].contentWindow.document;
                if (doc) {
                  var sub = doc.querySelector(s);
                  if (sub) return { el: sub, doc: doc };
                }
              } catch(e) {}
            }
          } catch(e) {}
          return null;
        }

        var found = findRoot(${escapedSel});
        if (!found) {
          return { ok: false, error: "Selector not found: " + ${escapedSel} };
        }
        var root = found.el;

        function lbl(el) {
          return (
            el.getAttribute("aria-label") ||
            (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80) ||
            el.getAttribute("placeholder") ||
            el.getAttribute("name") ||
            el.tagName.toLowerCase()
          );
        }

        function ref(el, prefix, idx) {
          if (!el.getAttribute("data-berry-ref")) {
            el.setAttribute("data-berry-ref", prefix + "-sc-" + idx);
          }
          return '[data-berry-ref="' + el.getAttribute("data-berry-ref") + '"]';
        }

        var inputs = [];
        var inEls = root.querySelectorAll('input:not([type="hidden"]), textarea, select');
        for (var i = 0; i < inEls.length && inputs.length < 20; i++) {
          var el = inEls[i];
          if (el.offsetParent === null && el.type !== "email") continue;
          inputs.push({ selector: ref(el, "sc-in", i), type: el.type || el.tagName.toLowerCase(), label: lbl(el), value: (el.value || "").slice(0, 80) });
        }

        var buttons = [];
        var btnEls = root.querySelectorAll('button, [role="button"], input[type="submit"]');
        for (var j = 0; j < btnEls.length && buttons.length < 15; j++) {
          var b = btnEls[j];
          if (b.offsetParent === null) continue;
          buttons.push({ selector: ref(b, "sc-btn", j), label: lbl(b) });
        }

        var links = [];
        var linkEls = root.querySelectorAll("a[href]");
        for (var k = 0; k < linkEls.length && links.length < 15; k++) {
          var a = linkEls[k];
          if (a.offsetParent === null) continue;
          var href = a.href || "";
          if (!href || href.startsWith("javascript:")) continue;
          links.push({ selector: ref(a, "sc-lnk", k), label: lbl(a), href: href.slice(0, 200) });
        }

        var checkboxes = [];
        var cbEls = root.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
        for (var c = 0; c < cbEls.length && checkboxes.length < 10; c++) {
          var cb = cbEls[c];
          var checked = cb.tagName === "INPUT" ? Boolean(cb.checked) : cb.getAttribute("aria-checked") === "true";
          checkboxes.push({ selector: ref(cb, "sc-cb", c), label: lbl(cb), checked: checked });
        }

        var text = (root.innerText || root.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 4000);

        return {
          ok: true,
          scopeSelector: ${escapedSel},
          pageUrl: location.href,
          scopeText: text,
          inputs: inputs,
          buttons: buttons,
          links: links,
          checkboxes: checkboxes,
        };
      })()
    `);

    if (!result || typeof result !== "object")
      throw new Error("Scoped inspect failed");
    console.log(
      `[BrowserAction:InspectScoped] SUCCESS. Inputs: ${(result as { inputs?: unknown[] }).inputs?.length ?? 0}, Buttons: ${(result as { buttons?: unknown[] }).buttons?.length ?? 0}`,
    );
    return result as Record<string, unknown>;
  });
}

// ─── Feature: Smart Content Extraction ───────────────────────────────────────

/**
 * Extract content from the most relevant container on the page.
 * Finds a section by text query or CSS selector and returns its text + elements.
 * Ideal for reading emails, cards, modals, product listings without scanning the whole page.
 */
export async function execBrowserExtractContent(
  ctx: BrowserActionContext,
  options: {
    textQuery?: string;
    selector?: string;
    maxChars?: number;
    includeLinks?: boolean;
    includeElements?: boolean;
  },
): Promise<Record<string, unknown>> {
  const activeTab = getTab(ctx);
  const { textQuery, selector, maxChars = 4000, includeLinks = true, includeElements = true } =
    options;

  if (!textQuery && !selector) {
    throw new Error("Provide either textQuery or selector");
  }

  console.log(
    `[BrowserAction:ExtractContent] textQuery: "${textQuery ?? ""}" selector: "${selector ?? ""}" on Tab: ${activeTab.id}`,
  );

  return runTimedAction(
    ctx,
    "Extract content",
    "medium",
    activeTab,
    async () => {
      ctx.agentActivity?.emit({
        kind: "reading_page",
        label: textQuery
          ? `Finding "${textQuery}" on page…`
          : `Extracting from ${selector}…`,
        tabId: activeTab.id,
        url: activeTab.url,
      });

      const scriptArgs = JSON.stringify({
        textQuery: textQuery ?? null,
        selector: selector ?? null,
        maxChars,
        includeLinks,
        includeElements,
      });

      const result = await activeTab.runJs(`
        (() => {
          var opts = ${scriptArgs};

          function lbl(el) {
            return (
              el.getAttribute("aria-label") ||
              (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80) ||
              el.getAttribute("placeholder") ||
              el.getAttribute("name") ||
              el.tagName.toLowerCase()
            );
          }

          function ref(el, prefix, idx) {
            if (!el.getAttribute("data-berry-ref")) {
              el.setAttribute("data-berry-ref", prefix + "-ex-" + idx);
            }
            return '[data-berry-ref="' + el.getAttribute("data-berry-ref") + '"]';
          }

          // Walk up to find the best container wrapping the target
          function bestContainer(el) {
            var current = el.parentElement;
            var prev = el;
            var maxDepth = 8;
            while (current && maxDepth-- > 0) {
              var text = (current.innerText || current.textContent || "").trim();
              // Stop if container has lots of text (it's the section we want)
              if (text.length > 200) return current;
              prev = current;
              current = current.parentElement;
            }
            return prev || el;
          }

          // Search all documents including iframes
          function searchAllDocs(fn) {
            var result = fn(document);
            if (result) return result;
            try {
              var iframes = document.querySelectorAll("iframe");
              for (var f = 0; f < iframes.length; f++) {
                try {
                  var doc = iframes[f].contentDocument || iframes[f].contentWindow.document;
                  if (doc) {
                    var r = fn(doc);
                    if (r) return r;
                  }
                } catch(e) {}
              }
            } catch(e) {}
            return null;
          }

          var container = null;
          var foundBy = null;

          // 1. Try explicit CSS selector first
          if (opts.selector) {
            container = searchAllDocs(function(doc) { return doc.querySelector(opts.selector); });
            if (container) foundBy = "selector";
          }

          // 2. If no selector or not found, find by text query
          if (!container && opts.textQuery) {
            var normalizedQuery = opts.textQuery.toLowerCase();
            container = searchAllDocs(function(doc) {
              // Walk text nodes to find where the query appears
              var allEls = doc.querySelectorAll("p, h1, h2, h3, h4, li, td, div, span, article, section");
              for (var i = 0; i < allEls.length; i++) {
                var el = allEls[i];
                var t = (el.innerText || el.textContent || "").toLowerCase();
                if (t.indexOf(normalizedQuery) !== -1 && t.length < 2000) {
                  foundBy = "textQuery";
                  return bestContainer(el);
                }
              }
              return null;
            });
          }

          if (!container) {
            return {
              ok: false,
              error: opts.textQuery
                ? 'Text "' + opts.textQuery + '" not found on page'
                : 'Selector "' + opts.selector + '" not found',
            };
          }

          // Build a CSS selector path for the found container if it has an ID or class
          var containerSelector = null;
          if (container.id) {
            containerSelector = "#" + container.id;
          } else if (container.getAttribute("data-berry-ref")) {
            containerSelector = '[data-berry-ref="' + container.getAttribute("data-berry-ref") + '"]';
          } else if (container.className && typeof container.className === "string") {
            var cls = container.className.trim().split(/\\s+/)[0];
            if (cls) containerSelector = container.tagName.toLowerCase() + "." + cls;
          }
          if (!containerSelector) {
            ref(container, "ex-root", 0);
            containerSelector = '[data-berry-ref="' + container.getAttribute("data-berry-ref") + '"]';
          }

          var text = (container.innerText || container.textContent || "").replace(/\\s+/g, " ").trim().slice(0, opts.maxChars);

          var links = [];
          if (opts.includeLinks) {
            var linkEls = container.querySelectorAll("a[href]");
            for (var k = 0; k < linkEls.length && links.length < 10; k++) {
              var a = linkEls[k];
              if (!a.href || a.href.startsWith("javascript:")) continue;
              links.push({ selector: ref(a, "ex-lnk", k), label: lbl(a), href: a.href.slice(0, 200) });
            }
          }

          var elements = [];
          if (opts.includeElements) {
            var actionEls = container.querySelectorAll('button, [role="button"], input, a[href]');
            for (var e = 0; e < actionEls.length && elements.length < 10; e++) {
              var ae = actionEls[e];
              if (ae.offsetParent === null) continue;
              elements.push({ selector: ref(ae, "ex-el", e), tag: ae.tagName.toLowerCase(), label: lbl(ae) });
            }
          }

          return {
            ok: true,
            foundBy: foundBy,
            containerSelector: containerSelector,
            text: text,
            links: links,
            elements: elements,
            charCount: text.length,
          };
        })()
      `);

      if (!result || typeof result !== "object")
        throw new Error("Extract content failed");
      console.log(
        `[BrowserAction:ExtractContent] SUCCESS. foundBy: ${(result as { foundBy?: string }).foundBy ?? "?"}`,
      );
      return result as Record<string, unknown>;
    },
  );
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

