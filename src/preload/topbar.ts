import { contextBridge, ipcRenderer } from "electron";
import { createSafeBridge } from "./safeIpc";

// Channel-whitelisted bridge — replaces @electron-toolkit electronAPI which
// exposed raw ipcRenderer and process.env (API keys) to the renderer.
const electronBridge = createSafeBridge({
  send: [
    "dark-mode-changed",
    "browser-settings-changed",
    "topbar-settings-panel-changed",
  ],
  invoke: ["get-sidebar-visible"],
  on: [
    "dark-mode-updated",
    "sidebar-visibility-changed",
    "tab-strip-visibility-changed",
  ],
});

// TopBar specific APIs
const topBarAPI = {
  // Tab management
  createTab: (url?: string) => ipcRenderer.invoke("create-tab", url),
  closeTab: (tabId: string) => ipcRenderer.invoke("close-tab", tabId),
  switchTab: (tabId: string) => ipcRenderer.invoke("switch-tab", tabId),
  getTabs: () => ipcRenderer.invoke("get-tabs"),
  getActiveTabInfo: () => ipcRenderer.invoke("get-active-tab-info"),

  onTabsUpdated: (
    callback: (
      tabs: {
        id: string;
        title: string;
        url: string;
        isActive: boolean;
      }[],
    ) => void,
  ) => {
    ipcRenderer.on("tabs-updated", (_, tabs) => callback(tabs));
  },

  removeTabsUpdatedListener: () => {
    ipcRenderer.removeAllListeners("tabs-updated");
  },

  // Tab navigation
  navigateTab: (tabId: string, url: string) =>
    ipcRenderer.invoke("navigate-tab", tabId, url),
  goBack: (tabId: string) => ipcRenderer.invoke("tab-go-back", tabId),
  goForward: (tabId: string) => ipcRenderer.invoke("tab-go-forward", tabId),
  reload: (tabId: string) => ipcRenderer.invoke("tab-reload", tabId),

  // Tab actions
  tabScreenshot: (tabId: string) => ipcRenderer.invoke("tab-screenshot", tabId),

  // Sidebar
  toggleSidebar: () => ipcRenderer.invoke("toggle-sidebar"),

  // Tab strip
  toggleTabStrip: () => ipcRenderer.invoke("toggle-tab-strip"),
  getTabStripVisible: () => ipcRenderer.invoke("get-tab-strip-visible"),

  getAgentViewport: () => ipcRenderer.invoke("agent-get-state"),

  onAgentActivityUpdated: (
    callback: (payload: {
      event: unknown;
      viewport: unknown;
      feed: unknown[];
    }) => void,
  ) => {
    ipcRenderer.on("agent-activity-updated", (_, payload) => callback(payload));
  },

  removeAgentActivityListener: () => {
    ipcRenderer.removeAllListeners("agent-activity-updated");
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronBridge);
    contextBridge.exposeInMainWorld("topBarAPI", topBarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronBridge;
  // @ts-ignore (define in dts)
  window.topBarAPI = topBarAPI;
}
