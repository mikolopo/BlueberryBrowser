import { NativeImage, nativeTheme, WebContentsView } from "electron";
import { getTheme } from "./themeColors";
import { applyPageDarkModeWithRetry } from "./pageDarkMode";
import {
  buildBerryAssistantInitScriptFromDisk,
  buildBerryActivityScript,
  buildCursorAnimateScript,
} from "./agent/berryPageAssistant";
import type { AgentActivityEvent } from "../shared/agent-activity-types";

/** Wait after nativeTheme settles, then reload twice (pages often need a second pass). */
const RELOAD_AFTER_SETTLE_MS = 300;
const SECOND_RELOAD_GAP_MS = 500;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface TabOptions {
  onDidFinishLoad?: (tab: Tab) => void;
  onMetadataChanged?: (tab: Tab) => void;
  getIsDarkMode?: () => boolean;
  getForcePageDarkMode?: () => boolean;
}

export class Tab {
  private webContentsView: WebContentsView;
  private _id: string;
  private _title: string;
  private _url: string;
  private _isVisible: boolean = false;
  private _getIsDarkMode: (() => boolean) | null = null;
  private _getForcePageDarkMode: (() => boolean) | null = null;
  private _pageThemeGeneration = 0;
  private _themeReloadTimer: NodeJS.Timeout | null = null;
  private _secondReloadTimer: NodeJS.Timeout | null = null;
  private _themeReloadGeneration = 0;
  private _onMetadataChanged: ((tab: Tab) => void) | null = null;
  private _metadataNotifyTimer: NodeJS.Timeout | null = null;

