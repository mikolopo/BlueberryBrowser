import { WebContents } from "electron";
import {
  streamText,
  stepCountIs,
  type LanguageModel,
  type CoreMessage,
  type ToolSet,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { deepseek } from "@ai-sdk/deepseek";
import * as dotenv from "dotenv";
import { join } from "path";
import type { Window } from "./Window";
import type { AgentActivityService } from "./agent/AgentActivityService";
import type { BrowserSettings } from "../shared/browser-settings-types";
import {
  execBrowserNavigate,
  execBrowserSearch,
  execBrowserClick,
  execBrowserType,
  execBrowserScroll,
  execBrowserTabCreate,
  execBrowserTabSwitch,
  execBrowserTabClose,
  type BrowserActionContext,
} from "./navigation/browserActionExecutors";
import {
  getDefaultModelForProvider,
  getLlmProviderConfig,
  type LlmProvider,
} from "../shared/llm-config";
import {
  buildStaticToolSet,
  buildActiveToolNames,
} from "./prompts/berryStaticTools";
import {
  isSearchRefusal,
  resolveSearchQueryFromConversation,
} from "./prompts/berrySearchIntent";
import {
  applyPromptCache,
  logPromptCacheUsage,
} from "./prompts/berryPromptCache";
import {
  extractLlmErrorDetails,
  formatQuotaExhaustedMessage,
  formatRetryStatus,
  isQuotaExhaustedError,
  isRetriableLlmError,
  parseRetryDelayMs,
  sleep,
} from "./llm/llmErrorUtils";
import { buildBerryRequestMessages } from "./llm/berryContextBuilder";
import { trimMessagesForAgentStep } from "./llm/llmMessageTrim";

dotenv.config({ path: join(__dirname, "../../.env") });

interface ChatRequest {
  message: string;
  messageId: string;
  /** Global user preference + tools on page — tools are callable this turn. */
  webMcpEnabled?: boolean;
  /** User enabled WebMCP in chat settings (may still lack tools on current page). */
  webMcpGlobalEnabled?: boolean;
}

interface StreamChunk {
  content: string;
  isComplete: boolean;
}

const MAX_PAGE_TEXT_LENGTH = 3000;
const MAX_HISTORY_MESSAGES = 10;
const DEFAULT_TEMPERATURE = 0.3;
const WEBMCP_TEMPERATURE = 0.2;
const BROWSER_AGENT_MAX_STEPS = 24;
const WEBMCP_MAX_STEPS = 28;
const LLM_RATE_LIMIT_MAX_RETRIES = 8;
const LLM_STUCK_MAX_CONTINUATIONS = 3;
const LLM_STREAM_MAX_RETRIES = 5;

export class LLMClient {
  private readonly webContents: WebContents;
  private window: Window | null = null;
  private agentActivity: AgentActivityService | null = null;
  private settings: BrowserSettings;
  private model: LanguageModel | null;
  private messages: CoreMessage[] = [];
  private webMcpEnabledForRequest = false;
  /** Bumped when messages are replaced so in-flight streams stop updating state. */
  private streamToken = 0;
  private abortController: AbortController | null = null;
  private activeMessageId: string | null = null;
  private runCancelled = false;
  private lastMessagesBroadcastAt = 0;
  private pendingMessagesBroadcast: ReturnType<typeof setTimeout> | null = null;
  private activeAssistantMessageIndex: number | null = null;
  private currentAccumulatedText = "";
  private currentStatusLine = "";
  private recordedActions: any[] = [];
  private isRecording = false;

  constructor(webContents: WebContents, initialSettings: BrowserSettings) {
    this.webContents = webContents;
    this.settings = initialSettings;
    this.model = this.initializeModel();
    this.logInitializationStatus();
  }

  setWindow(window: Window): void {
    this.window = window;
  }

  setAgentActivity(service: AgentActivityService): void {
    this.agentActivity = service;
    service.onPlanUpdated(() => {
      this.handlePlanUpdated();
    });
    service.onActivityEmit((event) => {
      this.handleActivityEmit(event);
    });
  }

  applyBrowserSettings(settings: BrowserSettings): void {
    const providerChanged = settings.llmProvider !== this.settings.llmProvider;
    const modelChanged = settings.llmModel !== this.settings.llmModel;
    this.settings = settings;

    if (providerChanged || modelChanged) {
      this.model = this.initializeModel();
      this.logInitializationStatus();
    }
  }

  private getActiveSettings(): BrowserSettings {
    return this.window?.getBrowserSettings() ?? this.settings;
  }

  private trackTabViewport(tab: {
    id: string;
    url: string;
    title: string;
  }): void {
    this.agentActivity?.setViewportUrl(tab.id, tab.url, tab.title);
  }

  private initializeModel(): LanguageModel | null {
    const active = this.getActiveSettings();
    const apiKey = this.getApiKey(active.llmProvider);
    if (!apiKey) return null;

    const modelName =
      active.llmModel.trim() || getDefaultModelForProvider(active.llmProvider);

    switch (active.llmProvider) {
      case "anthropic": {
        let baseURL = process.env.ANTHROPIC_BASE_URL || undefined;
        console.log(
          `[Anthropic Init] Model: ${modelName}, API Key: ${apiKey ? apiKey.slice(0, 10) + "..." : "none"}, Base URL: ${baseURL || "default (api.anthropic.com)"}`,
        );
        if (baseURL) {
          if (!baseURL.endsWith("/v1") && !baseURL.endsWith("/v1/")) {
            baseURL = baseURL.endsWith("/") ? `${baseURL}v1` : `${baseURL}/v1`;
          }
          console.log(`[Anthropic Init] Normalized Base URL to: ${baseURL}`);

          const customFetch = (input: string | URL | any, init?: any) => {
            const urlStr =
              typeof input === "string"
                ? input
                : input && "url" in input
                  ? (input as any).url
                  : String(input);
            const targetUrl = urlStr.includes("?")
              ? `${urlStr}&beta=true`
              : `${urlStr}?beta=true`;
            let bodyObj: any = {};
            if (init && init.body) {
              try {
                bodyObj = JSON.parse(init.body);
              } catch (e) {
                // ignore
              }
            }
            bodyObj.metadata = {
              user_id: JSON.stringify({
                device_id:
                  "912c020da9b063f346ebad60b4da1038d0feffd1c069cd40677f6d04bcf46abf",
                account_uuid: "",
                session_id: "76dabef3-f77f-466a-b10d-558f39e9c981",
              }),
            };
            bodyObj.thinking = { type: "adaptive" };
            bodyObj.context_management = {
              edits: [
                {
                  type: "clear_thinking_20251015",
                  keep: "all",
                },
              ],
            };
            bodyObj.output_config = { effort: "high" };

            const rawApiKey = apiKey.replace(/^'|'$/g, "");
            const quotedToken = `'${rawApiKey}'`;

            const headers = {
              ...(init && init.headers ? init.headers : {}),
              accept: "application/json",
              authorization: `Bearer ${quotedToken}`,
              "user-agent": "claude-cli/2.1.170 (external, sdk-cli)",
              "x-claude-code-session-id":
                "74eee6e4-6353-48af-b30f-2978ceee7280",
              "x-stainless-arch": "x64",
              "x-stainless-lang": "js",
              "x-stainless-os": "Windows",
              "x-stainless-package-version": "0.94.0",
              "x-stainless-retry-count": "0",
              "x-stainless-runtime": "node",
              "x-stainless-runtime-version": "v24.3.0",
              "x-stainless-timeout": "300",
              "anthropic-beta":
                "claude-code-20250219,context-1m-2025-08-07,interleaved-thinking-2025-05-14,context-management-2025-06-27,prompt-caching-scope-2026-01-05,mid-conversation-system-2026-04-07,effort-2025-11-24",
              "anthropic-dangerous-direct-browser-access": "true",
              "anthropic-version": "2023-06-01",
              "x-api-key": rawApiKey,
              "x-app": "cli",
            };

            return fetch(targetUrl, {
              ...init,
              headers,
              body: JSON.stringify(bodyObj),
            });
          };

          const customAnthropic = createAnthropic({
            apiKey: apiKey.replace(/^'|'$/g, ""),
            baseURL,
            fetch: customFetch,
          });
          return customAnthropic(modelName);
        }
        return anthropic(modelName);
      }
      case "openai":
        return openai(modelName);
      case "deepseek":
        return deepseek(modelName) as unknown as LanguageModel;
      case "gemini":
        return google(modelName) as unknown as LanguageModel;
      default:
        return null;
    }
  }

  private getApiKey(provider: LlmProvider): string | undefined {
    const envKey = getLlmProviderConfig(provider).envKey;
    return process.env[envKey];
  }

  private logInitializationStatus(): void {
    const active = this.getActiveSettings();
    const providerConfig = getLlmProviderConfig(active.llmProvider);
    const modelName = active.llmModel.trim() || providerConfig.defaultModel;

    if (this.model) {
      console.log(
        `✅ LLM Client initialized with ${active.llmProvider} provider using model: ${modelName}` +
          (active.promptCacheEnabled
            ? " (prompt cache on)"
            : " (prompt cache off)"),
      );
    } else {
      console.error(
        `❌ LLM Client initialization failed: ${providerConfig.envKey} not found in environment variables.\n` +
          `Please add your API key to the .env file in the project root.`,
      );
    }
  }

  async sendChatMessage(request: ChatRequest): Promise<void> {
    if (this.abortController) {
      this.cancelActiveRequest(false);
    }

    this.runCancelled = false;
    this.abortController = new AbortController();
    this.activeMessageId = request.messageId;
    this.activeAssistantMessageIndex = null;
    this.currentAccumulatedText = "";
    this.currentStatusLine = "";
    this.recordedActions = [];

    try {
      this.webMcpEnabledForRequest =
        request.webMcpGlobalEnabled ?? request.webMcpEnabled ?? false;

      this.agentActivity?.emit({
        kind: "thinking",
        label: "Berry is thinking…",
        tabId: this.window?.activeTab?.id,
        url: this.window?.activeTab?.url ?? undefined,
      });

      this.messages.push({
        role: "user",
        content: request.message,
      });
      this.sendMessagesToRenderer();

      if (!this.model) {
        const active = this.getActiveSettings();
        const keyName = getLlmProviderConfig(active.llmProvider).envKey;
        this.sendErrorMessage(
          request.messageId,
          `LLM service is not configured. Add ${keyName} to your .env file.`,
        );
        return;
      }

      const messages = await this.prepareMessagesWithContext(request);
      await this.streamResponseWithRecovery(messages, request.messageId);
    } catch (error) {
      if (this.isAbortError(error) || this.runCancelled) {
        return;
      }
      console.error("Error in LLM request:", error);
      this.handleStreamError(error, request.messageId);
    } finally {
      this.webMcpEnabledForRequest = false;
      this.abortController = null;
      this.activeMessageId = null;
    }
  }

  isAgentRunning(): boolean {
    return this.abortController != null;
  }

  cancelActiveRequest(notifyRenderer = true): boolean {
    if (!this.abortController && !this.activeMessageId) {
      return false;
    }

    this.runCancelled = true;
    this.streamToken += 1;
    this.abortController?.abort();
    this.abortController = null;

    this.agentActivity?.emit({
      kind: "idle",
      label: "Stopped",
      tabId: this.window?.activeTab?.id,
      url: this.window?.activeTab?.url ?? undefined,
    });

    const messageId = this.activeMessageId;
    this.activeMessageId = null;

    if (notifyRenderer) {
      this.finalizeStoppedResponse(messageId);
    }

    return true;
  }

  private finalizeStoppedResponse(messageId: string | null): void {
    const stoppedText = "*(Stopped)*";
    const last = this.messages[this.messages.length - 1];

    if (last?.role === "assistant" && typeof last.content === "string") {
      const content = last.content.trim();
      if (
        !content ||
        content.includes("retry in") ||
        content.includes("Rate limit")
      ) {
        this.messages[this.messages.length - 1] = {
          role: "assistant",
          content: stoppedText,
        };
      } else if (!content.endsWith("*(Stopped)*")) {
        this.messages[this.messages.length - 1] = {
          role: "assistant",
          content: `${content}\n\n${stoppedText}`,
        };
      }
    } else {
      this.messages.push({ role: "assistant", content: stoppedText });
    }

    this.sendMessagesToRenderer();

    this.sendStreamChunk(messageId ?? Date.now().toString(), {
      content: stoppedText,
      isComplete: true,
    });
  }

  private isAbortError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const name = (error as { name?: string }).name;
    return (
      name === "AbortError" || (name === "AI_APICallError" && this.runCancelled)
    );
  }

  clearMessages(): void {
    this.cancelActiveRequest(false);
    this.streamToken += 1;
    this.messages = [];
    this.agentActivity?.clearPlan();
    this.sendMessagesToRenderer();
  }

  setMessages(messages: CoreMessage[]): void {
    this.streamToken += 1;
    this.messages = messages;
    this.sendMessagesToRenderer();
  }

  getMessages(): CoreMessage[] {
    return this.messages;
  }

  getRecordedActions(): any[] {
    return this.recordedActions;
  }

  startRecording(): void {
    this.recordedActions = [];
    this.isRecording = true;
    this.webContents.send("recording-state-changed", true);
    this.webContents.send("actions-recorded-updated", this.recordedActions);
  }

  stopRecording(): { python: string; typescript: string; actions: any[] } {
    this.isRecording = false;
    this.webContents.send("recording-state-changed", false);
    const python = this.generateDendritePython(this.recordedActions);
    const typescript = this.generateDendriteTypeScript(this.recordedActions);
    return {
      python,
      typescript,
      actions: [...this.recordedActions]
    };
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }

  private sendMessagesToRenderer(): void {
    this.webContents.send("chat-messages-updated", this.messages);
  }

  /** Throttle full-history IPC during token streaming (renderer still gets deltas via chat-response). */
  private sendMessagesToRendererThrottled(force = false): void {
    const intervalMs = 300;
    const now = Date.now();
    if (force || now - this.lastMessagesBroadcastAt >= intervalMs) {
      if (this.pendingMessagesBroadcast) {
        clearTimeout(this.pendingMessagesBroadcast);
        this.pendingMessagesBroadcast = null;
      }
      this.lastMessagesBroadcastAt = now;
      this.sendMessagesToRenderer();
      return;
    }
    if (this.pendingMessagesBroadcast) return;
    const delay = intervalMs - (now - this.lastMessagesBroadcastAt);
    this.pendingMessagesBroadcast = setTimeout(() => {
      this.pendingMessagesBroadcast = null;
      this.lastMessagesBroadcastAt = Date.now();
      this.sendMessagesToRenderer();
    }, delay);
  }

  private getRecentHistory(): CoreMessage[] {
    const slice = this.messages.slice(-MAX_HISTORY_MESSAGES);
    if (slice.length > 0 && slice[0]?.role === "assistant") {
      return slice.slice(1);
    }
    return slice;
  }

  private getLastUserMessageText(): string {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      if (m?.role !== "user") continue;
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        return m.content
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n");
      }
    }
    return "";
  }

  private async prepareMessagesWithContext(
    request: ChatRequest,
  ): Promise<CoreMessage[]> {
    return buildBerryRequestMessages({
      window: this.window,
      agentActivity: this.agentActivity,
      history: this.getRecentHistory(),
      request,
      maxPageTextLength: MAX_PAGE_TEXT_LENGTH,
      defaultFlightDate: this.defaultFlightDate(),
      isCancelled: () => this.runCancelled,
      onTrackTabViewport: (tab) => this.trackTabViewport(tab),
    });
  }

  private defaultFlightDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  }

  private buildAllTools(): ToolSet {
    const tab = this.window?.activeTab;
    const snapshot = tab
      ? this.window?.webMcpService.registry.getForTab(tab.id)
      : null;
    const pageWebMcpTools = snapshot?.tools ?? [];

    return buildStaticToolSet({
      window: this.window,
      agentActivity: this.agentActivity,
      webMcpEnabledForRequest: this.webMcpEnabledForRequest,
      defaultFlightDate: this.defaultFlightDate(),
      maxPageTextLength: MAX_PAGE_TEXT_LENGTH,
      isCancelled: () => this.runCancelled,
      ongoingTasks: this.window?.ongoingTaskService ?? null,
      pageWebMcpTools,
      onActionRecorded: (action) => {
        if (this.isRecording) {
          this.recordedActions.push(action);
          this.webContents.send("actions-recorded-updated", this.recordedActions);
        }
      },
    });
  }

  private getPageWebMcpToolNames(): string[] {
    const tab = this.window?.activeTab;
    if (!tab) return [];
    const snapshot = this.window?.webMcpService.registry.getForTab(tab.id);
    return snapshot?.tools.map((t) => t.name) ?? [];
  }

  private resolveActiveToolNames(): string[] {
    return buildActiveToolNames(
      this.webMcpEnabledForRequest,
      this.getPageWebMcpToolNames(),
    );
  }

  private async streamResponseWithRecovery(
    initialMessages: CoreMessage[],
    messageId: string,
  ): Promise<void> {
    let messages = initialMessages;
    let rateLimitAttempt = 0;
    let continuationAttempt = 0;

    while (true) {
      if (this.runCancelled) return;
      let streamError: unknown = null;

      try {
        const outcome = await this.streamResponseOnce(
          messages,
          messageId,
          (error) => {
            streamError = error;
          },
        );

        if (this.runCancelled) return;

        if (streamError && isQuotaExhaustedError(streamError)) {
          throw streamError;
        }

        if (streamError && isRetriableLlmError(streamError)) {
          throw streamError;
        }

        if (
          outcome.needsContinuation &&
          continuationAttempt < LLM_STUCK_MAX_CONTINUATIONS
        ) {
          continuationAttempt += 1;
          this.agentActivity?.emit({
            kind: "thinking",
            label: `Continuing task (${continuationAttempt}/${LLM_STUCK_MAX_CONTINUATIONS})…`,
            tabId: this.window?.activeTab?.id,
            url: this.window?.activeTab?.url ?? undefined,
          });
          messages = outcome.continuationMessages ?? messages;
          continue;
        }

        if (
          outcome.assistantText.trim() === "" &&
          outcome.toolStepsRun > 0 &&
          continuationAttempt < LLM_STUCK_MAX_CONTINUATIONS
        ) {
          continuationAttempt += 1;
          messages = this.buildContinuationMessages(
            messages,
            outcome.responseMessages,
            "Summarize what you did and continue the user's task if anything remains.",
          );
          continue;
        }

        if (
          outcome.toolStepsRun === 0 &&
          isSearchRefusal(outcome.assistantText) &&
          continuationAttempt < LLM_STUCK_MAX_CONTINUATIONS
        ) {
          const lastUser = this.getLastUserMessageText();
          const searchQuery = resolveSearchQueryFromConversation(
            this.getRecentHistory().slice(0, -1),
            lastUser,
          );
          if (searchQuery) {
            continuationAttempt += 1;
            messages = this.buildContinuationMessages(
              messages,
              outcome.responseMessages,
              `You must NOT ask for a URL. Call browserSearch({ query: ${JSON.stringify(searchQuery)} }) now, then browserNavigate to the best result and continue the user's task.`,
            );
            continue;
          }
        }

        if (outcome.assistantText.trim() === "" && outcome.toolStepsRun > 0) {
          this.setAssistantContent(
            messageId,
            "I ran browser actions on the page but hit a provider limit before finishing the reply. Check the tab — progress may be there. Ask me to continue and I'll pick up where I left off.",
          );
        }

        return;
      } catch (caught) {
        // The stream wrapper often throws generic NoOutputGeneratedError while the
        // real cause (quota/rate limit) was reported via onError — prefer that one.
        const error = streamError ?? caught;
        if (this.runCancelled || this.isAbortError(error)) {
          return;
        }
        if (
          !isRetriableLlmError(error) ||
          rateLimitAttempt >= LLM_RATE_LIMIT_MAX_RETRIES
        ) {
          throw error;
        }

        rateLimitAttempt += 1;
        const delayMs = parseRetryDelayMs(error, rateLimitAttempt);
        const status = formatRetryStatus(error, delayMs, rateLimitAttempt);
        console.warn(
          "[Berry LLM retry]",
          extractLlmErrorDetails(error).message,
          `in ${delayMs}ms`,
        );

        this.agentActivity?.emit({
          kind: "thinking",
          label: status,
          tabId: this.window?.activeTab?.id,
          url: this.window?.activeTab?.url ?? undefined,
        });
        this.patchAssistantStatus(messageId, status);
        await sleep(delayMs);
      }
    }
  }

  private buildContinuationMessages(
    baseMessages: CoreMessage[],
    responseMessages: CoreMessage[] | undefined,
    instruction: string,
  ): CoreMessage[] {
    const continuationUser: CoreMessage = {
      role: "user",
      content: `<continuation_request>\n${instruction}\n</continuation_request>`,
    };

    if (responseMessages?.length) {
      return [...baseMessages, ...responseMessages, continuationUser];
    }

    return [...baseMessages, continuationUser];
  }

  private patchAssistantStatus(messageId: string, status: string): void {
    const last = this.messages[this.messages.length - 1];
    if (last?.role === "assistant" && typeof last.content === "string") {
      this.messages[this.messages.length - 1] = {
        role: "assistant",
        content: status,
      };
    } else {
      this.messages.push({ role: "assistant", content: status });
    }
    this.sendMessagesToRenderer();
    this.sendStreamChunk(messageId, { content: status, isComplete: false });
  }

  private async streamResponseOnce(
    messages: CoreMessage[],
    messageId: string,
    onStreamError: (error: unknown) => void,
  ): Promise<{
    assistantText: string;
    toolStepsRun: number;
    needsContinuation: boolean;
    continuationMessages?: CoreMessage[];
    responseMessages?: CoreMessage[];
  }> {
    if (!this.model) {
      throw new Error("Model not initialized");
    }

    const active = this.getActiveSettings();
    const { messages: cachedMessages, providerOptions } = applyPromptCache(
      messages,
      active.llmProvider,
      active.promptCacheEnabled,
    );

    const tools = this.buildAllTools();
    const activeTools = this.resolveActiveToolNames();
    const multiStep = this.webMcpEnabledForRequest;
    const temperature = multiStep ? WEBMCP_TEMPERATURE : DEFAULT_TEMPERATURE;

    const result = streamText({
      model: this.model,
      messages: cachedMessages,
      tools,
      activeTools: activeTools as Array<keyof typeof tools>,
      ...(providerOptions ? { providerOptions } : {}),
      stopWhen: multiStep
        ? stepCountIs(WEBMCP_MAX_STEPS)
        : stepCountIs(BROWSER_AGENT_MAX_STEPS),
      temperature,
      maxRetries: LLM_STREAM_MAX_RETRIES,
      abortSignal: this.abortController?.signal,
      prepareStep: ({ stepNumber, messages: stepMessages }) => {
        const stepUpdate: {
          messages?: CoreMessage[];
          activeTools?: Array<keyof typeof tools>;
        } = {};
        if (stepNumber > 0) {
          stepUpdate.messages = trimMessagesForAgentStep(stepMessages);
        }
        stepUpdate.activeTools = this.resolveActiveToolNames() as Array<
          keyof typeof tools
        >;
        return stepUpdate;
      },
      onError: ({ error }) => {
        onStreamError(error);
      },
      onStepFinish: ({ toolCalls }) => {
        for (const call of toolCalls) {
          this.agentActivity?.emit({
            kind: "tool_running",
            label: `${call.toolName}…`,
            toolName: call.toolName,
            tabId: this.window?.activeTab?.id,
            url: this.window?.activeTab?.url ?? undefined,
          });
        }
      },
      onFinish: ({ usage, providerMetadata }) => {
        logPromptCacheUsage(
          active.llmProvider,
          {
            inputTokens: usage.inputTokens,
            cachedInputTokens: usage.cachedInputTokens,
          },
          providerMetadata,
        );
      },
    });

    const assistantText = await this.processStream(
      result.fullStream,
      messageId,
    );

    let resolvedText = assistantText;
    if (!resolvedText.trim()) {
      const fallback = await result.text;
      if (fallback.trim()) {
        resolvedText = fallback;
        this.setAssistantContent(messageId, resolvedText);
      }
    }

    const steps = await result.steps;
    const finishReason = await result.finishReason;
    const response = await result.response;
    const toolStepsRun = steps.reduce(
      (count, step) => count + (step.toolCalls?.length ?? 0),
      0,
    );

    const hitStepLimit =
      steps.length >= (multiStep ? WEBMCP_MAX_STEPS : BROWSER_AGENT_MAX_STEPS);
    const endedOnToolCalls = finishReason === "tool-calls";
    const needsContinuation =
      (hitStepLimit || endedOnToolCalls) &&
      toolStepsRun > 0 &&
      !resolvedText.trim();

    return {
      assistantText: resolvedText,
      toolStepsRun,
      needsContinuation,
      continuationMessages: needsContinuation
        ? this.buildContinuationMessages(
            messages,
            response.messages as CoreMessage[],
            "You hit the step limit. Continue the user's task with more tool calls, then give a brief update.",
          )
        : undefined,
      responseMessages: response.messages as CoreMessage[],
    };
  }

  private setAssistantContent(messageId: string, content: string): void {
    const last = this.messages[this.messages.length - 1];
    if (last?.role === "assistant") {
      this.activeAssistantMessageIndex = this.messages.length - 1;
      this.currentAccumulatedText = content;
      this.currentStatusLine = "";
      this.updateActiveMessageContent();
      const finalContent =
        typeof this.messages[this.activeAssistantMessageIndex].content ===
        "string"
          ? (this.messages[this.activeAssistantMessageIndex].content as string)
          : content;
      this.sendMessagesToRenderer();
      this.sendStreamChunk(messageId, {
        content: finalContent,
        isComplete: true,
      });
    }
  }

  private allocateAssistantMessageSlot(): number {
    if (this.activeAssistantMessageIndex !== null) {
      return this.activeAssistantMessageIndex;
    }

    const last = this.messages[this.messages.length - 1];
    const isRetryPlaceholder =
      last?.role === "assistant" &&
      typeof last.content === "string" &&
      (last.content.trim() === "" ||
        last.content.includes("Rate limit") ||
        last.content.includes("retry in") ||
        last.content.includes("Provider busy"));

    const plan = this.agentActivity?.getPlan();
    const initialContent = prependPlanChecklist("", plan);

    if (isRetryPlaceholder) {
      this.messages[this.messages.length - 1] = {
        role: "assistant",
        content: initialContent,
      };
      this.activeAssistantMessageIndex = this.messages.length - 1;
      return this.activeAssistantMessageIndex;
    }

    this.messages.push({ role: "assistant", content: initialContent });
    this.activeAssistantMessageIndex = this.messages.length - 1;
    return this.activeAssistantMessageIndex;
  }

  private generateDendritePython(actions: any[]): string {
    if (actions.length === 0) return "# No actions recorded.";
    let code = `import asyncio\nfrom dendrite import Dendrite\n\nasync def main():\n    # Initialize Dendrite browser automation client\n    client = Dendrite()\n    \n`;
    const tabMap = new Map<string, string>();
    let tabCount = 0;
    const getTabVar = (tabId?: string) => {
      if (!tabId) return "client";
      if (!tabMap.has(tabId)) {
        tabMap.set(tabId, `tab_${tabCount++}`);
      }
      return tabMap.get(tabId)!;
    };
    code += `    tab_0 = client.tabs[0]\n\n`;
    tabMap.set(actions[0]?.tabId || "default", "tab_0");

    for (const action of actions) {
      const activeTabVar = getTabVar(action.tabId || "default");
      switch (action.type) {
        case "navigate":
          code += `    # Navigate to target page\n    await ${activeTabVar}.goto("${action.url}")\n\n`;
          break;
        case "search":
          code += `    # Search via search engine\n    await ${activeTabVar}.goto("https://www.google.com/search?q=${encodeURIComponent(action.query || "")}")\n\n`;
          break;
        case "click":
          const selClickEscaped = (action.selector || "").replace(/"/g, '\\"');
          code += `    # Click on the element\n    await ${activeTabVar}.click("${selClickEscaped}")\n\n`;
          break;
        case "type":
          const selTypeEscaped = (action.selector || "").replace(/"/g, '\\"');
          const textEscaped = (action.text || "").replace(/"/g, '\\"');
          code += `    # Type text into the input field\n    await ${activeTabVar}.fill("${selTypeEscaped}", "${textEscaped}")\n`;
          if (action.pressEnter) {
            code += `    await ${activeTabVar}.press("${selTypeEscaped}", "Enter")\n`;
          }
          code += `\n`;
          break;
        case "scroll":
          const selScrollEscaped = (action.selector || "body").replace(/"/g, '\\"');
          code += `    # Scroll target area\n    await ${activeTabVar}.scroll("${selScrollEscaped}")\n\n`;
          break;
        case "tabCreate":
          const newTabVar = getTabVar(action.tabId);
          code += `    # Create a new tab\n    ${newTabVar} = await client.create_tab("${action.url || ""}")\n\n`;
          break;
        case "tabSwitch":
          const switchTabVar = getTabVar(action.tabId);
          code += `    # Switch active tab\n    await ${switchTabVar}.focus()\n\n`;
          break;
        case "tabClose":
          const closeTabVar = getTabVar(action.tabId);
          code += `    # Close the tab\n    await ${closeTabVar}.close()\n\n`;
          break;
      }
    }
    code += `if __name__ == "__main__":\n    asyncio.run(main())\n`;
    return code;
  }

  private generateDendriteTypeScript(actions: any[]): string {
    if (actions.length === 0) return "// No actions recorded.";
    let code = `import { Dendrite } from "dendrite-sdk";\n\nasync function main() {\n  // Initialize Dendrite browser automation client\n  const client = new Dendrite();\n  \n`;
    const tabMap = new Map<string, string>();
    let tabCount = 0;
    const getTabVar = (tabId?: string) => {
      if (!tabId) return "client";
      if (!tabMap.has(tabId)) {
        tabMap.set(tabId, `tab_${tabCount++}`);
      }
      return tabMap.get(tabId)!;
    };
    code += `  const tab_0 = client.tabs[0];\n\n`;
    tabMap.set(actions[0]?.tabId || "default", "tab_0");

    for (const action of actions) {
      const activeTabVar = getTabVar(action.tabId || "default");
      switch (action.type) {
        case "navigate":
          code += `  // Navigate to target page\n  await ${activeTabVar}.goto("${action.url}");\n\n`;
          break;
        case "search":
          code += `  // Search via search engine\n  await ${activeTabVar}.goto("https://www.google.com/search?q=${encodeURIComponent(action.query || "")}");\n\n`;
          break;
        case "click":
          const selClickEscaped = (action.selector || "").replace(/"/g, '\\"');
          code += `  // Click on the element\n  await ${activeTabVar}.click("${selClickEscaped}");\n\n`;
          break;
        case "type":
          const selTypeEscaped = (action.selector || "").replace(/"/g, '\\"');
          const textEscaped = (action.text || "").replace(/"/g, '\\"');
          code += `  // Type text into the input field\n  await ${activeTabVar}.fill("${selTypeEscaped}", "${textEscaped}");\n`;
          if (action.pressEnter) {
            code += `  await ${activeTabVar}.press("${selTypeEscaped}", "Enter");\n`;
          }
          code += `\n`;
          break;
        case "scroll":
          const selScrollEscaped = (action.selector || "body").replace(/"/g, '\\"');
          code += `  // Scroll target area\n  await ${activeTabVar}.scroll("${selScrollEscaped}");\n\n`;
          break;
        case "tabCreate":
          const newTabVar = getTabVar(action.tabId);
          code += `  // Create a new tab\n  const ${newTabVar} = await client.create_tab("${action.url || ""}");\n\n`;
          break;
        case "tabSwitch":
          const switchTabVar = getTabVar(action.tabId);
          code += `  // Switch active tab\n  await ${switchTabVar}.focus();\n\n`;
          break;
        case "tabClose":
          const closeTabVar = getTabVar(action.tabId);
          code += `  // Close the tab\n  await ${closeTabVar}.close();\n\n`;
          break;
      }
    }
    code += `}\n\nmain().catch(console.error);\n`;
    return code;
  }

  recordManualAction(action: any): void {
    if (!this.isRecording) return;
    const last = this.recordedActions[this.recordedActions.length - 1];
    if (
      last &&
      last.type === action.type &&
      last.url === action.url &&
      last.selector === action.selector &&
      last.tabId === action.tabId
    ) {
      return;
    }
    this.recordedActions.push(action);
    this.webContents.send("actions-recorded-updated", this.recordedActions);
  }

  async runAutomationActions(actions: any[]): Promise<boolean> {
    if (!this.window) return false;
    this.runCancelled = false;

    this.agentActivity?.emit({
      kind: "thinking",
      label: "Running automation replay...",
      tabId: this.window.activeTab?.id,
      url: this.window.activeTab?.url ?? undefined,
    });

    try {
      for (const action of actions) {
        if (this.runCancelled) break;

        const ctx: BrowserActionContext = {
          window: this.window,
          agentActivity: this.agentActivity,
          maxPageTextLength: MAX_PAGE_TEXT_LENGTH,
          isCancelled: () => this.runCancelled,
        };

        this.agentActivity?.emit({
          kind: "tool_running",
          label: `Executing ${action.type}...`,
          tabId: this.window.activeTab?.id,
          url: this.window.activeTab?.url ?? undefined,
        });

        switch (action.type) {
          case "navigate":
            await execBrowserNavigate(ctx, action.url);
            break;
          case "search":
            await execBrowserSearch(ctx, action.query);
            break;
          case "click":
            await execBrowserClick(ctx, action.selector);
            break;
          case "type":
            await execBrowserType(ctx, action.selector, action.text || "", action.pressEnter);
            break;
          case "scroll":
            await execBrowserScroll(ctx, action.selector || "body");
            break;
          case "tabCreate":
            await execBrowserTabCreate(ctx, action.url);
            break;
          case "tabSwitch":
            await execBrowserTabSwitch(ctx, action.tabId);
            break;
          case "tabClose":
            await execBrowserTabClose(ctx, action.tabId);
            break;
        }
        await sleep(600);
      }

      this.agentActivity?.emit({
        kind: "idle",
        label: "Automation replay completed successfully",
        tabId: this.window.activeTab?.id,
        url: this.window.activeTab?.url ?? undefined,
      });
      return true;
    } catch (err) {
      console.error("Replay failure:", err);
      this.agentActivity?.emit({
        kind: "idle",
        label: `Replay failed: ${String(err)}`,
        tabId: this.window.activeTab?.id,
        url: this.window.activeTab?.url ?? undefined,
      });
      return false;
    }
  }

  private async processStream(
    stream: AsyncIterable<{ type: string; text?: string; error?: unknown }>,
    messageId: string,
  ): Promise<string> {
    const token = this.streamToken;
    this.currentAccumulatedText = "";
    const messageIndex = this.allocateAssistantMessageSlot();

    for await (const part of stream) {
      if (token !== this.streamToken) {
        return this.currentAccumulatedText;
      }

      if (part.type === "text-delta" && part.text) {
        this.currentAccumulatedText += part.text;
        this.updateActiveMessageContent();
      }

      if (part.type === "error" && part.error) {
        console.error("[Berry LLM stream error]", part.error);
      }
    }

    if (token !== this.streamToken) {
      return this.currentAccumulatedText;
    }

    if (this.recordedActions.length > 0) {
      const pythonScript = this.generateDendritePython(this.recordedActions);
      const tsScript = this.generateDendriteTypeScript(this.recordedActions);
      const payload = JSON.stringify({
        python: pythonScript,
        typescript: tsScript,
      });
      this.currentAccumulatedText += `\n\n---\n### 🤖 Generated Dendrite Automation Script\n\`\`\`dendrite-code\n${payload}\n\`\`\`\n`;
    }

    this.currentStatusLine = "";
    this.updateActiveMessageContent();
    this.sendMessagesToRendererThrottled(true);

    const finalMessageContent = this.messages[messageIndex]?.content;
    const finalContentStr =
      typeof finalMessageContent === "string"
        ? finalMessageContent
        : this.currentAccumulatedText;

    this.sendStreamChunk(messageId, {
      content: finalContentStr,
      isComplete: true,
    });

    this.agentActivity?.emit({
      kind: "responding",
      label: "Response ready",
      tabId: this.window?.activeTab?.id,
      url: this.window?.activeTab?.url ?? undefined,
    });

    return this.currentAccumulatedText;
  }

  private handleStreamError(error: unknown, messageId: string): void {
    console.error("Error streaming from LLM:", error);
    this.sendErrorMessage(messageId, this.getErrorMessage(error));
  }

  private getErrorMessage(error: unknown): string {
    const raw =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);

    const message = raw.toLowerCase();

    if (isQuotaExhaustedError(error)) {
      return formatQuotaExhaustedMessage(this.getActiveSettings().llmProvider);
    }

    if (message.includes("401") || message.includes("unauthorized")) {
      return "API key error — check your .env file.";
    }

    if (
      message.includes("third-party apps now draw from your extra usage") ||
      message.includes("draw from your extra usage")
    ) {
      return "Anthropic restriction: Third-party apps must draw from your 'Extra Usage' billing balance, not standard plan limits. Please add pay-as-you-go credit at https://claude.ai/settings/usage, or switch LLM Provider to DeepSeek/Gemini/OpenAI in the top-right Settings panel.";
    }

    if (
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("rate_limit")
    ) {
      return "Provider rate limit hit — Berry will auto-retry. If this keeps happening, wait a minute or switch model/provider in Settings.";
    }

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("econnrefused")
    ) {
      return "Network error — check your connection.";
    }

    if (message.includes("timeout")) {
      return "Request timed out — please try again.";
    }

    return "Something went wrong. Please try again in a moment.";
  }

  private sendErrorMessage(messageId: string, errorMessage: string): void {
    const last = this.messages[this.messages.length - 1];
    if (
      last?.role === "assistant" &&
      (last.content === "" ||
        (typeof last.content === "string" && last.content.trim() === ""))
    ) {
      this.messages.pop();
    }

    this.messages.push({
      role: "assistant",
      content: errorMessage,
    });
    this.sendMessagesToRenderer();
    this.sendStreamChunk(messageId, {
      content: errorMessage,
      isComplete: true,
    });
  }

  private sendStreamChunk(messageId: string, chunk: StreamChunk): void {
    this.webContents.send("chat-response", {
      messageId,
      content: chunk.content,
      isComplete: chunk.isComplete,
    });
  }

  private handleActivityEmit(event: any): void {
    if (event.kind === "idle" || event.kind === "responding") {
      this.currentStatusLine = "";
    } else {
      this.currentStatusLine = `\n\n⚡ *Status:* ${event.label}`;
    }
    this.updateActiveMessageContent();
  }

  private updateActiveMessageContent(): void {
    const messageIndex = this.messages.findLastIndex(
      (m) => m.role === "assistant",
    );
    if (messageIndex === -1) return;

    this.activeAssistantMessageIndex = messageIndex;

    const plan = this.agentActivity?.getPlan();
    const checklist = formatPlanChecklist(plan);
    const rawText = stripExistingChecklist(this.currentAccumulatedText);

    let content = rawText;
    if (checklist) {
      content = checklist + content;
    }
    if (this.currentStatusLine) {
      content = content + this.currentStatusLine;
    }

    this.messages[messageIndex] = {
      role: "assistant",
      content,
    };
    this.sendMessagesToRendererThrottled();
  }

  private handlePlanUpdated(): void {
    this.updateActiveMessageContent();
  }
}

function formatPlanChecklist(plan: any): string {
  if (!plan || !plan.steps || plan.steps.length === 0) return "";
  const lines: string[] = [];
  lines.push(`### 📋 Progress: ${plan.title}`);
  for (const step of plan.steps) {
    let statusChar = " ";
    if (step.status === "done") {
      statusChar = "x";
    } else if (step.status === "in_progress") {
      statusChar = "/";
    } else if (step.status === "failed") {
      statusChar = "x` ❌ `";
    }

    let statusStr = `[${statusChar}] ${step.label}`;
    if (step.status === "failed") {
      statusStr = `[x] ❌ **${step.label} (Failed)**`;
    } else if (step.status === "in_progress") {
      statusStr = `[/] **${step.label}**`;
    }
    lines.push(`- ${statusStr}`);
  }
  lines.push("");
  return lines.join("\n");
}

function stripExistingChecklist(text: string): string {
  const marker = "### 📋 Progress:";
  const trimmedText = text.trimStart();
  if (trimmedText.startsWith(marker)) {
    const lines = trimmedText.split("\n");
    let contentStartIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith(marker) || line.startsWith("- [") || line === "") {
        contentStartIdx = i + 1;
      } else {
        break;
      }
    }
    return lines.slice(contentStartIdx).join("\n").trimStart();
  }
  return text;
}

function prependPlanChecklist(text: string, plan: any): string {
  if (!plan) return text;
  const checklist = formatPlanChecklist(plan);
  if (!checklist) return text;
  const stripped = stripExistingChecklist(text);
  return checklist + stripped;
}
