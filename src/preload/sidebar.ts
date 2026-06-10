import { contextBridge, ipcRenderer } from "electron";
import { createSafeBridge } from "./safeIpc";

// Channel-whitelisted bridge — replaces @electron-toolkit electronAPI which
// exposed raw ipcRenderer and process.env (API keys) to the renderer.
const electronBridge = createSafeBridge({
  send: ["dark-mode-changed"],
  invoke: [],
  on: ["dark-mode-updated"],
});

interface ChatRequest {
  message: string;
  messageId: string;
  webMcpEnabled?: boolean;
  webMcpGlobalEnabled?: boolean;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

// Sidebar specific APIs
const sidebarAPI = {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) =>
    ipcRenderer.invoke("sidebar-chat-message", request),

  stopAgent: () => ipcRenderer.invoke("sidebar-stop-agent"),

  isAgentRunning: () => ipcRenderer.invoke("sidebar-is-agent-running"),

  clearChat: () => ipcRenderer.invoke("sidebar-clear-chat"),

  setMessages: (messages: { role: string; content: string }[]) =>
    ipcRenderer.invoke("sidebar-set-messages", messages),

  getMessages: () => ipcRenderer.invoke("sidebar-get-messages"),

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    ipcRenderer.on("chat-response", (_, data) => callback(data));
  },

  onMessagesUpdated: (callback: (messages: any[]) => void) => {
    ipcRenderer.on("chat-messages-updated", (_, messages) =>
      callback(messages),
    );
  },

  removeChatResponseListener: () => {
    ipcRenderer.removeAllListeners("chat-response");
  },

  removeMessagesUpdatedListener: () => {
    ipcRenderer.removeAllListeners("chat-messages-updated");
  },

  // Page content access
  getPageContent: () => ipcRenderer.invoke("get-page-content"),
  getPageText: () => ipcRenderer.invoke("get-page-text"),
  getCurrentUrl: () => ipcRenderer.invoke("get-current-url"),

  // Tab information
  getActiveTabInfo: () => ipcRenderer.invoke("get-active-tab-info"),

  // WebMCP tool discovery
  getWebMcpTools: (tabId?: string) =>
    ipcRenderer.invoke("webmcp-get-tools", tabId),

  refreshWebMcpTools: () => ipcRenderer.invoke("webmcp-refresh-active-tab"),

  executeWebMcpTool: (
    tabId: string,
    toolName: string,
    args?: Record<string, unknown>,
  ) => ipcRenderer.invoke("webmcp-execute-tool", tabId, toolName, args),

  respondWebMcpConsent: (response: {
    requestId: string;
    granted: boolean;
    rememberOrigin: boolean;
    origin: string;
  }) => ipcRenderer.invoke("webmcp-consent-response", response),

  getWebMcpConsentedOrigins: () =>
    ipcRenderer.invoke("webmcp-get-consented-origins"),

  revokeWebMcpConsent: (origin: string) =>
    ipcRenderer.invoke("webmcp-revoke-consent", origin),

  onWebMcpToolsUpdated: (callback: (snapshot: unknown) => void) => {
    ipcRenderer.on("webmcp-tools-updated", (_, snapshot) => callback(snapshot));
  },

  onWebMcpConsentRequest: (callback: (request: unknown) => void) => {
    ipcRenderer.on("webmcp-consent-request", (_, request) => callback(request));
  },

  removeWebMcpToolsListener: () => {
    ipcRenderer.removeAllListeners("webmcp-tools-updated");
  },

  removeWebMcpConsentListener: () => {
    ipcRenderer.removeAllListeners("webmcp-consent-request");
  },

  getAgentActivity: () => ipcRenderer.invoke("agent-get-state"),

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

  resizeSidebar: (width: number) => ipcRenderer.invoke("sidebar-resize", width),

  runActions: (actions: any[]) => ipcRenderer.invoke("sidebar-run-actions", actions),
  getRecordedActions: () => ipcRenderer.invoke("sidebar-get-recorded-actions"),
  onActionsRecordedUpdated: (callback: (actions: any[]) => void) => {
    ipcRenderer.on("actions-recorded-updated", (_, actions) => callback(actions));
  },
  removeActionsRecordedUpdatedListener: () => {
    ipcRenderer.removeAllListeners("actions-recorded-updated");
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronBridge);
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronBridge;
  // @ts-ignore (define in dts)
  window.sidebarAPI = sidebarAPI;
}