  constructor(
    id: string,
    url: string = "https://www.google.com",
    options: TabOptions = {},
  ) {
    this._id = id;
    this._url = url;
    this._title = "New Tab";
    this._getIsDarkMode = options.getIsDarkMode ?? null;
    this._getForcePageDarkMode = options.getForcePageDarkMode ?? null;
    this._onMetadataChanged = options.onMetadataChanged ?? null;

    const isDark = this._getIsDarkMode?.() ?? false;
    const initialBg = getTheme(isDark).contentBg;

    this.webContentsView = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        backgroundThrottling: false,
      },
    });

    this.webContentsView.setBackgroundColor(initialBg);
    this.setupEventListeners(options.onDidFinishLoad);
    void this.loadURL(url);
  }

  private schedulePageThemeSync(): void {
    const generation = ++this._pageThemeGeneration;
    const webContents = this.webContentsView.webContents;
    const isDark = this._getIsDarkMode?.() ?? false;
    const force = this._getForcePageDarkMode?.() ?? false;

    void applyPageDarkModeWithRetry(webContents, isDark, force).then(() => {
      if (
        generation !== this._pageThemeGeneration ||
        webContents.isDestroyed()
      ) {
        return;
      }
    });
  }

  private setupEventListeners(onDidFinishLoad?: (tab: Tab) => void): void {
    const webContents = this.webContentsView.webContents;

    const notifyMetadata = (): void => {
      if (!this._onMetadataChanged) return;
      if (this._metadataNotifyTimer) clearTimeout(this._metadataNotifyTimer);
      this._metadataNotifyTimer = setTimeout(() => {
        this._metadataNotifyTimer = null;
        this._onMetadataChanged?.(this);
      }, 120);
    };

    webContents.on("page-title-updated", (_, title) => {
      this._title = title;
      notifyMetadata();
    });

    webContents.on("did-navigate", (_, url) => {
      this._url = url;
      notifyMetadata();
    });

    webContents.on("did-navigate-in-page", (_, url) => {
      this._url = url;
      notifyMetadata();
    });

    if (onDidFinishLoad) {
      webContents.on("did-finish-load", () => {
        onDidFinishLoad(this);
      });
    }

    webContents.on("dom-ready", () => {
      this.schedulePageThemeSync();
    });

    webContents.on("did-finish-load", () => {
      this.schedulePageThemeSync();
    });
  }

  syncPageDarkMode(
    isDark?: boolean,
    forcePageDarkMode?: boolean,
  ): Promise<void> {
    const dark = isDark ?? this._getIsDarkMode?.() ?? false;
    const force = forcePageDarkMode ?? this._getForcePageDarkMode?.() ?? false;
    this._pageThemeGeneration += 1;
    const webContents = this.webContentsView.webContents;
    return applyPageDarkModeWithRetry(webContents, dark, force, [0, 150]);
  }

  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get url(): string {
    return this._url;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  get webContents() {
    return this.webContentsView.webContents;
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  show(): void {
    this._isVisible = true;
    this.webContentsView.setVisible(true);
  }

  hide(): void {
    this._isVisible = false;
    this.webContentsView.setVisible(false);
  }

  async screenshot(): Promise<NativeImage> {
    return await this.webContentsView.webContents.capturePage();
  }

  async runJs(code: string, userGesture = false): Promise<any> {
    return await this.webContentsView.webContents.executeJavaScript(
      code,
      userGesture,
    );
  }

  async prepareForInteraction(options?: { focus?: boolean }): Promise<void> {
    const wc = this.webContentsView.webContents;
    if (wc.isDestroyed()) throw new Error("Tab destroyed");

    if (wc.isLoading()) {
      await Promise.race([
        new Promise<void>((resolve) =>
          wc.once("did-finish-load", () => resolve()),
        ),
        sleep(6000),
      ]);
    }

    await wc.executeJavaScript(
      `(${runPrepareForInteraction.toString()})()`,
      true,
    );

    if (options?.focus !== false) {
      wc.focus();
    }
  }

  async runInteractionJs(code: string): Promise<any> {
    return await this.webContentsView.webContents.executeJavaScript(code, true);
  }

  async getTabHtml(maxLength = 65_536): Promise<string> {
    return await this.runJs(
      `(${runGetTabHtml.toString()})(${JSON.stringify(maxLength)})`,
    );
  }

  async getTabText(): Promise<string> {
    return await this.runJs(`(${runGetTabText.toString()})()`);
  }

  loadURL(url: string): Promise<void> {
    this._url = url;
    return this.webContentsView.webContents.loadURL(url);
  }

  goBack(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoBack()) {
      this.webContentsView.webContents.navigationHistory.goBack();
    }
  }

  goForward(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoForward()) {
      this.webContentsView.webContents.navigationHistory.goForward();
    }
  }

  reload(): void {
    this.webContentsView.webContents.reload();
  }

  stop(): void {
    this.webContentsView.webContents.stop();
  }

  destroy(): void {
    this.clearThemeReloadTimers();
    if (this._metadataNotifyTimer) {
      clearTimeout(this._metadataNotifyTimer);
      this._metadataNotifyTimer = null;
    }
    this._themeReloadGeneration += 1;
    const wc = this.webContentsView.webContents;
    if (!wc.isDestroyed()) {
      wc.removeAllListeners();
      wc.close();
    }
  }

  setBackgroundColor(color: string): void {
    this.webContentsView.setBackgroundColor(color);
  }

  private clearThemeReloadTimers(): void {
    if (this._themeReloadTimer !== null) {
      clearTimeout(this._themeReloadTimer);
      this._themeReloadTimer = null;
    }
    if (this._secondReloadTimer !== null) {
      clearTimeout(this._secondReloadTimer);
      this._secondReloadTimer = null;
    }
  }

  scheduleReloadAfterThemeChange(): void {
    this.clearThemeReloadTimers();
    const generation = ++this._themeReloadGeneration;

    const doubleReload = (): void => {
      if (generation !== this._themeReloadGeneration) return;
      const wc = this.webContentsView.webContents;
      if (wc.isDestroyed()) return;

      wc.reload();
      this._secondReloadTimer = setTimeout(() => {
        this._secondReloadTimer = null;
        if (generation !== this._themeReloadGeneration) return;
        if (!wc.isDestroyed()) wc.reload();
      }, SECOND_RELOAD_GAP_MS);
    };

    const armReloadTimer = (): void => {
      if (generation !== this._themeReloadGeneration) return;
      this._themeReloadTimer = setTimeout(() => {
        this._themeReloadTimer = null;
        doubleReload();
      }, RELOAD_AFTER_SETTLE_MS);
    };

    let armed = false;
    const armOnce = (): void => {
      if (armed || generation !== this._themeReloadGeneration) return;
      armed = true;
      armReloadTimer();
    };

    nativeTheme.once("updated", armOnce);
    setTimeout(armOnce, 100);
  }

  async ensureAgentCursor(): Promise<void> {
    await this.runJs(buildBerryAssistantInitScriptFromDisk());
  }

  async playBerryActivity(event: AgentActivityEvent): Promise<void> {
    if (this.webContents.isDestroyed() || !this._isVisible) return;
    try {
      await this.ensureAgentCursor();
      await this.runJs(buildBerryActivityScript(event));
    } catch {
      /* optional overlay */
    }
  }

  async animateAgentToolClick(toolName: string): Promise<void> {
    await this.ensureAgentCursor();
    await this.runJs(buildCursorAnimateScript(toolName));
  }
}

function runPrepareForInteraction() {
  return new Promise((resolve) => {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      resolve(true);
      return;
    }
    const done = () => resolve(true);
    document.addEventListener("DOMContentLoaded", done, { once: true });
    setTimeout(done, 1500);
  });
}

function runGetTabHtml(maxLength: number) {
  try {
    const html = document.documentElement.outerHTML || "";
    return html.slice(0, maxLength);
  } catch {
    return "";
  }
}

function runGetTabText() {
  try {
    const body = document.body;
    if (!body) return "";
    return (body.innerText || "").slice(0, 8000);
  } catch {
    return "";
  }
}
