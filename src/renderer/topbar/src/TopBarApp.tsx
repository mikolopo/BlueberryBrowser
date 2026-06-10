import React, { useCallback, useRef, useState, useEffect } from "react";
import { BrowserProvider } from "@common/contexts/BrowserContext";
import { BrowserSettingsProvider } from "@common/hooks/useBrowserSettings";
import { AddressBar } from "./components/AddressBar";
import { BrowserSettingsPanel } from "./components/BrowserSettingsPanel";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { cn } from "@common/lib/utils";
import { AnimatePresence } from "framer-motion";

const TopBarContent: React.FC = () => {
  useDarkMode("slave");
  const [settingsOpen, setSettingsOpenState] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
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

  const setSettingsOpen = useCallback((open: boolean) => {
    window.electron?.ipcRenderer.send("topbar-settings-panel-changed", open);
    setSettingsOpenState(open);
  }, []);

  const toggleSettings = useCallback(() => {
    setSettingsOpen(!settingsOpen);
  }, [settingsOpen, setSettingsOpen]);

  useEffect(() => {
    const handleToggle = () => {
      toggleSettings();
    };
    window.electron?.ipcRenderer.on("settings-toggle-request", handleToggle);
    return () => {
      window.electron?.ipcRenderer.removeListener("settings-toggle-request", handleToggle);
    };
  }, [toggleSettings]);

  return (
    <div
      className={cn(
        "relative flex flex-col h-full min-h-0 bg-[rgb(var(--topbar))] transition-[padding] duration-150",
        isSidebarOpen ? "pr-3" : "pr-[138px]"
      )}
    >
      <div
        className={cn(
          "app-region-drag absolute top-0 right-0 h-12 pointer-events-none",
          isSidebarOpen ? "w-3" : "w-[138px]"
        )}
        aria-hidden
      />
      <div className="relative z-10 flex items-center pl-3 pr-1 h-12 w-full min-w-0 shrink-0 border-b border-border">
        <AddressBar />
      </div>
      <div className={cn("relative min-h-0", settingsOpen && "flex-1")}>
        <AnimatePresence>
          {settingsOpen && (
            <BrowserSettingsPanel
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              triggerRef={settingsTriggerRef}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const TopBarApp: React.FC = () => (
  <BrowserSettingsProvider>
    <BrowserProvider>
      <TopBarContent />
    </BrowserProvider>
  </BrowserSettingsProvider>
);
