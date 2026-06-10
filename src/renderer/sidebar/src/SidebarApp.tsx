import React, { useEffect, useState } from "react";
import { AgentActivityProvider } from "./contexts/AgentActivityContext";
import { ChatProvider } from "./contexts/ChatContext";
import { ChatSettingsProvider } from "./contexts/ChatSettingsContext";
import { WebMcpProvider } from "./contexts/WebMcpContext";
import { Chat } from "./components/Chat";
import { ChatHeader } from "./components/ChatHeader";
import { ChatSettingsPanel } from "./components/ChatSettingsPanel";
import { ChatHistoryPanel } from "./components/ChatHistoryPanel";
import { WebMcpTools } from "./components/WebMcpTools";
import { AgentStatusBar } from "./components/AgentStatusBar";
import { WebMcpConsentModal } from "./components/WebMcpConsentModal";
import { useChat } from "./contexts/ChatContext";
import { useDarkMode } from "@common/hooks/useDarkMode";
import type { WebMcpConsentRequest } from "@shared/webmcp-types";

const ChatShell: React.FC = () => {
  const {
    sessionTitle,
    startNewChat,
    loadSession,
    deleteSession,
    sessions,
    activeSessionId,
  } = useChat();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatHeader
        title={sessionTitle}
        onNewChat={() => void startNewChat()}
        onOpenHistory={() => {
          setSettingsOpen(false);
          setHistoryOpen((v) => !v);
        }}
        onOpenSettings={() => {
          setHistoryOpen(false);
          setSettingsOpen((v) => !v);
        }}
        historyOpen={historyOpen}
        settingsOpen={settingsOpen}
      />

      <ChatHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={(id) => void loadSession(id)}
        onDelete={deleteSession}
      />

      <WebMcpTools />
      <AgentStatusBar />
      <Chat />

      <ChatSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
};

const SidebarContent: React.FC = () => {
  useDarkMode("slave");
  const [consentRequest, setConsentRequest] =
    useState<WebMcpConsentRequest | null>(null);

  useEffect(() => {
    window.sidebarAPI.onWebMcpConsentRequest((request) => {
      setConsentRequest(request);
    });

    return () => {
      window.sidebarAPI.removeWebMcpConsentListener();
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.screenX;
    const startWidth = window.innerWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // The drag handle is on the left edge of the sidebar.
      // Dragging left (smaller screenX) increases the sidebar width.
      // Dragging right (larger screenX) decreases the sidebar width.
      const deltaX = startX - moveEvent.screenX;
      const newWidth = startWidth + deltaX;
      void window.sidebarAPI.resizeSidebar(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background border-l border-border overflow-hidden">
      {/* Resizable handle on the left edge */}
      <div
        className="absolute top-0 -left-1 bottom-0 w-3 cursor-col-resize z-50 hover:bg-primary/20 active:bg-primary/40 transition-colors app-region-no-drag"
        onMouseDown={handleMouseDown}
      />
      <div className="flex flex-col flex-1 min-h-0 pl-2">
        <ChatShell />
      </div>
      <WebMcpConsentModal
        request={consentRequest}
        onClose={() => setConsentRequest(null)}
      />
    </div>
  );
};

export const SidebarApp: React.FC = () => {
  return (
    <WebMcpProvider>
      <ChatSettingsProvider>
        <AgentActivityProvider>
          <ChatProvider>
            <SidebarContent />
          </ChatProvider>
        </AgentActivityProvider>
      </ChatSettingsProvider>
    </WebMcpProvider>
  );
};
