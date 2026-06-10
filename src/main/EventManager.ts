import { ipcMain, WebContents } from "electron";
import type { Window } from "./Window";
import { normalizeNavigationUrl } from "./navigationUrl";
import type { BrowserSettings } from "../shared/browser-settings-types";
import { normalizeBrowserSettings } from "../shared/browser-settings-types";

/** All ipcMain.handle channels registered by EventManager — used for clean teardown. */
const IPC_HANDLE_CHANNELS = [
  "agent-get-state",
  "create-tab",
  "close-tab",
  "switch-tab",
  "get-tabs",
  "navigate-to",
  "navigate-tab",
  "go-back",
  "go-forward",
  "reload",
  "tab-go-back",
  "tab-go-forward",
  "tab-reload",
  "tab-screenshot",
  "get-active-tab-info",
  "toggle-sidebar",
  "get-sidebar-visible",
  "toggle-tab-strip",
  "get-tab-strip-visible",
  "sidebar-chat-message",
  "sidebar-stop-agent",
  "sidebar-is-agent-running",
  "sidebar-clear-chat",
  "sidebar-set-messages",
  "sidebar-get-messages",
  "get-page-content",
  "get-page-text",
  "get-current-url",
  "webmcp-get-tools",
  "webmcp-list-all-tools",
  "webmcp-refresh-active-tab",
  "webmcp-execute-tool",
  "webmcp-consent-response",
  "webmcp-get-consented-origins",
  "webmcp-revoke-consent",
] as const;

const IPC_ON_CHANNELS = [
  "dark-mode-changed",
  "browser-settings-changed",
  "topbar-settings-panel-changed",
] as const;

export class EventManager {
  private mainWindow: Window;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Tab management events
    this.handleTabEvents();

    // Sidebar events
    this.handleSidebarEvents();

    // Page content events
    this.handlePageContentEvents();

    // Dark mode events
    this.handleDarkModeEvents();

    // WebMCP tool discovery
    this.handleWebMcpEvents();

