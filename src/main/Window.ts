import { BaseWindow, BrowserWindow, nativeTheme, screen, shell } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import { TabStrip } from "./TabStrip";
import { getTheme } from "./themeColors";
import { is } from "@electron-toolkit/utils";
import { resolvePreloadPath } from "./resolvePreloadPath";
import { join } from "path";
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
  getWindowContentSize,
  TAB_STRIP_WIDTH,
  TAB_STRIP_COLLAPSED_WIDTH,
  TOPBAR_HEIGHT,
  TOPBAR_SETTINGS_PANEL_HEIGHT,
  setSidebarWidth,
  getSidebarWidth,
  CONTENT_EDGE_INSET,
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
  private _petWindow: BrowserWindow;
  private _isDarkMode: boolean;
  private _tabStripVisible: boolean = true;
  private _themeHasBeenApplied = false;
  private _webMcpService: WebMcpService;
  private _agentActivity: AgentActivityService;
  private _ongoingTaskService: OngoingTaskService;
  private _browserSettings: BrowserSettings = getEnvDefaultBrowserSettings();
  private layoutAnimationTimer: NodeJS.Timeout | null = null;
  private currentTabStripWidth = 240;
  private currentSidebarWidthVal = 400;

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

    // Initialize a small transparent, borderless child BrowserWindow for ScreenPet
    this._petWindow = new BrowserWindow({
      width: 48,
      height: 48,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      hasShadow: false,
      parent: this._baseWindow, // Make it float on top of parent window
      show: false, // Show inactive so focus remains on the main window
      focusable: false, // Prevent stealing focus when clicked or dragged!
      webPreferences: {
        preload: resolvePreloadPath("sidebar"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      void this._petWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/sidebar/?mode=pet-overlay`);
    } else {
      void this._petWindow.loadURL(`file://${join(__dirname, "../renderer/sidebar.html")}?mode=pet-overlay`);
    }

    this._petWindow.webContents.once("did-finish-load", () => {
      if (this._petWindow && !this._petWindow.isDestroyed()) {
        if (this._browserSettings.screenPetEnabled) {
          this._petWindow.showInactive();
        }
        this.sendBoundsToPet();
      }
    });

    this._agentActivity = new AgentActivityService();
    this._ongoingTaskService = new OngoingTaskService(
      () => this,
      () => this._agentActivity,
    );
    this._agentActivity.bindRenderers(
      () => this._topBar.view.webContents,
      () => this._sideBar.view.webContents,
      () => (this._petWindow && !this._petWindow.isDestroyed() ? this._petWindow.webContents : null),
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

    this.currentTabStripWidth = this._tabStripVisible ? TAB_STRIP_WIDTH : TAB_STRIP_COLLAPSED_WIDTH;
    this.currentSidebarWidthVal = this._sideBar.getIsVisible() ? getSidebarWidth() : 0;

    this._baseWindow.on("resize", () => {
      this.updateAllBounds();
      this.sendBoundsToPet();
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

    this._baseWindow.on("move", () => {
      this.sendBoundsToPet();
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this._baseWindow.on("closed", () => {
      if (this._petWindow && !this._petWindow.isDestroyed()) {
        this._petWindow.destroy();
      }
      this.tabsMap.forEach((tab) => tab.destroy());
      this.tabsMap.clear();
    });

    // Hide pet when main window loses focus (user tabs out to another app)
    this._baseWindow.on("blur", () => {
      if (this._petWindow && !this._petWindow.isDestroyed()) {
        this._petWindow.hide();
      }
    });

    // Show pet when main window regains focus
    this._baseWindow.on("focus", () => {
      if (this._petWindow && !this._petWindow.isDestroyed() && this._browserSettings.screenPetEnabled) {
        this._petWindow.showInactive();
      }
    });

    // Hide pet when main window is minimized
    this._baseWindow.on("minimize", () => {
      if (this._petWindow && !this._petWindow.isDestroyed()) {
        this._petWindow.hide();
      }
    });

    // Show pet when main window is restored from minimize
    this._baseWindow.on("restore", () => {
      if (this._petWindow && !this._petWindow.isDestroyed() && this._browserSettings.screenPetEnabled) {
        this._petWindow.showInactive();
      }
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
      onManualActionRecorded: (action) => {
        this._sideBar.client.recordManualAction(action);
      },
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
    
    this.ensurePetOverlayOnTop();

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
      this.createTab();
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

    this.ensurePetOverlayOnTop();

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
    const contentLeft = this.currentTabStripWidth;
    const sidebarWidth = this.currentSidebarWidthVal;

    const contentWidth = width - contentLeft - sidebarWidth - (sidebarWidth > 0 ? 0 : CONTENT_EDGE_INSET);
    const contentHeight = getContentHeight(height);

    tab.view.setBounds({
      x: contentLeft,
      y: TOPBAR_HEIGHT,
      width: Math.max(0, contentWidth),
      height: contentHeight,
    });
  }

  private updateTabBounds(): void {
    this.tabsMap.forEach((tab) => this.applyTabBounds(tab));
  }

  updateAllBounds(): void {
    this.ensureInitialTab();
    const { width, height } = getWindowContentSize(this._baseWindow);
    const contentLeft = this.currentTabStripWidth;
    const sidebarWidth = this.currentSidebarWidthVal;

    // 1. Update tab bounds
    this.updateTabBounds();

    // 2. Update tab strip bounds using animated width
    this._tabStrip.view.setBounds({
      x: 0,
      y: 0,
      width: this.currentTabStripWidth,
      height,
    });

    // 3. Update topbar bounds using animated widths
    const topBarWidth = width - contentLeft - (sidebarWidth > 0 ? sidebarWidth : 0) - (sidebarWidth > 0 ? 0 : CONTENT_EDGE_INSET);
    this._topBar.view.setBounds({
      x: contentLeft,
      y: 0,
      width: Math.max(0, topBarWidth),
      height: TOPBAR_HEIGHT + (this._topBar["_settingsPanelOpen"] ? TOPBAR_SETTINGS_PANEL_HEIGHT : 0),
    });

    // 4. Update sidebar bounds using animated width
    const contentHeight = getContentHeight(height);
    if (sidebarWidth > 0) {
      this._sideBar.view.setVisible(true);
      this._sideBar.view.setBounds({
        x: width - sidebarWidth,
        y: TOPBAR_HEIGHT,
        width: sidebarWidth,
        height: contentHeight,
      });
    } else {
      this._sideBar.view.setVisible(false);
      this._sideBar.view.setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    }

    // 5. Update pet bounds synced from parent window
    this.sendBoundsToPet();
  }

  private ensurePetOverlayOnTop(): void {
    // Child BrowserWindow is managed natively by Electron on top of parent window.
  }

  sendBoundsToPet(): void {
    if (this._petWindow && !this._petWindow.isDestroyed()) {
      const bounds = this._baseWindow.getBounds();
      this._petWindow.webContents.send("main-window-bounds", {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
    }
  }

  movePet(x: number, y: number): void {
    if (this._petWindow && !this._petWindow.isDestroyed()) {
      const mainBounds = this._baseWindow.getBounds();
      const currentBounds = this._petWindow.getBounds();
      this._petWindow.setBounds({
        x: Math.round(mainBounds.x + x),
        y: Math.round(mainBounds.y + y),
        width: currentBounds.width,
        height: currentBounds.height,
      });
    }
  }

  setPetSize(width: number, height: number): void {
    if (this._petWindow && !this._petWindow.isDestroyed()) {
      const currentBounds = this._petWindow.getBounds();
      this._petWindow.setBounds({
        x: currentBounds.x,
        y: currentBounds.y,
        width,
        height,
      });
    }
  }

  private animateLayout(): void {
    if (this.layoutAnimationTimer) {
      clearInterval(this.layoutAnimationTimer);
      this.layoutAnimationTimer = null;
    }

    const targetTabStripWidth = this._tabStripVisible ? TAB_STRIP_WIDTH : TAB_STRIP_COLLAPSED_WIDTH;
    const targetSidebarWidth = this._sideBar.getIsVisible() ? getSidebarWidth() : 0;

    const duration = 180; // ms
    const stepTime = 10;  // ms
    const totalSteps = duration / stepTime;
    let step = 0;

    const startTabStripWidth = this.currentTabStripWidth;
    const startSidebarWidth = this.currentSidebarWidthVal;

    this.layoutAnimationTimer = setInterval(() => {
      step++;
      const t = step / totalSteps;
      // easeOutQuad
      const ease = t * (2 - t);

      this.currentTabStripWidth = Math.round(
        startTabStripWidth + (targetTabStripWidth - startTabStripWidth) * ease
      );
      this.currentSidebarWidthVal = Math.round(
        startSidebarWidth + (targetSidebarWidth - startSidebarWidth) * ease
      );

      this.updateAllBounds();

      if (step >= totalSteps) {
        clearInterval(this.layoutAnimationTimer!);
        this.layoutAnimationTimer = null;
        this.currentTabStripWidth = targetTabStripWidth;
        this.currentSidebarWidthVal = targetSidebarWidth;
        this.updateAllBounds();
      }
    }, stepTime);
  }

  toggleTabStrip(): boolean {
    this._tabStripVisible = !this._tabStripVisible;
    this.animateLayout();
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
    const prevPetEnabled = this._browserSettings.screenPetEnabled;
    this._browserSettings = { ...settings };
    this.applyPageThemeToAllTabs();
    this._sideBar.client.applyBrowserSettings(settings);

    // Show or hide the pet window when the setting changes
    if (settings.screenPetEnabled !== prevPetEnabled) {
      if (this._petWindow && !this._petWindow.isDestroyed()) {
        if (settings.screenPetEnabled && this._baseWindow.isFocused()) {
          this._petWindow.showInactive();
        } else if (!settings.screenPetEnabled) {
          this._petWindow.hide();
        }
      }
    }
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
    this.animateLayout();
    this.broadcastSidebarVisibility(visible);
    return visible;
  }

  resizeSidebar(width: number): void {
    setSidebarWidth(width);
    this.currentSidebarWidthVal = width;
    this.updateAllBounds();
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
