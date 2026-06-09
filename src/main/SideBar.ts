import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { resolvePreloadPath } from "./resolvePreloadPath";
import { LLMClient } from "./LLMClient";
import type { BrowserSettings } from "../shared/browser-settings-types";
import {
  AI_SIDEBAR_WIDTH,
  getContentHeight,
  getContentOrigin,
  getWindowContentSize,
  TOPBAR_HEIGHT,
} from "./windowLayout";

export class SideBar {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private llmClient: LLMClient;
  private isVisible: boolean = true;

  constructor(baseWindow: BaseWindow, browserSettings: BrowserSettings) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();

    this.llmClient = new LLMClient(
      this.webContentsView.webContents,
      browserSettings,
    );
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: resolvePreloadPath("sidebar"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const sidebarUrl = new URL(
        "/sidebar/",
        process.env["ELECTRON_RENDERER_URL"],
      );
      webContentsView.webContents.loadURL(sidebarUrl.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/sidebar.html"),
      );
    }

    return webContentsView;
  }

  private setupBounds(): void {
    if (!this.isVisible) return;

    const { width, height } = getWindowContentSize(this.baseWindow);
    const origin = getContentOrigin();
    this.webContentsView.setBounds({
      x: width - AI_SIDEBAR_WIDTH,
      y: origin.y,
      width: AI_SIDEBAR_WIDTH,
      height: getContentHeight(height),
    });
  }

  updateBounds(): void {
    if (this.isVisible) {
      this.setupBounds();
    } else {
      this.webContentsView.setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    }
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  get client(): LLMClient {
    return this.llmClient;
  }

  show(): void {
    this.isVisible = true;
    this.setupBounds();
  }

  hide(): void {
    this.isVisible = false;
    this.webContentsView.setBounds({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  }

  toggle(): boolean {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
    return this.isVisible;
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }
}

export { AI_SIDEBAR_WIDTH, TOPBAR_HEIGHT };
