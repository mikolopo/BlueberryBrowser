export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
}

const HISTORY_KEY = "berry-chat-history";
const ACTIVE_SESSION_KEY = "berry-active-chat-id";
const MAX_SESSIONS = 40;
const MAX_MESSAGES_PER_SESSION = 120;
const MAX_MESSAGE_CHARS = 12_000;

export function trimSessionsForStorage(sessions: ChatSession[]): ChatSession[] {
  return sessions.slice(0, MAX_SESSIONS).map((session) => ({
    ...session,
    messages: session.messages
      .slice(-MAX_MESSAGES_PER_SESSION)
      .map((message) => ({
        ...message,
        content:
          message.content.length > MAX_MESSAGE_CHARS
            ? `${message.content.slice(0, MAX_MESSAGE_CHARS)}…`
            : message.content,
      })),
  }));
}

export function loadChatHistory(): ChatSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    if (!Array.isArray(parsed)) return [];
    return trimSessionsForStorage(parsed);
  } catch {
    return [];
  }
}

export function saveChatHistory(sessions: ChatSession[]): void {
  let trimmed = trimSessionsForStorage(sessions);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
      return;
    } catch (error) {
      const isQuota =
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" || error.code === 22);
      if (!isQuota || trimmed.length === 0) {
        console.warn("[chat history] save failed:", error);
        return;
      }
      // Drop oldest sessions until write succeeds.
      trimmed = trimmed.slice(0, Math.max(1, Math.floor(trimmed.length / 2)));
    }
  }
}

export function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveActiveSessionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_SESSION_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function deriveSessionTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser?.content.trim()) return "New chat";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

export function createSessionId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
