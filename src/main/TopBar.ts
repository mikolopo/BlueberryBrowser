import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { resolvePreloadPath } from "./resolvePreloadPath";
import {
  getContentLeftOffset,
  getContentWidth,
  getWindowContentSize,
  TOPBAR_HEIGHT,
  TOPBAR_SETTINGS_PANEL_HEIGHT,
} from "./windowLayout";

export class TopBar {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private _settingsPanelOpen = false;
  private _sidebarVisible = true;
  private _tabStripVisible = true;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: resolvePreloadPath("topbar"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const topbarUrl = new URL(
        "/topbar/",
        process.env["ELECTRON_RENDERER_URL"],
      );
      webContentsView.webContents.loadURL(topbarUrl.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/topbar.html"),
      );
    }

    return webContentsView;
  }

  private setupBounds(): void {
    this.updateBounds(true, true);
  }

  setSettingsPanelOpen(open: boolean): void {
    if (this._settingsPanelOpen === open) {
      return;
    }
    this._settingsPanelOpen = open;
    this.applyBounds();
    if (open) {
      this.raiseAboveContent();
    }
  }

  updateBounds(sidebarVisible = true, tabStripVisible = true): void {
    this._sidebarVisible = sidebarVisible;
    this._tabStripVisible = tabStripVisible;
    this.applyBounds();
  }

  private applyBounds(): void {
    const { width } = getWindowContentSize(this.baseWindow);
    const extra = this._settingsPanelOpen ? TOPBAR_SETTINGS_PANEL_HEIGHT : 0;

    this.webContentsView.setBounds({
      x: getContentLeftOffset(this._tabStripVisible),
      y: 0,
      width: getContentWidth(
        width,
        this._sidebarVisible,
        this._tabStripVisible,
      ),
      height: TOPBAR_HEIGHT + extra,
    });
  }

  /** Dropdown overlays tab content — bring top bar above sibling views. */
  private raiseAboveContent(): void {
    const parent = this.baseWindow.contentView;
    parent.removeChildView(this.webContentsView);
    parent.addChildView(this.webContentsView);
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }
}

export { TOPBAR_HEIGHT };
