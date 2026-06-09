import type { BaseWindow } from "electron";

/** Shared layout constants for all WebContentsView regions. */
export const TAB_STRIP_WIDTH = 240;
export const TAB_STRIP_COLLAPSED_WIDTH = 40;
/** Height of the top bar WebContentsView (address bar row only). */
export const TOPBAR_MAIN_HEIGHT = 48;
export const TOPBAR_HEIGHT = TOPBAR_MAIN_HEIGHT;
/** Extra height for the top bar WebContentsView when the settings dropdown is open. */
export const TOPBAR_SETTINGS_PANEL_HEIGHT = 320;
export const AI_SIDEBAR_WIDTH = 400;
/** Inset so content does not bleed past the window edge when a panel is hidden. */
export const CONTENT_EDGE_INSET = 8;

export const getTabStripWidth = (tabStripExpanded: boolean): number =>
  tabStripExpanded ? TAB_STRIP_WIDTH : TAB_STRIP_COLLAPSED_WIDTH;

/** Left offset for top bar and web content. */
export const getContentLeftOffset = (tabStripExpanded: boolean): number =>
  getTabStripWidth(tabStripExpanded);

export const getWindowContentSize = (
  baseWindow: BaseWindow,
): { width: number; height: number } => {
  const { width, height } = baseWindow.getContentBounds();
  return { width, height };
};

export const getContentOrigin = (
  tabStripExpanded = true,
): { x: number; y: number } => ({
  x: getContentLeftOffset(tabStripExpanded),
  y: TOPBAR_HEIGHT,
});

export const getContentWidth = (
  windowWidth: number,
  aiSidebarVisible: boolean,
  tabStripExpanded = true,
): number =>
  windowWidth -
  getContentLeftOffset(tabStripExpanded) -
  (aiSidebarVisible ? AI_SIDEBAR_WIDTH : 0) -
  (aiSidebarVisible ? 0 : CONTENT_EDGE_INSET);

export const getContentHeight = (contentHeight: number): number =>
  Math.max(0, contentHeight - TOPBAR_HEIGHT - CONTENT_EDGE_INSET);
