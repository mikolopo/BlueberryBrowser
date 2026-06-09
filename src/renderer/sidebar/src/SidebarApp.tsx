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

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background border-l border-border overflow-hidden">
      <ChatShell />
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
