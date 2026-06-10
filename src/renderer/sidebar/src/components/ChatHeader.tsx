import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@common/lib/utils";
import { ChatHistoryIcon } from "./icons/ChatHistoryIcon";
import { SettingsSlidersIcon } from "./icons/SettingsSlidersIcon";

interface ChatHeaderProps {
  title: string;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  historyOpen: boolean;
  settingsOpen: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  onNewChat,
  onOpenHistory,
  onOpenSettings,
  historyOpen,
  settingsOpen,
}) => (
  <header
    className={cn(
      "relative z-10 flex shrink-0 items-center gap-1 border-b border-border",
      "bg-background/95 px-2 py-1.5 backdrop-blur-sm app-region-no-drag",
    )}
  >
    <button
      type="button"
      onClick={onOpenHistory}
      className={cn(
        "flex items-center justify-center size-8 rounded-lg transition-colors",
        historyOpen
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      title="Chat history"
      aria-label="Chat history"
      aria-expanded={historyOpen}
    >
      <ChatHistoryIcon className="size-[18px]" />
    </button>

    <button
      type="button"
      onClick={onNewChat}
      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
      title="New chat"
    >
      <Plus className="size-3.5" />
      <span className="hidden xs:inline">New</span>
    </button>

    <div className="flex-1 min-w-0 px-1">
      <p className="text-xs font-medium text-foreground truncate text-center">
        {title}
      </p>
    </div>

    <button
      type="button"
      onClick={onOpenSettings}
      className={cn(
        "flex items-center justify-center size-8 rounded-lg transition-colors",
        settingsOpen
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      title="Chat settings"
      aria-label="Chat settings"
      aria-expanded={settingsOpen}
    >
      <SettingsSlidersIcon className="size-[18px]" />
    </button>
  </header>
);
