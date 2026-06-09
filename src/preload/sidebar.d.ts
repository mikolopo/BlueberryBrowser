import type {
  AgentActivityEvent,
  AgentViewportState,
} from "../shared/agent-activity-types";
import type { SafeIpcBridge } from "./safeIpc";

interface AgentActivityPayload {
  event: AgentActivityEvent | null;
  viewport: AgentViewportState;
  feed: AgentActivityEvent[];
}

interface ChatRequest {
  message: string;
  context?: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
  webMcpEnabled?: boolean;
  webMcpGlobalEnabled?: boolean;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface WebMcpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  source: "native" | "declarative";
}

interface WebMcpTabSnapshot {
  tabId: string;
  origin: string;
  url: string;
  supportsNative: boolean;
  tools: WebMcpToolDescriptor[];
  discoveredAt: number;
  error?: string;
}

interface WebMcpExecuteResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

interface WebMcpConsentRequest {
  requestId: string;
  origin: string;
  url: string;
  toolName: string;
  description: string;
  args: Record<string, unknown>;
  source: "native" | "declarative";
}

interface WebMcpConsentResponse {
  requestId: string;
  granted: boolean;
  rememberOrigin: boolean;
  origin: string;
}

interface SidebarAPI {
  sendChatMessage: (request: Partial<ChatRequest>) => Promise<void>;
  stopAgent: () => Promise<boolean>;
  isAgentRunning: () => Promise<boolean>;
  clearChat: () => Promise<boolean>;
  setMessages: (
    messages: { role: string; content: string }[],
  ) => Promise<boolean>;
  getMessages: () => Promise<unknown[]>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  onMessagesUpdated: (callback: (messages: unknown[]) => void) => void;
  removeChatResponseListener: () => void;
  removeMessagesUpdatedListener: () => void;
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;
  getActiveTabInfo: () => Promise<TabInfo | null>;
  getWebMcpTools: (tabId?: string) => Promise<WebMcpTabSnapshot | null>;
  refreshWebMcpTools: () => Promise<WebMcpTabSnapshot | null>;
  executeWebMcpTool: (
    tabId: string,
    toolName: string,
    args?: Record<string, unknown>,
  ) => Promise<WebMcpExecuteResult>;
  respondWebMcpConsent: (response: WebMcpConsentResponse) => Promise<boolean>;
  getWebMcpConsentedOrigins: () => Promise<string[]>;
  revokeWebMcpConsent: (origin: string) => Promise<boolean>;
  onWebMcpToolsUpdated: (
    callback: (snapshot: WebMcpTabSnapshot) => void,
  ) => void;
  onWebMcpConsentRequest: (
    callback: (request: WebMcpConsentRequest) => void,
  ) => void;
  removeWebMcpToolsListener: () => void;
  removeWebMcpConsentListener: () => void;
  getAgentActivity: () => Promise<AgentActivityPayload | null>;
  onAgentActivityUpdated: (
    callback: (payload: AgentActivityPayload) => void,
  ) => void;
  removeAgentActivityListener: () => void;
}

declare global {
  interface Window {
    electron: SafeIpcBridge;
    sidebarAPI: SidebarAPI;
  }
}
