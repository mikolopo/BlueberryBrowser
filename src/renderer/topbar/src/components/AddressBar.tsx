import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Loader2,
  Sparkles,
  Settings,
} from "lucide-react";
import { useBrowser } from "@common/contexts/BrowserContext";
import { ToolBarButton } from "../components/ToolBarButton";
import { Favicon } from "@common/components/Favicon";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { cn } from "@common/lib/utils";
import { normalizeNavigationUrl } from "@common/lib/navigationUrl";

interface AddressBarProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  settingsOpen: boolean;
  settingsTriggerRef: React.RefObject<HTMLButtonElement | null>;
  onToggleSettings: () => void;
}

export const AddressBar: React.FC<AddressBarProps> = ({
  isDarkMode,
  onToggleDarkMode,
  settingsOpen,
  settingsTriggerRef,
  onToggleSettings,
}) => {
  const {
    activeTab,
    navigateToUrl,
    goBack,
    goForward,
    reload,
    isLoading,
    canGoBack,
    canGoForward,
  } = useBrowser();
  const [url, setUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleSidebarVisibility = (_event: unknown, visible: unknown) => {
      if (typeof visible === "boolean") setIsSidebarOpen(visible);
    };

    window.electron?.ipcRenderer.on(
      "sidebar-visibility-changed",
      handleSidebarVisibility,
    );
    void window.electron?.ipcRenderer
      .invoke("get-sidebar-visible")
      .then((visible) => {
        if (typeof visible === "boolean") setIsSidebarOpen(visible);
      });

    return () => {
      window.electron?.ipcRenderer.removeListener(
        "sidebar-visibility-changed",
        handleSidebarVisibility,
      );
    };
  }, []);

  // Update URL when active tab changes
  useEffect(() => {
    if (activeTab && !isEditing) {
      setUrl(activeTab.url || "");
    }
  }, [activeTab, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    navigateToUrl(normalizeNavigationUrl(url));
    setIsEditing(false);
    setIsFocused(false);
    (document.activeElement as HTMLElement)?.blur();
  };

  const handleFocus = () => {
    setIsEditing(true);
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setIsFocused(false);
    // Reset to current tab URL if editing was cancelled
    if (activeTab) {
      setUrl(activeTab.url || "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsEditing(false);
      setIsFocused(false);
      if (activeTab) {
        setUrl(activeTab.url || "");
      }
      (e.target as HTMLInputElement).blur();
    }
  };

  const canGoBackEnabled = canGoBack && activeTab !== null;
  const canGoForwardEnabled = canGoForward && activeTab !== null;

  // Extract domain and title for display
  const getDomain = () => {
    if (!activeTab?.url) return "";
    try {
      const urlObj = new URL(activeTab.url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return activeTab.url;
    }
  };

  const getPath = () => {
    if (!activeTab?.url) return "";
    try {
      const urlObj = new URL(activeTab.url);
      return urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      return "";
    }
  };

  const getFavicon = () => {
    if (!activeTab?.url) return null;
    try {
      const domain = new URL(activeTab.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const toggleSidebar = async () => {
    const visible = await window.topBarAPI.toggleSidebar();
    if (typeof visible === "boolean") {
      setIsSidebarOpen(visible);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full min-w-0 h-12">
      {/* Navigation Controls */}
      <div className="flex gap-1.5 app-region-no-drag shrink-0">
        <ToolBarButton
          Icon={ArrowLeft}
          onClick={goBack}
          active={canGoBackEnabled && !isLoading}
        />
        <ToolBarButton
          Icon={ArrowRight}
          onClick={goForward}
          active={canGoForwardEnabled && !isLoading}
        />
        <ToolBarButton
          onClick={reload}
          active={activeTab !== null && !isLoading}
        >
          {isLoading ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : (
            <RefreshCw className="size-4.5" />
          )}
        </ToolBarButton>
      </div>

      {/* Address Bar */}
      {isFocused ? (
        // Expanded State
        <form
          onSubmit={handleSubmit}
          className="app-region-no-drag flex-1 min-w-0 max-w-xl"
        >
          <div className="bg-background rounded-lg shadow-md p-1 dark:bg-secondary">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full px-1 py-0.5 text-xs outline-none bg-transparent text-foreground truncate"
              placeholder={
                activeTab ? "Enter URL or search term" : "No active tab"
              }
              disabled={!activeTab}
              spellCheck={false}
              autoFocus
            />
          </div>
        </form>
      ) : (
        // Collapsed State
        <div
          onClick={handleFocus}
          className={cn(
            "app-region-no-drag flex-1 min-w-0 max-w-xl px-3 h-8 rounded-md cursor-text group/address-bar",
            "hover:bg-muted text-muted-foreground app-region-no-drag",
            "transition-colors duration-200",
            "dark:hover:bg-muted/50",
          )}
        >
          <div className="flex h-full items-center">
            {/* Favicon */}
            <div className="size-4 mr-2">
              <Favicon src={getFavicon()} />
            </div>

            {/* URL Display */}
            <div className="text-[0.8rem] leading-normal truncate flex-1">
              {activeTab ? (
                <>
                  <span className="text-foreground dark:text-foreground">
                    {getDomain()}
                  </span>
                  <span className="group-hover/address-bar:hidden text-muted-foreground/60">
                    {activeTab.title && ` / ${activeTab.title}`}
                  </span>
                  <span className="group-hover/address-bar:inline hidden text-muted-foreground/60">
                    {getPath()}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No active tab</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Draggable title-bar gap — grab the window here */}
      <div className="app-region-drag h-full flex-1 min-w-[64px]" aria-hidden />

      {/* Actions Menu */}
      <div className="relative z-20 flex items-center gap-1 app-region-no-drag shrink-0">
        <ToolBarButton
          Icon={Sparkles}
          onClick={toggleSidebar}
          toggled={isSidebarOpen}
          title="Toggle AI sidebar"
        />
        <button
          ref={settingsTriggerRef}
          type="button"
          onClick={onToggleSettings}
          title="Browser settings"
          aria-label="Browser settings"
          aria-expanded={settingsOpen}
          className={cn(
            "flex items-center justify-center size-8 rounded-md transition-colors",
            settingsOpen
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Settings className="size-4" />
        </button>
        <DarkModeToggle isDarkMode={isDarkMode} onToggle={onToggleDarkMode} />
      </div>
    </div>
  );
};