    // Agent activity feed / viewport
    this.handleAgentEvents();
  }

  private handleAgentEvents(): void {
    ipcMain.handle("agent-get-state", () => {
      const activity = this.mainWindow.agentActivity;
      return {
        event: null,
        viewport: activity.getViewport(),
        feed: activity.getFeed(),
      };
    });
  }

  private handleTabEvents(): void {
    // Create new tab
    ipcMain.handle("create-tab", (_, url?: string) => {
      const targetUrl = url ? normalizeNavigationUrl(url) : undefined;
      const newTab = this.mainWindow.createTab(targetUrl);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Close tab
    ipcMain.handle("close-tab", (_, id: string) => {
      this.mainWindow.closeTab(id);
    });

    // Switch tab
    ipcMain.handle("switch-tab", (_, id: string) => {
      this.mainWindow.switchActiveTab(id);
    });

    // Get tabs
    ipcMain.handle("get-tabs", () => {
      return this.mainWindow.getTabsSnapshot();
    });

    // Navigation (for compatibility with existing code)
    ipcMain.handle("navigate-to", (_, url: string) => {
      if (this.mainWindow.activeTab) {
        void this.mainWindow.activeTab.loadURL(normalizeNavigationUrl(url));
      }
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        await tab.loadURL(normalizeNavigationUrl(url));
        return true;
      }
      return false;
    });

    ipcMain.handle("go-back", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goBack();
      }
    });

    ipcMain.handle("go-forward", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goForward();
      }
    });

    ipcMain.handle("reload", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.reload();
      }
    });

    // Tab-specific navigation handlers
    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    // Tab info
    ipcMain.handle("get-active-tab-info", () => {
      const activeTab = this.mainWindow.activeTab;
      if (!activeTab) return null;
      const wc = activeTab.webContents;
      if (wc.isDestroyed()) return null;
      return {
        id: activeTab.id,
        url: activeTab.url,
        title: activeTab.title,
        canGoBack: wc.canGoBack(),
        canGoForward: wc.canGoForward(),
      };
    });
  }

  private handleSidebarEvents(): void {
    ipcMain.handle("toggle-sidebar", () => {
      return this.mainWindow.toggleSidebar();
    });

    ipcMain.handle("get-sidebar-visible", () => {
      return this.mainWindow.sidebar.getIsVisible();
    });

    ipcMain.handle("toggle-tab-strip", () => {
      return this.mainWindow.toggleTabStrip();
    });

    ipcMain.handle("get-tab-strip-visible", () => {
      return this.mainWindow.getTabStripVisible();
    });

    // Chat message
    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    ipcMain.handle("sidebar-stop-agent", () => {
      const stoppedTask = this.mainWindow.ongoingTaskService.stop();
      const stoppedAgent = this.mainWindow.sidebar.client.cancelActiveRequest();
      return stoppedTask.stopped || stoppedAgent;
    });

    ipcMain.handle("sidebar-is-agent-running", () => {
      return this.mainWindow.sidebar.client.isAgentRunning();
    });

    // Clear chat
    ipcMain.handle("sidebar-clear-chat", () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    // Restore chat messages (session switch)
    ipcMain.handle("sidebar-set-messages", (_, messages) => {
      this.mainWindow.sidebar.client.setMessages(messages ?? []);
      return true;
    });

    // Get messages
    ipcMain.handle("sidebar-get-messages", () => {
      return this.mainWindow.sidebar.client.getMessages();
    });

    ipcMain.handle("sidebar-resize", (_, width: number) => {
      this.mainWindow.resizeSidebar(width);
      return true;
    });
  }

  private handlePageContentEvents(): void {
    // Get page content
    ipcMain.handle("get-page-content", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    // Get page text
    ipcMain.handle("get-page-text", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    // Get current URL
    ipcMain.handle("get-current-url", () => {
      if (this.mainWindow.activeTab) {
        return this.mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleDarkModeEvents(): void {
    ipcMain.on("dark-mode-changed", (event, isDarkMode: boolean) => {
      if (typeof isDarkMode !== "boolean") return;
      this.mainWindow.applyTheme(isDarkMode);
      this.mainWindow.ensureInitialTab();
      this.broadcastDarkMode(event.sender, isDarkMode);
    });

    ipcMain.on(
      "browser-settings-changed",
      (_, settings: Partial<BrowserSettings>) => {
        if (!settings || typeof settings !== "object") {
          return;
        }
        this.mainWindow.applyBrowserSettings(
          normalizeBrowserSettings({
            ...this.mainWindow.getBrowserSettings(),
            ...settings,
          }),
        );
      },
    );

    ipcMain.on("topbar-settings-panel-changed", (_, open: boolean) => {
      if (typeof open !== "boolean") return;
      this.mainWindow.setTopBarSettingsPanelOpen(open);
    });
  }

  private handleWebMcpEvents(): void {
    ipcMain.handle("webmcp-get-tools", (_, tabId?: string) => {
      if (typeof tabId === "string") {
        return this.mainWindow.webMcpService.registry.getForTab(tabId);
      }
      return this.mainWindow.webMcpService.registry.getForActiveTab(
        this.mainWindow.activeTab?.id ?? null,
      );
    });

    ipcMain.handle("webmcp-list-all-tools", () => {
      return this.mainWindow.webMcpService.registry.getAll();
    });

    ipcMain.handle("webmcp-refresh-active-tab", async () => {
      const tab = this.mainWindow.activeTab;
      if (!tab) return null;
      await this.mainWindow.probeWebMcp(tab);
      return this.mainWindow.webMcpService.registry.getForTab(tab.id);
    });

    ipcMain.handle(
      "webmcp-execute-tool",
      async (
        _,
        tabId: string,
        toolName: string,
        args?: Record<string, unknown>,
      ) => {
        const tab = this.mainWindow.getTab(tabId);
        if (!tab || typeof toolName !== "string") {
          return { success: false, error: "Invalid tool execution request." };
        }
        return this.mainWindow.webMcpService.executeTool(
          tab,
          toolName,
          args ?? {},
        );
      },
    );

    ipcMain.handle("webmcp-consent-response", (_, response) => {
      this.mainWindow.webMcpService.handleConsentResponse(response);
      return true;
    });

    ipcMain.handle("webmcp-get-consented-origins", () => {
      return this.mainWindow.webMcpService.getConsentedOrigins();
    });

    ipcMain.handle("webmcp-revoke-consent", (_, origin: string) => {
      if (typeof origin === "string") {
        this.mainWindow.webMcpService.revokeConsent(origin);
      }
      return true;
    });
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode,
      );
    }

    if (this.mainWindow.tabStrip.view.webContents !== sender) {
      this.mainWindow.tabStrip.view.webContents.send(
        "dark-mode-updated",
        isDarkMode,
      );
    }

    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode,
      );
    }
  }

  public cleanup(): void {
    for (const channel of IPC_HANDLE_CHANNELS) {
      ipcMain.removeHandler(channel);
    }
    for (const channel of IPC_ON_CHANNELS) {
      ipcMain.removeAllListeners(channel);
    }
  }
}
