import { dynamicTool, jsonSchema, type ToolSet } from "ai";
import type { Window } from "../Window";
import type { AgentActivityService } from "../agent/AgentActivityService";
import {
  execBrowserClick,
  execBrowserInspect,
  execBrowserKey,
  execBrowserNavigate,
  execBrowserScroll,
  execBrowserSearch,
  execBrowserType,
  execBrowserRefresh,
  execBrowserWaitTool,
  execBrowserTabCreate,
  execBrowserTabSwitch,
  execBrowserTabClose,
  execBrowserTabList,
  execBrowserWaitFor,
  execBrowserFindInPage,
  execBrowserFetchUrl,
  execBrowserInspectScoped,
  execBrowserExtractContent,
  type BrowserActionContext,
} from "../navigation/browserActionExecutors";
import { actionTimeoutFields } from "../navigation/actionTimeout";
import { appendActionRecipeTools } from "./berryActionRecipeTools";
import { appendBerryTaskTools } from "./berryTaskTools";
import { appendBerryPlanTools } from "./berryPlanTools";
import type { OngoingTaskService } from "../actions/OngoingTaskService";
import type { WebMcpToolDescriptor } from "../../shared/webmcp-types";


/** Fixed tool registration order — do not reorder (prompt cache prefix stability). */
export const STATIC_DEMO_TOOL_NAMES = [
  "addTask",
  "addToCart",
  "bookFlight",
  "checkout",
  "completeTask",
  "getCart",
  "getOffers",
  "listTasks",
  "searchFlights",
  "searchProducts",
  "startFocusSession",
] as const;

/** Browser + recipe tools — always eligible when agent runs. */
export const BERRY_BROWSER_TOOL_NAMES = [
  "browserNavigate",
  "browserSearch",
  "browserInspectPage",
  "browserClick",
  "browserType",
  "browserScroll",
  "browserPressKey",
  "browserWait",
  "browserRefresh",
  "browserTabCreate",
  "browserTabSwitch",
  "browserTabClose",
  "browserTabList",
  "browserWaitFor",
  "browserFindInPage",
  "browserFetchUrl",
  "browserInspectSection",
  "browserExtractContent",
  "actionRecipeSave",
  "actionRecipeList",
  "actionRecipeRun",
  "actionRecipeDelete",
  "berryTaskStart",
  "berryTaskRunOnce",
  "berryTaskStop",
  "berryTaskStatus",
  "berryPlanSet",
  "berryPlanUpdate",
  "berryPlanStepInsert",
  "berryPlanStepDelete",
] as const;

export function buildActiveToolNames(
  webMcpEnabled: boolean,
  pageWebMcpToolNames: string[],
): string[] {
  const names: string[] = [...BERRY_BROWSER_TOOL_NAMES];
  if (!webMcpEnabled || pageWebMcpToolNames.length === 0) {
    return names;
  }
  for (const name of pageWebMcpToolNames) {
    names.push(name);
  }
  return names;
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  searchFlights:
    "Search flights by destination (required). Optional: date YYYY-MM-DD, cabin, passengers.",
  getOffers:
    "List current flight offers; optional maxPrice (PLN), sortBy price|duration.",
  bookFlight: "Book flight by offerId and passengerName; optional email.",
  searchProducts:
    "Search BerryMart catalog by query; optional category, maxPrice.",
  addToCart: "Add product by productId; optional quantity (default 1).",
  getCart: "Return cart items, subtotal, shipping, total.",
  checkout: "Place order with fullName and address; optional paymentMethod.",
  addTask: "Create task with title; optional priority low|medium|high, tag.",
  listTasks: "List tasks; optional status all|active|done, tag filter.",
  completeTask: "Mark task done by taskId.",
  startFocusSession: "Start Pomodoro; optional taskId, minutes (default 25).",
};

const TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  searchFlights: {
    type: "object",
    properties: {
      destination: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      cabin: { type: "string" },
      passengers: { type: "number" },
    },
    required: ["destination"],
  },
  getOffers: {
    type: "object",
    properties: {
      maxPrice: { type: "number" },
      sortBy: { type: "string", enum: ["price", "duration"] },
    },
  },
  bookFlight: {
    type: "object",
    properties: {
      offerId: { type: "string" },
      passengerName: { type: "string" },
      email: { type: "string" },
    },
    required: ["offerId"],
  },
  searchProducts: {
    type: "object",
    properties: {
      q: { type: "string" },
      category: { type: "string" },
      maxPrice: { type: "number" },
    },
  },
  addToCart: {
    type: "object",
    properties: {
      productId: { type: "string" },
      quantity: { type: "number" },
    },
    required: ["productId"],
  },
  getCart: { type: "object", properties: {} },
  checkout: {
    type: "object",
    properties: {
      fullName: { type: "string" },
      address: { type: "string" },
      paymentMethod: { type: "string" },
    },
  },
  addTask: {
    type: "object",
    properties: {
      title: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      tag: { type: "string" },
    },
    required: ["title"],
  },
  listTasks: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["all", "active", "done"] },
      tag: { type: "string" },
    },
  },
  completeTask: {
    type: "object",
    properties: { taskId: { type: "string" } },
    required: ["taskId"],
  },
  startFocusSession: {
    type: "object",
    properties: {
      taskId: { type: "string" },
      minutes: { type: "number" },
    },
  },
};

export interface StaticToolRuntime {
  window: Window | null;
  agentActivity: AgentActivityService | null;
  webMcpEnabledForRequest: boolean;
  defaultFlightDate: string;
  maxPageTextLength: number;
  isCancelled?: () => boolean;
  ongoingTasks: OngoingTaskService | null;
  pageWebMcpTools?: WebMcpToolDescriptor[];
}

