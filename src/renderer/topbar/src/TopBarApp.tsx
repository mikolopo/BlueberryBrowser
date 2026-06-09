import React, { useCallback, useRef, useState } from "react";
import { BrowserProvider } from "@common/contexts/BrowserContext";
import { BrowserSettingsProvider } from "@common/hooks/useBrowserSettings";
import { AddressBar } from "./components/AddressBar";
import { BrowserSettingsPanel } from "./components/BrowserSettingsPanel";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { cn } from "@common/lib/utils";

const TopBarContent: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useDarkMode("master");
  const [settingsOpen, setSettingsOpenState] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);

  const setSettingsOpen = useCallback((open: boolean) => {
    window.electron?.ipcRenderer.send("topbar-settings-panel-changed", open);
    setSettingsOpenState(open);
  }, []);

  const toggleSettings = useCallback(() => {
    setSettingsOpen(!settingsOpen);
  }, [settingsOpen, setSettingsOpen]);

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-[rgb(var(--topbar))] pr-[138px]">
      <div
        className="app-region-drag absolute top-0 right-0 h-12 w-[138px] pointer-events-none"
        aria-hidden
      />
      <div className="relative z-10 flex items-center px-3 h-12 w-full min-w-0 shrink-0 border-b border-border">
        <AddressBar
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          settingsOpen={settingsOpen}
          settingsTriggerRef={settingsTriggerRef}
          onToggleSettings={toggleSettings}
        />
      </div>
      <div className={cn("relative min-h-0", settingsOpen && "flex-1")}>
        <BrowserSettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          triggerRef={settingsTriggerRef}
        />
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
