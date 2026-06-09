import { randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import type {
  WebMcpConsentRequest,
  WebMcpConsentResponse,
  WebMcpExecuteResult,
  WebMcpProbeResult,
  WebMcpTabSnapshot,
} from "../../shared/webmcp-types";
import { ConsentManager } from "./ConsentManager";
import { executeWebMcpTool } from "./execute";
import { WebMcpRegistry } from "./WebMcpRegistry";
import type { Tab } from "../Tab";
import type { AgentActivityService } from "../agent/AgentActivityService";
import { toolFormSelector } from "../agent/berryPageAssistant";

const CONSENT_TIMEOUT_MS = 120_000;

export class WebMcpService {
  readonly registry = new WebMcpRegistry();
  private readonly consent = new ConsentManager();
  private readonly pendingConsent = new Map<
    string,
    (granted: boolean) => void
  >();
  private readonly pendingConsentTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private readonly getSidebarWebContents: () => WebContents,
    private readonly agentActivity: AgentActivityService | null = null,
  ) {}

  updateFromProbe(
    tabId: string,
    probe: WebMcpProbeResult,
    activeTabId: string | null,
  ): WebMcpTabSnapshot {
    const snapshot = this.registry.update(tabId, probe);
    if (activeTabId === tabId) {
      this.publishTools(snapshot);
    }
    return snapshot;
  }

  removeTab(tabId: string): void {
    this.registry.remove(tabId);
  }

  publishActiveTabTools(tabId: string): void {
    const snapshot = this.registry.getForTab(tabId);
    if (snapshot) {
      this.publishTools(snapshot);
    }
  }

  getConsentedOrigins(): string[] {
    return this.consent.getGrantedOrigins();
  }

  revokeConsent(origin: string): void {
    this.consent.revoke(origin);
  }

  handleConsentResponse(response: WebMcpConsentResponse): void {
    const resolve = this.pendingConsent.get(response.requestId);
    if (!resolve) return;

    this.clearConsentTimer(response.requestId);
    this.pendingConsent.delete(response.requestId);

    if (response.granted && response.rememberOrigin) {
      this.consent.grant(response.origin);
    }

    resolve(response.granted);
  }

  private clearConsentTimer(requestId: string): void {
    const timer = this.pendingConsentTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.pendingConsentTimers.delete(requestId);
    }
  }

  async executeTool(
    tab: Tab,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<WebMcpExecuteResult> {
    const snapshot = this.registry.getForTab(tab.id);
    if (!snapshot) {
      return { success: false, error: "No tools discovered for this tab." };
    }

    const tool = snapshot.tools.find((entry) => entry.name === toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found on this page.`,
      };
    }

    const consentOrigin = this.getConsentOrigin(snapshot.origin, snapshot.url);

    this.agentActivity?.emit({
      kind: "tool_consent",
      label: `Consent required: ${tool.name}`,
      detail: snapshot.url,
      tabId: tab.id,
      url: snapshot.url,
      toolName: tool.name,
    });

    const granted = await this.requestConsent({
      origin: consentOrigin,
      url: snapshot.url,
      toolName: tool.name,
      description: tool.description,
      args,
      source: tool.source,
    });

    if (!granted) {
      this.agentActivity?.emit({
        kind: "tool_denied",
        label: `Denied: ${tool.name}`,
        tabId: tab.id,
        url: snapshot.url,
        toolName: tool.name,
      });
      return { success: false, error: "User denied tool execution." };
    }

    const selector = toolFormSelector(tool.name);
    this.agentActivity?.emit({
      kind: "clicking",
      label: `Clicking form: ${tool.name}`,
      tabId: tab.id,
      url: snapshot.url,
      toolName: tool.name,
      selector,
    });

    await new Promise((resolve) => setTimeout(resolve, 250));

    this.agentActivity?.emit({
      kind: "tool_running",
      label: `Running: ${tool.name}`,
      tabId: tab.id,
      url: snapshot.url,
      toolName: tool.name,
    });

    try {
      const result = await executeWebMcpTool(
        tab.webContents,
        tool.name,
        args,
        tool.source,
      );
      this.agentActivity?.emit({
        kind: "tool_done",
        label: `Done: ${tool.name}`,
        tabId: tab.id,
        url: snapshot.url,
        toolName: tool.name,
      });
      return { success: true, result };
    } catch (error) {
      this.agentActivity?.emit({
        kind: "tool_denied",
        label: `Error: ${tool.name}`,
        detail: String(error),
        tabId: tab.id,
        toolName: tool.name,
      });
      return { success: false, error: String(error) };
    }
  }

  private async requestConsent(
    request: Omit<WebMcpConsentRequest, "requestId">,
  ): Promise<boolean> {
    if (this.consent.isGranted(request.origin)) {
      return true;
    }

    const requestId = randomUUID();
    const sidebar = this.getSidebarWebContents();
    if (sidebar.isDestroyed()) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      this.pendingConsent.set(requestId, resolve);

      const payload: WebMcpConsentRequest = { ...request, requestId };
      sidebar.send("webmcp-consent-request", payload);

      const timer = setTimeout(() => {
        this.pendingConsentTimers.delete(requestId);
        if (this.pendingConsent.has(requestId)) {
          this.pendingConsent.delete(requestId);
          resolve(false);
        }
      }, CONSENT_TIMEOUT_MS);
      this.pendingConsentTimers.set(requestId, timer);
    });
  }

  private publishTools(snapshot: WebMcpTabSnapshot): void {
    const sidebar = this.getSidebarWebContents();
    if (!sidebar.isDestroyed()) {
      sidebar.send("webmcp-tools-updated", snapshot);
    }
  }

  private getConsentOrigin(origin: string, url: string): string {
    if (origin && origin !== "null") return origin;
    return url;
  }
}
