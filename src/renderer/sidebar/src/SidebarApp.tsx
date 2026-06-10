import React, { useEffect, useState } from "react";
import { AgentActivityProvider } from "./contexts/AgentActivityContext";
import { ChatProvider } from "./contexts/ChatContext";
import { ChatSettingsProvider } from "./contexts/ChatSettingsContext";
import { WebMcpProvider } from "./contexts/WebMcpContext";
import { Chat } from "./components/Chat";
import { ChatHeader } from "./components/ChatHeader";
import { ChatSettingsPanel } from "./components/ChatSettingsPanel";
import { ChatHistoryPanel } from "./components/ChatHistoryPanel";
import { SavedScriptsPanel } from "./components/SavedScriptsPanel";
import { WebMcpTools } from "./components/WebMcpTools";
import { AgentStatusBar } from "./components/AgentStatusBar";
import { WebMcpConsentModal } from "./components/WebMcpConsentModal";
import { useChat } from "./contexts/ChatContext";
import { useChatSettings } from "./contexts/ChatSettingsContext";
import { useDarkMode } from "@common/hooks/useDarkMode";
import type { WebMcpConsentRequest } from "@shared/webmcp-types";

const ChatShell: React.FC<{
  generatedScriptData: { python: string; typescript: string; actions: any[] } | null;
  onCloseScript: () => void;
}> = ({ generatedScriptData, onCloseScript }) => {
  const {
    sessionTitle,
    startNewChat,
    loadSession,
    deleteSession,
    sessions,
    activeSessionId,
  } = useChat();
  const { automationScriptsEnabled } = useChatSettings();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scriptsOpen, setScriptsOpen] = useState(false);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatHeader
        title={sessionTitle}
        onNewChat={() => void startNewChat()}
        onOpenHistory={() => {
          setSettingsOpen(false);
          setScriptsOpen(false);
          setHistoryOpen((v) => !v);
        }}
        onOpenSettings={() => {
          setHistoryOpen(false);
          setScriptsOpen(false);
          setSettingsOpen((v) => !v);
        }}
        onOpenScripts={() => {
          setHistoryOpen(false);
          setSettingsOpen(false);
          setScriptsOpen((v) => !v);
        }}
        historyOpen={historyOpen}
        settingsOpen={settingsOpen}
        scriptsOpen={scriptsOpen}
      />

      <AnimatePresence>
        {historyOpen && (
          <ChatHistoryPanel
            onClose={() => setHistoryOpen(false)}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={(id) => void loadSession(id)}
            onDelete={deleteSession}
          />
        )}
      </AnimatePresence>

      <WebMcpTools />
      <AgentStatusBar />

      {/* Automation script toast — pinned just below the header */}
      <AnimatePresence>
        {automationScriptsEnabled && generatedScriptData && (
          <ScriptPopupModal
            scriptData={generatedScriptData}
            onClose={onCloseScript}
          />
        )}
      </AnimatePresence>

      <Chat />

      <AnimatePresence>
        {settingsOpen && (
          <ChatSettingsPanel
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scriptsOpen && (
          <SavedScriptsPanel
            onClose={() => setScriptsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

import { ScriptPopupModal } from "./components/ScriptPopupModal";
import { AnimatePresence } from "framer-motion";
import { ScreenPet } from "@common/components/ScreenPet";

const SidebarContent: React.FC = () => {
  useDarkMode("slave");
  const [consentRequest, setConsentRequest] =
    useState<WebMcpConsentRequest | null>(null);
  const [generatedScriptData, setGeneratedScriptData] = useState<{
    python: string;
    typescript: string;
    actions: any[];
  } | null>(null);

  useEffect(() => {
    window.sidebarAPI.onWebMcpConsentRequest((request) => {
      setConsentRequest(request);
    });

    window.sidebarAPI.onScriptGenerated((data) => {
      setGeneratedScriptData(data);
    });

    return () => {
      window.sidebarAPI.removeWebMcpConsentListener();
      window.sidebarAPI.removeScriptGeneratedListener();
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
        <ChatShell
          generatedScriptData={generatedScriptData}
          onCloseScript={() => setGeneratedScriptData(null)}
        />
      </div>
      <AnimatePresence>
        {consentRequest && (
          <WebMcpConsentModal
            request={consentRequest}
            onClose={() => setConsentRequest(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export const SidebarApp: React.FC = () => {
  const isPetOverlay = window.location.search.includes("mode=pet-overlay");

  useEffect(() => {
    if (isPetOverlay) {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    }
  }, [isPetOverlay]);

  if (isPetOverlay) {
    return (
      <AgentActivityProvider>
        <div className="w-full h-full bg-transparent overflow-hidden select-none">
          <ScreenPet />
        </div>
      </AgentActivityProvider>
    );
  }

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
