import type {
  WebMcpProbeResult,
  WebMcpTabSnapshot,
} from "../../shared/webmcp-types";

export class WebMcpRegistry {
  private readonly byTab = new Map<string, WebMcpTabSnapshot>();

  update(tabId: string, probe: WebMcpProbeResult): WebMcpTabSnapshot {
    const snapshot: WebMcpTabSnapshot = {
      tabId,
      origin: probe.origin,
      url: probe.url,
      supportsNative: probe.supportsNative,
      tools: probe.tools,
      discoveredAt: Date.now(),
      error: probe.error,
    };
    this.byTab.set(tabId, snapshot);
    return snapshot;
  }

  remove(tabId: string): void {
    this.byTab.delete(tabId);
  }

  getForTab(tabId: string): WebMcpTabSnapshot | null {
    return this.byTab.get(tabId) ?? null;
  }

  getForActiveTab(activeTabId: string | null): WebMcpTabSnapshot | null {
    if (!activeTabId) return null;
    return this.getForTab(activeTabId);
  }

  getAll(): WebMcpTabSnapshot[] {
    return [...this.byTab.values()];
  }
}