export const buildStaticToolSet = (runtime: StaticToolRuntime): ToolSet => {
  const tools: ToolSet = {};

  const browserCtx = (): BrowserActionContext => ({
    window: runtime.window,
    agentActivity: runtime.agentActivity,
    maxPageTextLength: runtime.maxPageTextLength,
    isCancelled: runtime.isCancelled,
  });

  const safeBrowser = async (
    fn: () => Promise<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> => {
    try {
      return await fn();
    } catch (error) {
      const fields = actionTimeoutFields(error);
      if (fields) return fields;
      throw error;
    }
  };

  tools.browserNavigate = dynamicTool({
    description:
      "Navigate the active tab to a known URL, domain (example.com), bare site name (reddit → reddit.com), or local path (/demo/index.html). " +
      "For unknown sites/brands or when user says 'search for …', use browserSearch instead. " +
      "Returns pageTextExcerpt, pageTitle, pageSignals.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "Known target: https://…, domain.com, site name, or /demo/path",
        },
      },
      required: ["url"],
    }),
    execute: async (input) => {
      const raw = (input as { url?: string })?.url?.trim();
      if (!raw) throw new Error("Missing url parameter");
      return safeBrowser(() => execBrowserNavigate(browserCtx(), raw));
    },
  });

  tools.browserSearch = dynamicTool({
    description:
      "Search the web when the user names something without a URL, says 'search for …', or refers to a site from earlier chat ('same quizy', 'that site'). " +
      "Runs a Google search, returns searchResults[] with title, href, selector. Then browserNavigate to the best href to continue.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Full search phrase — e.g. 'quizy quiz site', 'Quizy learning platform'. Use conversation context when user says 'search for it' or 'same X'.",
        },
      },
      required: ["query"],
    }),
    execute: async (input) => {
      const query = (input as { query?: string })?.query?.trim();
      if (!query) throw new Error("Missing query parameter");
      return safeBrowser(() => execBrowserSearch(browserCtx(), query));
    },
  });

  tools.browserInspectPage = dynamicTool({
    description:
      "Inspect the current page: returns inputs, buttons, checkboxes (TOS/age), links with CSS selectors, posts[], pageTextExcerpt. " +
      "Call after every navigation and before browserClick/browserType. Use selectors from this result only. Copy handoff values (email, codes) from pageTextExcerpt.",
    inputSchema: jsonSchema({ type: "object", properties: {} }),
    execute: async () => safeBrowser(() => execBrowserInspect(browserCtx())),
  });

  tools.browserClick = dynamicTool({
    description:
      "Click a button, link, or control on the current page by CSS selector from browserInspectPage.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector from browserInspectPage",
        },
      },
      required: ["selector"],
    }),
    execute: async (input) => {
      const selector = (input as { selector?: string })?.selector?.trim();
      if (!selector) throw new Error("Missing selector");
      return safeBrowser(() => execBrowserClick(browserCtx(), selector));
    },
  });

  tools.browserType = dynamicTool({
    description:
      "Type text into an input or textarea on the current page by CSS selector from browserInspectPage.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        selector: { type: "string" },
        text: { type: "string" },
        pressEnter: { type: "boolean" },
      },
      required: ["selector", "text"],
    }),
    execute: async (input) => {
      const { selector, text, pressEnter } = input as {
        selector?: string;
        text?: string;
        pressEnter?: boolean;
      };
      if (!selector?.trim()) throw new Error("Missing selector");
      if (text === undefined) throw new Error("Missing text");
      return safeBrowser(() =>
        execBrowserType(
          browserCtx(),
          selector.trim(),
          text,
          Boolean(pressEnter),
        ),
      );
    },
  });

  tools.browserScroll = dynamicTool({
    description:
      "Scroll feeds and pages (X/Twitter timeline, Reddit, YouTube Shorts). Uses native mouse wheel + DOM scroll. Call repeatedly to load more posts.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down"] },
        amount: { type: "number", description: "Pixels (default 720)" },
      },
      required: ["direction"],
    }),
    execute: async (input) => {
      const { direction, amount } = input as {
        direction?: "up" | "down";
        amount?: number;
      };
      if (direction !== "up" && direction !== "down") {
        throw new Error("direction must be up or down");
      }
      return safeBrowser(() =>
        execBrowserScroll(browserCtx(), direction, amount),
      );
    },
  });

  tools.browserPressKey = dynamicTool({
    description:
      "Send a real keyboard key to the page (ArrowDown, PageDown, Space). Required for YouTube Shorts next video and some feeds.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "ArrowDown | PageDown | Space | Enter | ArrowUp",
        },
      },
      required: ["key"],
    }),
    execute: async (input) => {
      const key = (input as { key?: string })?.key?.trim();
      if (!key) throw new Error("Missing key");
      return safeBrowser(() => execBrowserKey(browserCtx(), key));
    },
  });

  tools.browserRefresh = dynamicTool({
    description:
      "Refresh/reload the current page. Call this ONLY when a page fails to load or shows a connection error. Do NOT call this to check for new emails or messages, as refreshing temp-mail sites can reset your session or rotate your email address; use browserWaitFor or browserWait instead.",
    inputSchema: jsonSchema({ type: "object", properties: {} }),
    execute: async () => {
      return safeBrowser(() => execBrowserRefresh(browserCtx()));
    },
  });

  tools.browserWait = dynamicTool({
    description:
      "Wait/sleep for a specified number of milliseconds (clamped between 500ms and 30000ms). " +
      "Use when waiting for redirects, dynamic content loads, verification codes, or after scrolling.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        ms: {
          type: "number",
          description: "Duration to wait in milliseconds (default 2000)",
        },
      },
      required: ["ms"],
    }),
    execute: async (input) => {
      const ms = (input as { ms?: number })?.ms ?? 2000;
      return safeBrowser(() => execBrowserWaitTool(browserCtx(), ms));
    },
  });

  tools.browserTabCreate = dynamicTool({
    description:
      "Create a new tab and navigate it to the optional URL. Automatically switches focus to the new tab.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "Optional URL to load initially, e.g. https://www.google.com",
        },
      },
    }),
    execute: async (input) => {
      const url = (input as { url?: string })?.url?.trim();
      return safeBrowser(() => execBrowserTabCreate(browserCtx(), url));
    },
  });

  tools.browserTabSwitch = dynamicTool({
    description:
      "Switch context/focus to another open tab by its tabId. Returns updated page content and title.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        tabId: {
          type: "string",
          description: "Target tab id from browserTabList",
        },
      },
      required: ["tabId"],
    }),
    execute: async (input) => {
      const tabId = (input as { tabId?: string })?.tabId?.trim();
      if (!tabId) throw new Error("Missing tabId");
      return safeBrowser(() => execBrowserTabSwitch(browserCtx(), tabId));
    },
  });

  tools.browserTabClose = dynamicTool({
    description:
      "Close an open tab by its tabId. Automatically switches focus to another remaining tab.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        tabId: {
          type: "string",
          description: "Target tab id from browserTabList",
        },
      },
      required: ["tabId"],
    }),
    execute: async (input) => {
      const tabId = (input as { tabId?: string })?.tabId?.trim();
      if (!tabId) throw new Error("Missing tabId");
      return safeBrowser(() => execBrowserTabClose(browserCtx(), tabId));
    },
  });

  tools.browserTabList = dynamicTool({
    description:
      "List all currently open tabs, including their ids, titles, URLs, and active status.",
    inputSchema: jsonSchema({ type: "object", properties: {} }),
    execute: async () => {
      return safeBrowser(() => execBrowserTabList(browserCtx()));
    },
  });

  tools.browserWaitFor = dynamicTool({
    description:
      "Wait until a specific CSS selector exists and is visible, or a specific text appears on the page. " +
      "Blocks and polls until the condition is met or the timeout is reached. If waiting for text/regex, returns the exact matched string and centered snippet.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Optional CSS selector to wait for (e.g. '.email-item')",
        },
        text: {
          type: "string",
          description:
            "Optional text content or regular expression to wait for (e.g. 'verification code' or '/[0-9]{6}/')",
        },
        timeoutMs: {
          type: "number",
          description:
            "Optional timeout in ms (default 15000, min 1000, max 120000). Use longer timeouts (60000+) when waiting for external events (emails/codes) to poll internally without model calls.",
        },
      },
    }),
    execute: async (input) => {
      const { selector, text, timeoutMs } = input as {
        selector?: string;
        text?: string;
        timeoutMs?: number;
      };
      return safeBrowser(() =>
        execBrowserWaitFor(browserCtx(), { selector, text, timeoutMs }),
      );
    },
  });

  tools.browserFindInPage = dynamicTool({
    description:
      "Find occurrences of a specific text string or regular expression inside the full page text (including inputs and same-origin iframes recursively). " +
      "Returns a list of matches with centered snippets. Useful for locating codes on long/truncated pages.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Plain text search term or a regular expression string (e.g. 'code' or '/[a-zA-Z0-9]{8,12}/')",
        },
      },
      required: ["query"],
    }),
    execute: async (input) => {
      const query = (input as { query?: string })?.query?.trim();
      if (!query) throw new Error("Missing query");
      return safeBrowser(() => execBrowserFindInPage(browserCtx(), query));
    },
  });

  tools.browserFetchUrl = dynamicTool({
    description:
      "Fetch the text content of any public URL in the background without navigating the active tab. " +
      "Useful for reading API responses, raw page text, or JSON from a URL while keeping the current tab open. " +
      "Strips HTML tags automatically. maxChars caps the returned text (default 15000, max 30000). " +
      "Returns: url, status, contentType, textContent, truncated, totalChars.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full https:// URL to fetch",
        },
        maxChars: {
          type: "number",
          description: "Max chars to return from the response (default 15000, max 30000)",
        },
      },
      required: ["url"],
    }),
    execute: async (input) => {
      const { url, maxChars } = input as { url?: string; maxChars?: number };
      if (!url?.trim()) throw new Error("Missing url");
      return safeBrowser(() =>
        execBrowserFetchUrl(browserCtx(), url.trim(), maxChars),
      );
    },
  });

  tools.browserInspectSection = dynamicTool({
    description:
      "Inspect only a specific section of the page identified by a CSS selector — returns inputs, buttons, links, checkboxes and text from ONLY that container. " +
      "Much cheaper in tokens than a full browserInspectPage on complex pages. " +
      "Use when you know which container holds the relevant form/modal/panel (e.g. '#login-form', '.email-item', '[role=\"dialog\"]'). " +
      "Returns: scopeSelector, scopeText, inputs[], buttons[], links[], checkboxes[].",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        scopeSelector: {
          type: "string",
          description:
            "CSS selector of the container to inspect (e.g. '#main-content', '.email-item:first-child', '[role=\"dialog\"]')",
        },
      },
      required: ["scopeSelector"],
    }),
    execute: async (input) => {
      const scopeSelector = (input as { scopeSelector?: string })?.scopeSelector?.trim();
      if (!scopeSelector) throw new Error("Missing scopeSelector");
      return safeBrowser(() =>
        execBrowserInspectScoped(browserCtx(), scopeSelector),
      );
    },
  });

  tools.browserExtractContent = dynamicTool({
    description:
      "Find and extract content from the most relevant section of the current page. " +
      "Provide textQuery to locate text anywhere on the page and return the surrounding container, OR provide selector to extract from a known element. " +
      "Returns: containerSelector (reusable in browserInspectSection), text, links[], elements[], charCount. " +
      "Use this after browserWaitFor to read an email body, a modal, a product card, or any specific section without reading the whole page.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        textQuery: {
          type: "string",
          description:
            "Text to search for on the page — returns the surrounding container. E.g. 'verification code', 'Your order', 'Reset password'",
        },
        selector: {
          type: "string",
          description:
            "CSS selector of the element/container to extract from. Used instead of or as fallback to textQuery.",
        },
        maxChars: {
          type: "number",
          description: "Max characters of text to return (default 4000)",
        },
        includeLinks: {
          type: "boolean",
          description: "Include links found in the container (default true)",
        },
        includeElements: {
          type: "boolean",
          description: "Include interactive elements found in the container (default true)",
        },
      },
    }),
    execute: async (input) => {
      const { textQuery, selector, maxChars, includeLinks, includeElements } = input as {
        textQuery?: string;
        selector?: string;
        maxChars?: number;
        includeLinks?: boolean;
        includeElements?: boolean;
      };
      return safeBrowser(() =>
        execBrowserExtractContent(browserCtx(), {
          textQuery,
          selector,
          maxChars,
          includeLinks,
          includeElements,
        }),
      );
    },
  });

  appendActionRecipeTools(tools, runtime, browserCtx);
  appendBerryTaskTools(tools, { ongoingTasks: runtime.ongoingTasks });
  appendBerryPlanTools(tools, { agentActivity: runtime.agentActivity });

  const dynamicWebMcpTools = runtime.pageWebMcpTools ?? [];
  for (const tool of dynamicWebMcpTools) {
    const name = tool.name;
    tools[name] = dynamicTool({
      description:
        tool.description ||
        TOOL_DESCRIPTIONS[name] ||
        `Run ${name} on the current page`,
      inputSchema: jsonSchema(
        tool.inputSchema ||
          TOOL_SCHEMAS[name] || { type: "object", properties: {} },
      ),
      execute: async (input) => {
        if (!runtime.webMcpEnabledForRequest) {
          throw new Error(
            "WebMCP is disabled. Enable it in chat settings (sliders icon), then retry.",
          );
        }
        if (!runtime.window?.activeTab) {
          throw new Error("No active tab");
        }

        const activeTab = runtime.window.activeTab;
        const args = { ...(input ?? {}) } as Record<string, unknown>;
        applyToolDefaults(name, args, runtime.defaultFlightDate);

        const result = await runtime.window.webMcpService.executeTool(
          activeTab,
          name,
          args,
        );
        if (!result.success) {
          throw new Error(result.error ?? "Tool execution failed");
        }
        return result.result;
      },
    });
  }

  return tools;
};

const applyToolDefaults = (
  name: string,
  args: Record<string, unknown>,
  defaultDate: string,
): void => {
  if (name === "searchFlights" && !args.date) args.date = defaultDate;
  if (name === "addToCart" && !args.quantity) args.quantity = 1;
  if (name === "startFocusSession" && !args.minutes) args.minutes = 25;
  if (name === "checkout") {
    if (!args.fullName) args.fullName = "Jane Demo";
    if (!args.address) args.address = "123 Main St, New York";
    if (!args.paymentMethod) args.paymentMethod = "card";
  }
  if (name === "bookFlight") {
    if (!args.passengerName) args.passengerName = "Jane Demo";
    if (!args.email) args.email = "guest@demo.example";
  }
};
