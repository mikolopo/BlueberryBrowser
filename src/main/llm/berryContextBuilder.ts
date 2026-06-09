import type { CoreMessage } from "ai";
import type { Window } from "../Window";
import type { AgentActivityService } from "../agent/AgentActivityService";
import type { WebMcpToolDescriptor } from "../../shared/webmcp-types";
import { BERRY_STATIC_SYSTEM_PROMPT } from "../prompts/berrySystemPrompt";
import {
  buildDynamicContextBlock,
  wrapUserMessageWithContext,
  type SearchPreflightContext,
} from "../prompts/berryDynamicContext";
import { resolveSearchPreflightQuery } from "../prompts/berrySearchIntent";
import { execBrowserSearch } from "../navigation/browserActionExecutors";
import { getActionRecipeStore } from "../actions/ActionRecipeStore";
import { listActionTemplates } from "../actions/ActionTemplates";
import { sleep } from "./llmErrorUtils";

export const PAGE_TEXT_READ_TIMEOUT_MS = 6000;

export interface BerryContextRequest {
  message: string;
  webMcpEnabled?: boolean;
  webMcpGlobalEnabled?: boolean;
}

export interface BerryContextBuilderDeps {
  window: Window | null;
  agentActivity: AgentActivityService | null;
  history: CoreMessage[];
  request: BerryContextRequest;
  maxPageTextLength: number;
  defaultFlightDate: string;
  isCancelled: () => boolean;
  onTrackTabViewport: (tab: { id: string; url: string; title: string }) => void;
}

export async function buildBerryRequestMessages(
  deps: BerryContextBuilderDeps,
): Promise<CoreMessage[]> {
  const {
    window,
    agentActivity,
    history,
    request,
    maxPageTextLength,
    defaultFlightDate,
    isCancelled,
    onTrackTabViewport,
  } = deps;

  let pageUrl: string | null = null;
  let pageText: string | null = null;
  let webMcpTools: WebMcpToolDescriptor[] = [];

  const webMcpGlobalEnabled =
    request.webMcpGlobalEnabled ?? request.webMcpEnabled ?? false;

  if (window?.activeTab) {
    const activeTab = window.activeTab;
    pageUrl = activeTab.url;
    onTrackTabViewport(activeTab);
    const snapshot = window.webMcpService.registry.getForTab(activeTab.id);
    webMcpTools = snapshot?.tools ?? [];

    if (webMcpTools.length === 0) {
      try {
        agentActivity?.emit({
          kind: "reading_page",
          label: "Reading page content…",
          tabId: activeTab.id,
          url: activeTab.url,
        });
        pageText = await Promise.race([
          activeTab.getTabText(),
          sleep(PAGE_TEXT_READ_TIMEOUT_MS).then(() => null),
        ]);
      } catch {
        /* page text optional */
      }
    }
  }

  const toolsActive = webMcpGlobalEnabled && webMcpTools.length > 0;
  const pendingSearchQuery = resolveSearchPreflightQuery(
    history,
    request.message,
  );
  let searchPreflight: SearchPreflightContext | null = null;

  if (pendingSearchQuery && window?.activeTab) {
    try {
      const result = await execBrowserSearch(
        {
          window,
          agentActivity,
          maxPageTextLength,
          isCancelled,
        },
        pendingSearchQuery,
      );
      pageUrl = window.activeTab.url;
      const results: NonNullable<SearchPreflightContext["searchResults"]> =
        Array.isArray(result.searchResults)
          ? (result.searchResults as NonNullable<
              SearchPreflightContext["searchResults"]
            >)
          : [];
      searchPreflight = {
        query: pendingSearchQuery,
        ok: Boolean(result.ok),
        navigatedTo:
          typeof result.navigatedTo === "string"
            ? result.navigatedTo
            : undefined,
        searchResults: results,
        resultCount:
          typeof result.resultCount === "number"
            ? result.resultCount
            : results.length,
      };
    } catch (error) {
      searchPreflight = {
        query: pendingSearchQuery,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const contextBlock = buildDynamicContextBlock({
    pageUrl,
    pageText,
    webMcpTools,
    toolsActive,
    webMcpGlobalEnabled,
    defaultFlightDate,
    savedActionRecipes: getActionRecipeStore().listSummaries(),
    actionTemplates: listActionTemplates(),
    ongoingTask: window?.ongoingTaskService.getState() ?? null,
    ongoingTasks: window?.ongoingTaskService.listTasks() ?? [],
    searchPreflight,
    pendingSearchQuery: searchPreflight ? null : pendingSearchQuery,
  });

  const systemMessage: CoreMessage = {
    role: "system",
    content: BERRY_STATIC_SYSTEM_PROMPT,
  };

  const apiMessages: CoreMessage[] = [systemMessage];

  if (history.length === 0) {
    apiMessages.push({
      role: "user",
      content: wrapUserMessageWithContext(request.message, contextBlock),
    });
    return apiMessages;
  }

  const prior = history.slice(0, -1);
  const last = history[history.length - 1];
  apiMessages.push(...prior);

  const userText =
    last?.role === "user" && typeof last.content === "string"
      ? last.content
      : request.message;

  const wrappedText = wrapUserMessageWithContext(userText, contextBlock);

  if (!toolsActive && window?.activeTab && !pageText) {
    try {
      const image = await window.activeTab.screenshot();
      agentActivity?.emit({
        kind: "screenshot",
        label: "Capturing tab screenshot…",
        tabId: window.activeTab.id,
        url: window.activeTab.url,
      });
      apiMessages.push({
        role: "user",
        content: [
          { type: "image", image: image.toDataURL() },
          { type: "text", text: wrappedText },
        ],
      });
      return apiMessages;
    } catch {
      /* screenshot optional */
    }
  }

  apiMessages.push({ role: "user", content: wrappedText });
  return apiMessages;
}
