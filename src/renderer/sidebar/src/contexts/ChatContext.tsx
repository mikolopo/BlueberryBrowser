import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useWebMcp } from "./WebMcpContext";
import { useChatSettings } from "./ChatSettingsContext";
import {
  loadChatHistory,
  saveChatHistory,
  loadActiveSessionId,
  saveActiveSessionId,
  deriveSessionTitle,
  createSessionId,
  type ChatSession,
  type StoredMessage,
} from "../lib/chatHistoryStorage";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  sessionTitle: string;
  sendMessage: (content: string) => Promise<void>;
  stopAgent: () => Promise<void>;
  startNewChat: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => void;
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

function stableId(role: string, content: string, index: number): string {
  // Use a hash of role + first 80 chars of content for stability across re-renders.
  // Fall back to index only for truly empty messages.
  const sample = content.slice(0, 80).replace(/\s+/g, " ").trim();
  if (!sample) return `msg-${index}`;
  let h = 0;
  for (let i = 0; i < sample.length; i++) {
    h = Math.imul(31, h) + sample.charCodeAt(i);
  }
  return `${role}-${(h >>> 0).toString(36)}`;
}

function coreToMessages(raw: unknown[], markStreaming = false): Message[] {
  return raw
    .filter((msg) => msg != null && typeof msg === "object")
    .map((msg, index) => {
      const m = msg as { role: "user" | "assistant"; content: unknown };
      const role = m.role;
      const content =
        typeof m.content === "string"
          ? m.content
          : (m.content as { type: string; text?: string }[])?.find(
              (p) => p.type === "text",
            )?.text || "";
      const isStreamingMsg =
        markStreaming && index === raw.length - 1 && role === "assistant";
      return {
        // While streaming keep a fixed key so React doesn't remount on each token.
        id: isStreamingMsg ? "streaming-assistant" : stableId(role, content, index),
        role,
        content,
        timestamp: Date.now(),
        isStreaming: isStreamingMsg,
      };
    });
}

function messagesToCore(
  messages: Message[],
): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function toStored(messages: Message[]): StoredMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }));
}

function fromStored(messages: StoredMessage[]): Message[] {
  return messages.map((m) => ({ ...m, isStreaming: false }));
}

