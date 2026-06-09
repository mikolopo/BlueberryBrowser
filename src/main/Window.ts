import { BaseWindow, nativeTheme, screen, shell } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import { TabStrip } from "./TabStrip";
import { getTheme } from "./themeColors";
import type { BrowserSettings } from "../shared/browser-settings-types";
import { getEnvDefaultBrowserSettings } from "./browserSettingsDefaults";
import { WEBMCP_PROBE_SCRIPT } from "./webmcp/probe";
import { WebMcpService } from "./webmcp/WebMcpService";
import type { WebMcpProbeResult } from "../shared/webmcp-types";
import { AgentActivityService } from "./agent/AgentActivityService";
import { OngoingTaskService } from "./actions/OngoingTaskService";
import {
  AI_SIDEBAR_WIDTH,
  getContentHeight,
  getContentOrigin,
  getContentWidth,
  getWindowContentSize,
  TAB_STRIP_WIDTH,
  TOPBAR_HEIGHT,
} from "./windowLayout";

const getInitialWindowBounds = (): {
  x: number;
  y: number;
  width: number;
  height: number;
} => {
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(1200, workArea.width - 48);
  const height = Math.min(760, workArea.height - 24);

  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  };
};

export class Window {
  private _baseWindow: BaseWindow;
  private tabsMap: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabCounter: number = 0;
  private _tabStrip: TabStrip;
  private _topBar: TopBar;
  private _sideBar: SideBar;
  private _isDarkMode: boolean;
  private _tabStripVisible: boolean = true;
  private _themeHasBeenApplied = false;
  private _webMcpService: WebMcpService;
  private _agentActivity: AgentActivityService;
  private _ongoingTaskService: OngoingTaskService;
  private _browserSettings: BrowserSettings = getEnvDefaultBrowserSettings();

  constructor() {
    this._isDarkMode = nativeTheme.shouldUseDarkColors;
    const theme = getTheme(this._isDarkMode);
    const initialBounds = getInitialWindowBounds();

    this._baseWindow = new BaseWindow({
      ...initialBounds,
      show: true,
      autoHideMenuBar: false,
      backgroundColor: theme.windowBg,
      titleBarStyle: "hidden",
      ...(process.platform !== "darwin"
        ? { titleBarOverlay: { ...theme.titleBarOverlay } }
        : {}),
      trafficLightPosition: { x: 12, y: 10 },
    });

    this._baseWindow.setMinimumSize(900, 640);

    this._tabStrip = new TabStrip(this._baseWindow);
    this._topBar = new TopBar(this._baseWindow);
    this._sideBar = new SideBar(this._baseWindow, this._browserSettings);

    this._agentActivity = new AgentActivityService();
    this._ongoingTaskService = new OngoingTaskService(
      () => this,
      () => this._agentActivity,
    );
    this._agentActivity.bindRenderers(
      () => this._topBar.view.webContents,
      () => this._sideBar.view.webContents,
    );
    this._agentActivity.setPageVisualHandler((event) => {
      const tabId = event.tabId ?? this.activeTabId;
      if (!tabId || tabId !== this.activeTabId) return;
      const tab = this.tabsMap.get(tabId);
      if (tab) void tab.playBerryActivity(event);
    });

    this._webMcpService = new WebMcpService(
      () => this._sideBar.view.webContents,
      this._agentActivity,
    );

    this._sideBar.client.setWindow(this);
    this._sideBar.client.setAgentActivity(this._agentActivity);

    // Default: pages follow prefers-color-scheme via nativeTheme (Google dark mode, etc.).
    nativeTheme.themeSource = this._isDarkMode ? "dark" : "light";

    this._baseWindow.on("resize", () => {
      this.updateTabBounds();
      this._tabStrip.updateBounds(this._tabStripVisible);
      this._topBar.updateBounds(
        this._sideBar.getIsVisible(),
        this._tabStripVisible,
      );
      this._sideBar.updateBounds();
      const bounds = this._baseWindow.getBounds();
      if (this.activeTab) {
        const wc = this.activeTab.webContents;
        if (!wc.isDestroyed()) {
          wc.send("window-resized", {
            width: bounds.width,
            height: bounds.height,
          });
        }
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this._baseWindow.on("closed", () => {
      this.tabsMap.forEach((tab) => tab.destroy());
      this.tabsMap.clear();
    });
  }

  get window(): BaseWindow {
    return this._baseWindow;
  }

  get activeTab(): Tab | null {
    if (this.activeTabId) {
      return this.tabsMap.get(this.activeTabId) || null;
    }
    return null;
  }

  get allTabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  get tabCount(): number {
    return this.tabsMap.size;
  }

  createTab(url?: string): Tab {
    const tabId = `tab-${++this.tabCounter}`;
    const tab = new Tab(tabId, url, {
      onDidFinishLoad: (loadedTab) => {
        void this.probeWebMcp(loadedTab);
      },
      onMetadataChanged: () => {
        this.broadcastTabsUpdated();
      },
      getIsDarkMode: () => this._isDarkMode,
      getForcePageDarkMode: () => this._browserSettings.forcePageDarkMode,
    });

    tab.setBackgroundColor(getTheme(this._isDarkMode).contentBg);
    tab.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });

    this._baseWindow.contentView.addChildView(tab.view);
    this.applyTabBounds(tab);

    this.tabsMap.set(tabId, tab);
    this.switchActiveTab(tabId);
    this.broadcastTabsUpdated();

    return tab;
  }

  closeTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    this._baseWindow.contentView.removeChildView(tab.view);
    tab.destroy();
    this.tabsMap.delete(tabId);
    this._webMcpService.removeTab(tabId);

    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      const remainingTabs = Array.from(this.tabsMap.keys());
      if (remainingTabs.length > 0) {
        this.switchActiveTab(remainingTabs[0]);
      }
    }

