import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { resolvePreloadPath } from "./resolvePreloadPath";
import {
  TAB_STRIP_WIDTH,
  TAB_STRIP_COLLAPSED_WIDTH,
  getWindowContentSize,
} from "./windowLayout";

export class TabStrip {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;

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
      const tabStripUrl = new URL(
        "/tabstrip/",
        process.env["ELECTRON_RENDERER_URL"],
      );
      webContentsView.webContents.loadURL(tabStripUrl.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/tabstrip.html"),
      );
    }

    return webContentsView;
  }

  private setupBounds(expanded = true): void {
    const { height } = getWindowContentSize(this.baseWindow);
    const width = expanded ? TAB_STRIP_WIDTH : TAB_STRIP_COLLAPSED_WIDTH;

    this.webContentsView.setVisible(true);
    this.webContentsView.setBounds({
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  updateBounds(expanded = true): void {
    this.setupBounds(expanded);
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }
}