function upsertSessionInHistory(
  sessions: ChatSession[],
  sessionId: string,
  stored: StoredMessage[],
): ChatSession[] {
  const now = Date.now();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  const base = {
    id: sessionId,
    title: deriveSessionTitle(stored),
    messages: stored,
    updatedAt: now,
  };

  if (idx >= 0) {
    const next = [...sessions];
    next[idx] = { ...next[idx], ...base };
    return next;
  }

  return [{ ...base, createdAt: now }, ...sessions];
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingSessionIds, setLoadingSessionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [sessions, setSessions] = useState<ChatSession[]>(() =>
    loadChatHistory(),
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() =>
    loadActiveSessionId(),
  );

  const { snapshot } = useWebMcp();
  const { webMcpEnabled } = useChatSettings();

  const activeSessionIdRef = useRef(activeSessionId);
  const streamingSessionIdRef = useRef<string | null>(null);
  const loadingSessionIdsRef = useRef(loadingSessionIds);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    loadingSessionIdsRef.current = loadingSessionIds;
  }, [loadingSessionIds]);

  const isLoading = useMemo(
    () => activeSessionId != null && loadingSessionIds.has(activeSessionId),
    [activeSessionId, loadingSessionIds],
  );

  const markSessionLoading = useCallback((sessionId: string) => {
    setLoadingSessionIds((prev) => new Set(prev).add(sessionId));
  }, []);

  const clearSessionLoading = useCallback((sessionId: string) => {
    setLoadingSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const persistSessionImmediate = useCallback(
    (sessionId: string, nextMessages: Message[]) => {
      if (nextMessages.length === 0) return;
      const stored = toStored(nextMessages);
      setSessions((prev) => {
        const next = upsertSessionInHistory(prev, sessionId, stored);
        saveChatHistory(next);
        return next;
      });
    },
    [],
  );

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistRef = useRef<{
    sessionId: string;
    messages: Message[];
  } | null>(null);

  const flushPersistSession = useCallback(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const pending = pendingPersistRef.current;
    pendingPersistRef.current = null;
    if (pending) {
      persistSessionImmediate(pending.sessionId, pending.messages);
    }
  }, [persistSessionImmediate]);

  const persistSession = useCallback(
    (sessionId: string, nextMessages: Message[], immediate = false) => {
      if (nextMessages.length === 0) return;

      if (immediate) {
        flushPersistSession();
        persistSessionImmediate(sessionId, nextMessages);
        return;
      }

      pendingPersistRef.current = { sessionId, messages: nextMessages };
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        const pending = pendingPersistRef.current;
        pendingPersistRef.current = null;
        if (pending) {
          persistSessionImmediate(pending.sessionId, pending.messages);
        }
      }, 500);
    },
    [persistSessionImmediate, flushPersistSession],
  );

  const syncMessagesToMain = useCallback(async (nextMessages: Message[]) => {
    await window.sidebarAPI.setMessages(messagesToCore(nextMessages));
  }, []);

  const finalizeBackgroundStream = useCallback(async () => {
    const streamingId = streamingSessionIdRef.current;
    if (!streamingId || !loadingSessionIdsRef.current.has(streamingId)) {
      return;
    }

    try {
      const fromMain = await window.sidebarAPI.getMessages();
      persistSession(streamingId, coreToMessages(fromMain));
    } catch {
      /* optional */
    }

    clearSessionLoading(streamingId);
    streamingSessionIdRef.current = null;
  }, [persistSession, clearSessionLoading]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedSessions = loadChatHistory();
        setSessions(storedSessions);

        const activeId = loadActiveSessionId();
        if (activeId) {
          const session = storedSessions.find((s) => s.id === activeId);
          if (session?.messages.length) {
            const restored = fromStored(session.messages);
            setMessages(restored);
            await syncMessagesToMain(restored);
            return;
          }
        }

        const fromMain = await window.sidebarAPI.getMessages();
        if (fromMain && fromMain.length > 0) {
          setMessages(coreToMessages(fromMain));
        }
      } catch (error) {
        console.error("Failed to load chat:", error);
      }
    };
    void bootstrap();
  }, [syncMessagesToMain]);

  const stopAgent = useCallback(async () => {
    try {
      await window.sidebarAPI.stopAgent();
    } catch (error) {
      console.error("Failed to stop agent:", error);
    }

    const sid = streamingSessionIdRef.current ?? activeSessionIdRef.current;
    if (sid) {
      clearSessionLoading(sid);
    }
    streamingSessionIdRef.current = null;
  }, [clearSessionLoading]);

  const sendMessage = useCallback(
    async (content: string) => {
      let sessionId = activeSessionIdRef.current;
      if (!sessionId) {
        sessionId = createSessionId();
        setActiveSessionId(sessionId);
        saveActiveSessionId(sessionId);
        activeSessionIdRef.current = sessionId;
      }

      const streamingId = streamingSessionIdRef.current;
      if (
        streamingId &&
        streamingId !== sessionId &&
        loadingSessionIdsRef.current.has(streamingId)
      ) {
        await finalizeBackgroundStream();
        await syncMessagesToMain(messages);
      }

      if (loadingSessionIdsRef.current.has(sessionId)) {
        await stopAgent();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      streamingSessionIdRef.current = sessionId;
      markSessionLoading(sessionId);

      // Instantly append user's message to local state
      const userMsg: Message = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "user",
        content,
        timestamp: Date.now(),
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      try {
        // Do NOT call syncMessagesToMain here — main already holds the correct
        // history from the previous turn's broadcast. Calling setMessages with a
        // stale renderer snapshot would wipe main's up-to-date history and cause
        // duplicates or missing messages when the stream pushes updates back.

        const messageId = Date.now().toString();
        await window.sidebarAPI.sendChatMessage({
          message: content,
          messageId,
          webMcpEnabled: webMcpEnabled,
          webMcpGlobalEnabled: webMcpEnabled,
        });
      } catch (error) {
        console.error("Failed to send message:", error);
        clearSessionLoading(sessionId);
        if (streamingSessionIdRef.current === sessionId) {
          streamingSessionIdRef.current = null;
        }
      }
    },
    [
      messages,
      webMcpEnabled,
      snapshot?.tools.length,
      markSessionLoading,
      clearSessionLoading,
      finalizeBackgroundStream,
      syncMessagesToMain,
      stopAgent,
    ],
  );

  const startNewChat = useCallback(async () => {
    if (messages.length > 0 && activeSessionIdRef.current) {
      persistSession(activeSessionIdRef.current, messages, true);
    }

    await finalizeBackgroundStream();
    await window.sidebarAPI.clearChat();
    setMessages([]);
    setActiveSessionId(null);
    saveActiveSessionId(null);
    activeSessionIdRef.current = null;
  }, [messages, persistSession, finalizeBackgroundStream]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === activeSessionIdRef.current) return;

      const currentId = activeSessionIdRef.current;
      if (messages.length > 0 && currentId) {
        persistSession(currentId, messages, true);
      }

      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      setActiveSessionId(sessionId);
      saveActiveSessionId(sessionId);
      activeSessionIdRef.current = sessionId;

      const streamingId = streamingSessionIdRef.current;
      const streamActive =
        streamingId != null && loadingSessionIdsRef.current.has(streamingId);

      if (streamActive && sessionId === streamingId) {
        const fromMain = await window.sidebarAPI.getMessages();
        const converted = coreToMessages(fromMain, true);
        setMessages(converted);
        persistSession(sessionId, converted);
        return;
      }

      const restored = fromStored(session.messages);
      setMessages(restored);

      // Always sync main-process agent context to the session being viewed,
      // even when another session is still streaming in the background.
      await syncMessagesToMain(restored);
    },
    [messages, sessions, persistSession, syncMessagesToMain],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      const next = sessions.filter((s) => s.id !== sessionId);
      setSessions(next);
      saveChatHistory(next);

      if (streamingSessionIdRef.current === sessionId) {
        clearSessionLoading(sessionId);
        streamingSessionIdRef.current = null;
      }

      if (activeSessionIdRef.current === sessionId) {
        void startNewChat();
      }
    },
    [sessions, startNewChat, clearSessionLoading],
  );

  const getPageContent = useCallback(async () => {
    try {
      return await window.sidebarAPI.getPageContent();
    } catch {
      return null;
    }
  }, []);

  const getPageText = useCallback(async () => {
    try {
      return await window.sidebarAPI.getPageText();
    } catch {
      return null;
    }
  }, []);

  const getCurrentUrl = useCallback(async () => {
    try {
      return await window.sidebarAPI.getCurrentUrl();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const handleChatResponse = (data: {
      messageId: string;
      content: string;
      isComplete: boolean;
    }) => {
      if (!data.isComplete) return;

      const sid = streamingSessionIdRef.current;
      if (!sid) return;

      flushPersistSession();

      clearSessionLoading(sid);
      streamingSessionIdRef.current = null;

      if (sid === activeSessionIdRef.current) {
        setMessages((prev) => {
          const next = prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant"
              ? { ...m, isStreaming: false }
              : m,
          );
          persistSession(sid, next, true);
          return next;
        });
      }
    };

    const handleMessagesUpdated = (updatedMessages: unknown[]) => {
      const targetId = streamingSessionIdRef.current;
      if (!targetId) return;

      const stillLoading = loadingSessionIdsRef.current.has(targetId);

      if (targetId === activeSessionIdRef.current) {
        setMessages((prev) => {
          // Build a stable-ID lookup from existing messages (keyed by role+content).
          // This ensures React doesn't remount messages when they get re-hashed on
          // every streaming token update.
          const idMap = new Map<string, string>();
          for (const m of prev) {
            if (!m.isStreaming) {
              idMap.set(`${m.role}::${m.content}`, m.id);
            }
          }

          // Filter out undefined/null messages before processing
          const validMessages = updatedMessages.filter(
            (msg) => msg != null && typeof msg === "object"
          );

          const converted: Message[] = validMessages.map((msg, index) => {
            const role = (msg as any).role as "user" | "assistant";
            const content =
              typeof (msg as any).content === "string"
                ? (msg as any).content
                : ((msg as any).content as { type: string; text?: string }[])?.find(
                    (p) => p.type === "text",
                  )?.text || "";
            const isStreamingMsg =
              stillLoading && index === validMessages.length - 1 && role === "assistant";
            const mapKey = `${role}::${content}`;
            const existingId = idMap.get(mapKey);
            return {
              id: isStreamingMsg
                ? "streaming-assistant"
                : (existingId ?? stableId(role, content, index)),
              role,
              content,
              timestamp: Date.now(),
              isStreaming: isStreamingMsg,
            };
          });

          persistSession(targetId, converted);
          return converted;
        });
      } else {
        const converted = coreToMessages(updatedMessages, stillLoading);
        persistSession(targetId, converted);
      }
    };

    window.sidebarAPI.onChatResponse(handleChatResponse);
    window.sidebarAPI.onMessagesUpdated(handleMessagesUpdated);

    return () => {
      flushPersistSession();
      window.sidebarAPI.removeChatResponseListener();
      window.sidebarAPI.removeMessagesUpdatedListener();
    };
  }, [persistSession, clearSessionLoading, flushPersistSession]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const sessionTitle =
    activeSession?.title ||
    (messages.length > 0 ? deriveSessionTitle(toStored(messages)) : "New chat");

  const value: ChatContextType = {
    messages,
    isLoading,
    sessions,
    activeSessionId,
    sessionTitle,
    sendMessage,
    stopAgent,
    startNewChat,
    loadSession,
    deleteSession,
    getPageContent,
    getPageText,
    getCurrentUrl,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
