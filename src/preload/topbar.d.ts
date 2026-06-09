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

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface ActiveTabInfo {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface TopBarAPI {
  // Tab management
  createTab: (
    url?: string,
  ) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;
  getActiveTabInfo: () => Promise<ActiveTabInfo | null>;

  onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => void;
  removeTabsUpdatedListener: () => void;

  // Tab navigation
  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  // Tab actions
  tabScreenshot: (tabId: string) => Promise<string | null>;

  // Sidebar
  toggleSidebar: () => Promise<boolean>;

  // Tab strip
  toggleTabStrip: () => Promise<boolean>;
  getTabStripVisible: () => Promise<boolean>;

  getAgentViewport: () => Promise<AgentActivityPayload | null>;

  onAgentActivityUpdated: (
    callback: (payload: AgentActivityPayload) => void,
  ) => void;

  removeAgentActivityListener: () => void;
}

declare global {
  interface Window {
    electron: SafeIpcBridge;
    topBarAPI: TopBarAPI;
  }
}
