import React, { useEffect, useRef } from "react";
import { Trash2, X } from "lucide-react";
import { cn } from "@common/lib/utils";
import type { ChatSession } from "../lib/chatHistoryStorage";
import { ChatHistoryIcon } from "./icons/ChatHistoryIcon";
import { motion } from "framer-motion";

interface ChatHistoryPanelProps {
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  onClose,
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <motion.div
        className="absolute inset-0 z-20 bg-background/40 backdrop-blur-[1px] app-region-no-drag"
        onClick={onClose}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      />
      <motion.aside
        ref={panelRef}
        className={cn(
          "absolute inset-y-0 left-0 z-30 flex w-[min(100%,16rem)] flex-col",
          "border-r border-border bg-popover/90 backdrop-blur-md shadow-expanded",
          "app-region-no-drag",
        )}
        role="dialog"
        aria-label="Chat history"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <ChatHistoryIcon className="size-4 text-muted-foreground shrink-0" />
            <h2 className="text-sm font-semibold truncate">History</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sorted.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground text-center">
              No saved conversations yet. Send a message or start a new chat.
            </p>
          ) : (
            <ul className="space-y-1">
              {sorted.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <li key={session.id}>
                    <div
                      className={cn(
                        "group flex items-stretch rounded-lg border transition-colors",
                        active
                          ? "border-primary/40 bg-primary/5"
                          : "border-transparent hover:bg-muted/60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(session.id);
                          onClose();
                        }}
                        className="flex-1 min-w-0 text-left px-2.5 py-2"
                      >
                        <div className="text-xs font-medium text-foreground truncate">
                          {session.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatWhen(session.updatedAt)} ·{" "}
                          {session.messages.length} msgs
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(session.id);
                        }}
                        className="px-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.aside>
    </>
  );
};
