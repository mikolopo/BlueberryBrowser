import type { WebMcpToolDescriptor } from "../../shared/webmcp-types";
import type { ActionRecipeSummary } from "../../shared/action-recipe-types";
import type {
  BerryActionTemplate,
  BerryOngoingTaskState,
} from "../../shared/berry-task-types";

const MAX_PAGE_TEXT_LENGTH = 4000;

export interface SearchPreflightContext {
  query: string;
  ok: boolean;
  navigatedTo?: string;
  searchResults?: Array<{
    title?: string;
    href?: string;
    selector?: string | null;
  }>;
  resultCount?: number;
  error?: string;
}

export interface BerryDynamicContextInput {
  pageUrl: string | null;
  pageText: string | null;
  webMcpTools: WebMcpToolDescriptor[];
  toolsActive: boolean;
  webMcpGlobalEnabled: boolean;
  defaultFlightDate: string;
  savedActionRecipes?: ActionRecipeSummary[];
  actionTemplates?: BerryActionTemplate[];
  ongoingTask?: BerryOngoingTaskState | null;
  ongoingTasks?: BerryOngoingTaskState[];
  searchPreflight?: SearchPreflightContext | null;
  pendingSearchQuery?: string | null;
}

export const buildDynamicContextBlock = (
  input: BerryDynamicContextInput,
): string => {
  const timestamp = new Date().toISOString();
  const toolNames = input.webMcpTools.map((t) => t.name);
  const lines: string[] = [
    "<dynamic_execution_context>",
    "<environment_metadata>",
    `<execution_timestamp>${timestamp}</execution_timestamp>`,
    `<active_tab_url>${escapeXml(input.pageUrl ?? "none")}</active_tab_url>`,
    `<default_flight_date>${input.defaultFlightDate}</default_flight_date>`,
    `<webmcp_global_toggle>${input.webMcpGlobalEnabled ? "ON" : "OFF"}</webmcp_global_toggle>`,
    `<tools_on_page>${toolNames.length > 0 ? toolNames.join(", ") : "none"}</tools_on_page>`,
    `<tools_callable_this_turn>${input.toolsActive ? "YES" : "NO"}</tools_callable_this_turn>`,
    `<browser_tools_available>ALWAYS — navigate, search, inspect, click, type, scroll, pressKey, wait, refresh, tabCreate, tabSwitch, tabClose, tabList, waitFor, findInPage, planStepInsert, planStepDelete, actionRecipe*, berryTaskStart/RunOnce/Stop/Status</browser_tools_available>`,
    `<execution_rule>Browse/signup/multi-site tasks MUST call tools this turn. NEVER refuse or tell user to do steps manually. Exact URL Navigation: If a specific URL is provided, you MUST navigate to that exact URL; do NOT simplify/truncate to the domain or homepage. Unknown site or "search for …" → browserSearch (use chat history for "it"/"same X"). Multi-step/action tasks (e.g. form fills, multiple checkboxes, signups, multi-site): FIRST tool call MUST be berryPlanSet with a highly detailed, granular plan of 5-15 steps (describing every page load, inspect step, field fill, checkbox check, wait condition, verification action, tab switch, and final click). Checklist steps MUST be structuralized: prefix each with the active tab (e.g. "Tab 1: ...") and describe the handoff data/validation criteria. The initial plan MUST explicitly anticipate/include steps to close cookie popups and check required consent/confirmation boxes. Dynamic Plan: use berryPlanStepInsert or berryPlanStepDelete to insert/delete steps on the go instead of overwriting the entire plan. Strict Sequential Step Execution: You MUST execute steps strictly one by one in order. Perform actions for step N, verify the actions succeeded (e.g. state changed, inputs verified), call berryPlanUpdate { stepIndex: N, status: "done" }, and only then proceed to actions/tool calls for step N+1. Do NOT perform actions for a subsequent step until the previous step is verified and marked "done". Response Checklist: Do NOT write your own markdown checklist in your text responses. The system prepends progress at the top. Mandatory Re-Inspect After Wait: You MUST call browserInspectPage immediately after any browserWaitFor returns successfully. Do NOT interact or click elements without inspecting first. Multi-site: complete every phase. For ALL forms, signups, registrations, and discount/coupon claims: Use checkboxes[] from inspect. Disambiguate inputs & checkboxes: explain reasoning before typing/clicking. Action verification: ALWAYS inspect page after clicking checkboxes to verify "checked: true" BEFORE submitting. Scroll & Click: Scroll elements into view using browserScroll and re-inspect before clicking; click a button multiple times if it needs activation or fails to register. Anti-Blind Click Loops: DO NOT repeatedly click a submit/action button if page does not navigate. If click fails, immediately browserInspectPage, locate text errors/unchecked checkboxes, correct, verify, and only then click submit. Cookie Banners: check for and accept/close GDPR/cookie banners first. Anti-Refresh: NEVER refresh page once email/code/link is received/visible. Waiting & Finding Codes: Use browserWaitFor with a text/regex pattern and a LONG timeout (e.g. timeoutMs: 60000) to poll page internally; do NOT call wait tools repeatedly in short loops. If page text is truncated in pageTextExcerpt, call browserFindInPage to scan full DOM recursively. Action timeouts: light 10s, medium 25s, heavy 45s — if timedOut, inspect and adapt.</execution_rule>`,
    "</environment_metadata>",
  ];

  if (input.pendingSearchQuery) {
    lines.push("<mandatory_search>");
    lines.push(
      `User needs an unknown site. FIRST tool call MUST be browserSearch with query="${escapeXml(input.pendingSearchQuery)}". Do NOT ask the user for a URL.`,
    );
    lines.push("</mandatory_search>");
  }

  if (input.searchPreflight) {
    const pf = input.searchPreflight;
    lines.push("<search_preflight>");
    lines.push(`<query>${escapeXml(pf.query)}</query>`);
    if (pf.ok && pf.searchResults && pf.searchResults.length > 0) {
      lines.push("Search already executed. Top results:");
      for (const r of pf.searchResults.slice(0, 8)) {
        lines.push(
          `- ${escapeXml(r.title ?? "result")}: ${escapeXml(r.href ?? "")}`,
        );
      }
      lines.push(
        "NEXT: browserNavigate to the best href above, then browserInspectPage and continue the user's task. Do NOT ask for a URL.",
      );
    } else if (pf.ok) {
      lines.push(
        "Search ran but no structured results — browserInspectPage on the current tab and pick a link, or browserSearch with a refined query.",
      );
    } else {
      lines.push(
        `Search attempt failed: ${escapeXml(pf.error ?? "unknown error")}`,
      );
      lines.push(
        "Retry browserSearch with a refined query, then browserNavigate to the best result.",
      );
    }
    lines.push("</search_preflight>");
  }

  lines.push("<webmcp_policy>");
  if (!input.webMcpGlobalEnabled) {
    lines.push(
      "WebMCP toggle OFF — do NOT call searchFlights/searchProducts/addTask/etc. Use browser tools only.",
      "If user wants demo tools: ask them to enable WebMCP in chat settings (sliders icon), or use browserClick on the page.",
    );
  } else if (input.webMcpTools.length === 0) {
    lines.push(
      "WebMCP toggle ON — no tools on current page yet.",
      "If task needs demo tools: browserNavigate to /demo/flights.html, /demo/shop.html, or /demo/focus.html.",
      "After navigate, browserNavigate/browserInspectPage return webMcp.toolsAvailable — then call those WebMCP tools (NOT browserClick on search/forms). Tools become callable mid-turn once the page registers them.",
    );
  } else if (input.toolsActive) {
    lines.push(
      "WebMCP ACTIVE — prefer these structured tools when the task matches (over browserClick on same action):",
      input.webMcpTools
        .map((t) => `- ${t.name}: ${t.description || "no description"}`)
        .join("\n"),
      "Still use browserNavigate / browserInspectPage. Use browser* for anything no WebMCP tool covers.",
    );
  } else {
    lines.push(
      "WebMCP tools detected on page but toggle may be OFF — enable WebMCP in chat settings if user wants structured demo tools.",
    );
  }
  lines.push("</webmcp_policy>");

  lines.push("<ongoing_tasks>");
  const tasks = input.ongoingTasks?.length
    ? input.ongoingTasks
    : input.ongoingTask?.running
      ? [input.ongoingTask]
      : [];
  if (tasks.length > 0) {
    for (const t of tasks) {
      lines.push(
        `- RUNNING: ${escapeXml(t.name)} (id=${escapeXml(t.taskId)}) tick ${t.tickCount}, every ${Math.round(t.everyMs / 1000)}s`,
      );
    }
    lines.push(
      "Scroll + mute together: keep interval task running; use berryTaskRunOnce youtube-toggle-mute OR browserPressKey m for mute/unmute.",
    );
  } else {
    lines.push("No background tasks running.");
  }
  lines.push(
    "Interval: berryTaskStart. One-shot (mute): berryTaskRunOnce youtube-toggle-mute. Multiple tasks allowed (concurrent default).",
  );
  if (input.actionTemplates?.length) {
    lines.push("Templates:");
    for (const t of input.actionTemplates) {
      const kind = t.once ? "once" : "interval";
      lines.push(`- ${t.id} (${kind}): ${escapeXml(t.description)}`);
    }
  }
  lines.push("</ongoing_tasks>");

  if (input.savedActionRecipes && input.savedActionRecipes.length > 0) {
    lines.push("<saved_action_recipes>");
    for (const r of input.savedActionRecipes.slice(0, 12)) {
      const desc = r.description ? `: ${escapeXml(r.description)}` : "";
      lines.push(
        `- ${escapeXml(r.name)} (${r.stepCount} steps, id=${escapeXml(r.id)})${desc}`,
      );
    }
    lines.push("</saved_action_recipes>");
  }

  if (input.pageText && !input.toolsActive) {
    lines.push(
      "<active_webpage_text>",
      truncateText(input.pageText, MAX_PAGE_TEXT_LENGTH),
      "</active_webpage_text>",
    );
  }

  if (input.toolsActive && input.webMcpTools.length > 0) {
    lines.push("<active_webmcp_tools>");
    for (const tool of input.webMcpTools) {
      lines.push(
        `<tool name="${escapeXml(tool.name)}">`,
        escapeXml(tool.description || "No description"),
        "</tool>",
      );
    }
    lines.push("</active_webmcp_tools>");
  }

  lines.push("</dynamic_execution_context>");
  return lines.join("\n");
};

export const wrapUserMessageWithContext = (
  userMessage: string,
  contextBlock: string,
): string =>
  `${contextBlock}\n\n<active_user_query>\n${userMessage}\n</active_user_query>`;

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
