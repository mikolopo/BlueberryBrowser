import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface BrowserContextType {
  tabs: TabInfo[];
  activeTab: TabInfo | null;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  createTab: (url?: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  switchTab: (tabId: string) => Promise<void>;
  refreshTabs: () => Promise<void>;
  navigateToUrl: (url: string) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  reload: () => Promise<void>;
  takeScreenshot: (tabId: string) => Promise<string | null>;
}

const BrowserContext = createContext<BrowserContextType | null>(null);

export const useBrowser = () => {
  const context = useContext(BrowserContext);
  if (!context) {
    throw new Error("useBrowser must be used within a BrowserProvider");
  }
  return context;
};

export const BrowserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const activeTab = tabs.find((tab) => tab.isActive) || null;

  const refreshActiveTabNav = useCallback(async () => {
    try {
      const info = await window.topBarAPI.getActiveTabInfo();
      setCanGoBack(Boolean(info?.canGoBack));
      setCanGoForward(Boolean(info?.canGoForward));
    } catch {
      setCanGoBack(false);
      setCanGoForward(false);
    }
  }, []);

  const refreshTabs = useCallback(async () => {
    try {
      const tabsData = await window.topBarAPI.getTabs();
      setTabs(tabsData);
      await refreshActiveTabNav();
    } catch (error) {
      console.error("Failed to refresh tabs:", error);
    }
  }, [refreshActiveTabNav]);

  const applyTabsUpdate = useCallback(
    (tabsData: TabInfo[]) => {
      setTabs(tabsData);
      void refreshActiveTabNav();
    },
    [refreshActiveTabNav],
  );

  const createTab = useCallback(async (url?: string) => {
    setIsLoading(true);
    try {
      await window.topBarAPI.createTab(url);
    } catch (error) {
      console.error("Failed to create tab:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeTab = useCallback(async (tabId: string) => {
    setIsLoading(true);
    try {
      await window.topBarAPI.closeTab(tabId);
    } catch (error) {
      console.error("Failed to close tab:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchTab = useCallback(async (tabId: string) => {
    setIsLoading(true);
    try {
      await window.topBarAPI.switchTab(tabId);
    } catch (error) {
      console.error("Failed to switch tab:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const navigateToUrl = useCallback(
    async (url: string) => {
      if (!activeTab) return;

      setIsLoading(true);
      try {
        await window.topBarAPI.navigateTab(activeTab.id, url);
      } catch (error) {
        console.error("Failed to navigate:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [activeTab],
  );

  const goBack = useCallback(async () => {
    if (!activeTab) return;

    try {
      await window.topBarAPI.goBack(activeTab.id);
    } catch (error) {
      console.error("Failed to go back:", error);
    }
  }, [activeTab]);

  const goForward = useCallback(async () => {
    if (!activeTab) return;

    try {
      await window.topBarAPI.goForward(activeTab.id);
    } catch (error) {
      console.error("Failed to go forward:", error);
    }
  }, [activeTab]);

  const reload = useCallback(async () => {
    if (!activeTab) return;

    try {
      await window.topBarAPI.reload(activeTab.id);
    } catch (error) {
      console.error("Failed to reload:", error);
    }
  }, [activeTab]);

  const takeScreenshot = useCallback(async (tabId: string) => {
    try {
      return await window.topBarAPI.tabScreenshot(tabId);
    } catch (error) {
      console.error("Failed to take screenshot:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshTabs();

    window.topBarAPI.onTabsUpdated(applyTabsUpdate);
    return () => {
      window.topBarAPI.removeTabsUpdatedListener();
    };
  }, [refreshTabs, applyTabsUpdate]);

  const value: BrowserContextType = {
    tabs,
    activeTab,
    canGoBack,
    canGoForward,
    isLoading,
    createTab,
    closeTab,
    switchTab,
    refreshTabs,
    navigateToUrl,
    goBack,
    goForward,
    reload,
    takeScreenshot,
  };

  return (
    <BrowserContext.Provider value={value}>{children}</BrowserContext.Provider>
  );
};
