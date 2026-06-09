import React, { createContext, useCallback, useContext, useState } from "react";

const WEBMCP_STORAGE_KEY = "berry-chat-webmcp-enabled";
const LEGACY_WEBMCP_KEY = "webMcpToolsEnabled";

function readWebMcpEnabled(): boolean {
  try {
    const current = localStorage.getItem(WEBMCP_STORAGE_KEY);
    if (current != null) return current === "true";
    const legacy = localStorage.getItem(LEGACY_WEBMCP_KEY);
    if (legacy != null) {
      localStorage.setItem(WEBMCP_STORAGE_KEY, legacy);
      return legacy === "true";
    }
  } catch {
    /* ignore */
  }
  return false;
}

interface ChatSettingsContextType {
  webMcpEnabled: boolean;
  setWebMcpEnabled: (enabled: boolean) => void;
}

const ChatSettingsContext = createContext<ChatSettingsContextType | null>(null);

export const useChatSettings = (): ChatSettingsContextType => {
  const ctx = useContext(ChatSettingsContext);
  if (!ctx) {
    throw new Error("useChatSettings must be used within ChatSettingsProvider");
  }
  return ctx;
};

export const ChatSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [webMcpEnabled, setWebMcpEnabledState] = useState(readWebMcpEnabled);

  const setWebMcpEnabled = useCallback((enabled: boolean) => {
    setWebMcpEnabledState(enabled);
    try {
      localStorage.setItem(WEBMCP_STORAGE_KEY, String(enabled));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <ChatSettingsContext.Provider value={{ webMcpEnabled, setWebMcpEnabled }}>
      {children}
    </ChatSettingsContext.Provider>
  );
};