    if (this.tabsMap.size === 0) {
      this._baseWindow.close();
    }

    this.broadcastTabsUpdated();
    return true;
  }

  switchActiveTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentTab = this.tabsMap.get(this.activeTabId);
      if (currentTab) {
        currentTab.hide();
      }
    }

    tab.show();
    this.activeTabId = tabId;
    this._baseWindow.setTitle(tab.title || "Blueberry Browser");

    this._agentActivity.setViewportUrl(tabId, tab.url, tab.title);
    this._webMcpService.publishActiveTabTools(tabId);
    this.broadcastTabsUpdated();

    return true;
  }

  get webMcpService(): WebMcpService {
    return this._webMcpService;
  }

  get agentActivity(): AgentActivityService {
    return this._agentActivity;
  }

  get ongoingTaskService(): OngoingTaskService {
    return this._ongoingTaskService;
  }

  async probeWebMcp(tab: Tab): Promise<void> {
    try {
      const result = (await tab.webContents.executeJavaScript(
        WEBMCP_PROBE_SCRIPT,
      )) as WebMcpProbeResult;
      this._webMcpService.updateFromProbe(tab.id, result, this.activeTabId);
    } catch (error) {
      this._webMcpService.updateFromProbe(
        tab.id,
        {
          supportsNative: false,
          origin: "",
          url: tab.url,
          tools: [],
          error: String(error),
        },
        this.activeTabId,
      );
    }
  }

  /** Wait for load, probe declarative + script-registered tools, then re-probe once for late init. */
  async probeWebMcpAfterLoad(tab: Tab): Promise<void> {
    const webContents = tab.webContents;
    if (!webContents.isDestroyed() && webContents.isLoading()) {
      await new Promise<void>((resolve) => {
        webContents.once("did-finish-load", () => resolve());
      });
    }
    await this.probeWebMcp(tab);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await this.probeWebMcp(tab);
  }

  getTab(tabId: string): Tab | null {
    return this.tabsMap.get(tabId) || null;
  }

  show(): void {
    this._baseWindow.show();
  }

  hide(): void {
    this._baseWindow.hide();
  }

  close(): void {
    this._baseWindow.close();
  }

  focus(): void {
    this._baseWindow.focus();
  }

  /** Focus the browser window and active tab so keyboard/mouse automation registers. */
  focusActiveTabForInteraction(options?: { force?: boolean }): void {
    if (this._baseWindow.isDestroyed()) return;
    if (!options?.force && this.isSidebarFocused()) return;
    this._baseWindow.focus();
    const tab = this.activeTab;
    if (tab && tab.isVisible) {
      tab.webContents.focus();
    }
  }

  isSidebarFocused(): boolean {
    const wc = this._sideBar.view.webContents;
    return !wc.isDestroyed() && wc.isFocused();
  }

  minimize(): void {
    this._baseWindow.minimize();
  }

  maximize(): void {
    this._baseWindow.maximize();
  }

  unmaximize(): void {
    this._baseWindow.unmaximize();
  }

  isMaximized(): boolean {
    return this._baseWindow.isMaximized();
  }

  setTitle(title: string): void {
    this._baseWindow.setTitle(title);
  }

  setBounds(bounds: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }): void {
    this._baseWindow.setBounds(bounds);
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return this._baseWindow.getBounds();
  }

  private applyTabBounds(tab: Tab): void {
    const { width, height } = getWindowContentSize(this._baseWindow);
    const origin = getContentOrigin(this._tabStripVisible);
    tab.view.setBounds({
      x: origin.x,
      y: origin.y,
      width: getContentWidth(
        width,
        this._sideBar.getIsVisible(),
        this._tabStripVisible,
      ),
      height: getContentHeight(height),
    });
  }

  private updateTabBounds(): void {
    this.tabsMap.forEach((tab) => this.applyTabBounds(tab));
  }

  updateAllBounds(): void {
    const sidebarVisible = this._sideBar.getIsVisible();
    this.updateTabBounds();
    this._tabStrip.updateBounds(this._tabStripVisible);
    this._topBar.updateBounds(sidebarVisible, this._tabStripVisible);
    this._sideBar.updateBounds();
  }

  toggleTabStrip(): boolean {
    this._tabStripVisible = !this._tabStripVisible;
    this.updateAllBounds();
    this.broadcastTabStripVisibility(this._tabStripVisible);
    return this._tabStripVisible;
  }

  getTabStripVisible(): boolean {
    return this._tabStripVisible;
  }

  private broadcastTabStripVisibility(isVisible: boolean): void {
    this._topBar.view.webContents.send(
      "tab-strip-visibility-changed",
      isVisible,
    );
    this._tabStrip.view.webContents.send(
      "tab-strip-visibility-changed",
      isVisible,
    );
  }

  ensureInitialTab(): void {
    if (this.tabsMap.size === 0) {
      this.createTab();
    }
  }

  private applyPageThemeToAllTabs(): void {
    for (const tab of this.allTabs) {
      void tab.syncPageDarkMode(
        this._isDarkMode,
        this._browserSettings.forcePageDarkMode,
      );
    }
  }

  private refreshAllTabsAfterThemeChange(): void {
    for (const tab of this.allTabs) {
      tab.scheduleReloadAfterThemeChange();
    }
  }

  applyBrowserSettings(settings: BrowserSettings): void {
    this._browserSettings = { ...settings };
    this.applyPageThemeToAllTabs();
    this._sideBar.client.applyBrowserSettings(settings);
  }

  getBrowserSettings(): BrowserSettings {
    return { ...this._browserSettings };
  }

  setTopBarSettingsPanelOpen(open: boolean): void {
    this._topBar.setSettingsPanelOpen(open);
  }

  applyTheme(isDark: boolean, options: { reloadTabs?: boolean } = {}): void {
    const themeChanged =
      this._themeHasBeenApplied && this._isDarkMode !== isDark;
    this._isDarkMode = isDark;
    this._themeHasBeenApplied = true;
    const theme = getTheme(isDark);

    nativeTheme.themeSource = isDark ? "dark" : "light";
    this._baseWindow.setBackgroundColor(theme.windowBg);

    if (process.platform !== "darwin") {
      this._baseWindow.setTitleBarOverlay({ ...theme.titleBarOverlay });
    }

    this.allTabs.forEach((tab) => {
      tab.setBackgroundColor(theme.contentBg);
    });

    const shouldReload = options.reloadTabs ?? themeChanged;
    if (shouldReload && this.tabsMap.size > 0) {
      this.refreshAllTabsAfterThemeChange();
    } else if (themeChanged && this.tabsMap.size > 0) {
      this.applyPageThemeToAllTabs();
    }
  }

  toggleSidebar(): boolean {
    const visible = this._sideBar.toggle();
    this.updateAllBounds();
    this.broadcastSidebarVisibility(visible);
    return visible;
  }

  private broadcastSidebarVisibility(isVisible: boolean): void {
    this._topBar.view.webContents.send("sidebar-visibility-changed", isVisible);
  }

  getTabsSnapshot(): {
    id: string;
    title: string;
    url: string;
    isActive: boolean;
  }[] {
    const activeTabId = this.activeTabId;
    return this.allTabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      isActive: activeTabId === tab.id,
    }));
  }

  broadcastTabsUpdated(): void {
    const tabs = this.getTabsSnapshot();
    for (const view of [this._topBar.view, this._tabStrip.view]) {
      const wc = view.webContents;
      if (!wc.isDestroyed()) {
        wc.send("tabs-updated", tabs);
      }
    }
  }

  get sidebar(): SideBar {
    return this._sideBar;
  }

  get topBar(): TopBar {
    return this._topBar;
  }

  get tabStrip(): TabStrip {
    return this._tabStrip;
  }

  get tabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  get baseWindow(): BaseWindow {
    return this._baseWindow;
  }
}

// Re-export layout constants for other modules
export { TAB_STRIP_WIDTH, TOPBAR_HEIGHT, AI_SIDEBAR_WIDTH };
