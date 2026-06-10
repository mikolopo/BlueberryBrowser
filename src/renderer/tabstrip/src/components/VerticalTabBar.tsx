import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Settings, Sun, Moon } from "lucide-react";
import { useBrowser } from "@common/contexts/BrowserContext";
import { Favicon } from "@common/components/Favicon";
import { cn } from "@common/lib/utils";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { motion, AnimatePresence } from "framer-motion";

interface VerticalTabItemProps {
  title: string;
  url: string;
  favicon?: string | null;
  isActive: boolean;
  onClose: () => void;
  onActivate: () => void;
}

const getHostname = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url || "New tab";
  }
};

const VerticalTabItem: React.FC<VerticalTabItemProps> = ({
  title,
  url,
  favicon,
  isActive,
  onClose,
  onActivate,
}) => {
  const hostname = getHostname(url);
  const displayTitle = title?.trim() || hostname || "New Tab";

  return (
    <div className="group/tab relative px-2">
      <button
        type="button"
        onClick={onActivate}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            onClose();
          }
        }}
        className={cn(
          "app-region-no-drag w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left",
          "transition-all duration-150",
          isActive
            ? "bg-[rgb(var(--tab-active))] shadow-sm ring-1 ring-border"
            : "hover:bg-muted/70 dark:hover:bg-muted/50",
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-accent" />
        )}

        <div className="shrink-0">
          <Favicon src={favicon} className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate leading-tight">
            {displayTitle}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {hostname}
          </p>
        </div>
      </button>

      <button
        type="button"
        aria-label={`Close ${displayTitle}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn(
          "app-region-no-drag absolute right-3 top-1/2 -translate-y-1/2",
          "size-5 rounded-md flex items-center justify-center",
          "text-muted-foreground opacity-0 group-hover/tab:opacity-100",
          "hover:bg-muted hover:text-foreground transition-opacity",
          isActive && "opacity-100",
        )}
      >
        <X className="size-3" />
      </button>
    </div>
  );
};

const getFavicon = (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
};

const SettingsButton: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center justify-center transition-colors",
        className
      )}
    >
      <Settings className="size-4 text-muted-foreground group-hover:text-foreground transition-transform duration-700 ease-out group-hover:rotate-180" />
    </button>
  );
};

const ThemeButton: React.FC<{
  onClick: () => void;
  isDarkMode: boolean;
  className?: string;
}> = ({ onClick, isDarkMode, className }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center justify-center transition-colors",
        className
      )}
    >
      {isDarkMode ? (
        <Sun className="size-4 text-muted-foreground group-hover:text-foreground transition-all duration-300 group-hover:scale-110 group-hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-muted-foreground group-hover:text-foreground transition-all duration-300 group-hover:scale-110 group-hover:-rotate-12" />
      )}
    </button>
  );
};

export const VerticalTabBar: React.FC = () => {
  const { tabs, createTab, closeTab, switchTab } = useBrowser();
  const [expanded, setExpanded] = useState(true);
  const { isDarkMode, toggleDarkMode } = useDarkMode("master");

  useEffect(() => {
    const handleVisibility = (_event: unknown, visible: unknown) => {
      if (typeof visible === "boolean") setExpanded(visible);
    };

    window.electron?.ipcRenderer.on(
      "tab-strip-visibility-changed",
      handleVisibility,
    );
    void window.topBarAPI.getTabStripVisible().then((visible: boolean) => {
      if (typeof visible === "boolean") setExpanded(visible);
    });

    return () => {
      window.electron?.ipcRenderer.removeListener(
        "tab-strip-visibility-changed",
        handleVisibility,
      );
    };
  }, []);

  const toggleTabStrip = async () => {
    const visible = await window.topBarAPI.toggleTabStrip();
    if (typeof visible === "boolean") setExpanded(visible);
  };

  if (!expanded) {
    return (
      <div className="h-full flex flex-col min-h-0 items-center bg-[rgb(var(--tab-strip))] relative">
        <div className="h-12 shrink-0 w-full app-region-drag flex items-center justify-center border-b border-border">
          <button
            type="button"
            aria-label="Show tabs"
            title="Show tabs"
            onClick={() => void toggleTabStrip()}
            className={cn(
              "app-region-no-drag size-8 rounded-md flex items-center justify-center",
              "text-muted-foreground hover:text-foreground hover:bg-muted/70",
              "transition-colors",
            )}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Stacked settings & dark mode buttons when collapsed */}
        <div className="flex flex-col items-center gap-3.5 mt-4">
          <SettingsButton
            onClick={() => window.electron?.ipcRenderer.send("settings-toggle-request")}
            className="app-region-no-drag size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          />
          <ThemeButton
            onClick={toggleDarkMode}
            isDarkMode={isDarkMode}
            className="app-region-no-drag size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 relative">
      <div className="h-12 shrink-0 flex items-center justify-between px-3 app-region-drag border-b border-border">
        {/* Horizontal settings & dark mode controls when expanded */}
        <div className="flex items-center gap-1.5 app-region-no-drag">
          <ThemeButton
            onClick={toggleDarkMode}
            isDarkMode={isDarkMode}
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          />
          <SettingsButton
            onClick={() => window.electron?.ipcRenderer.send("settings-toggle-request")}
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          />
        </div>

        <button
          type="button"
          aria-label="Hide tabs"
          title="Hide tabs"
          onClick={() => void toggleTabStrip()}
          className={cn(
            "app-region-no-drag size-6 rounded-md flex items-center justify-center",
            "text-muted-foreground hover:text-foreground hover:bg-muted/70",
            "transition-colors",
          )}
        >
          <ChevronLeft className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1 app-region-no-drag">
        <div className="space-y-0.5 relative">
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <motion.div
                key={tab.id}
                layout
                initial={{ opacity: 0, height: 0, scale: 0.96 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                style={{ overflow: "hidden" }}
              >
                <VerticalTabItem
                  title={tab.title}
                  url={tab.url}
                  favicon={getFavicon(tab.url)}
                  isActive={tab.isActive}
                  onClose={() => closeTab(tab.id)}
                  onActivate={() => !tab.isActive && switchTab(tab.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="px-2 pt-1">
          <button
            type="button"
            onClick={() => createTab()}
            className={cn(
              "w-full flex items-center gap-2 rounded-lg px-2 py-2",
              "text-xs text-muted-foreground hover:text-foreground",
              "hover:bg-muted/70 dark:hover:bg-muted/50 transition-colors",
            )}
          >
            <Plus className="size-4 shrink-0" />
            <span>New Tab</span>
          </button>
        </div>
      </div>
    </div>
  );
};
