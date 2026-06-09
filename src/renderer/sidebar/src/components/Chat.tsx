import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { ArrowUp, Square } from "lucide-react";
import { useChat } from "../contexts/ChatContext";
import { cn } from "@common/lib/utils";
import { isSafeExternalUrl } from "@common/lib/safeUrl";
import { TypingIndicator } from "./TypingIndicator";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

const useChatScroll = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  messages: Message[],
  isLoading: boolean,
) => {
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [containerRef]);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);
};

const UserMessage: React.FC<{ content: string; index: number }> = ({
  content,
  index,
}) => (
  <div
    className="relative max-w-[85%] ml-auto animate-message-in"
    style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
  >
    <div className="bg-muted dark:bg-muted/50 rounded-3xl px-6 py-4 shadow-subtle">
      <div className="text-foreground" style={{ whiteSpace: "pre-wrap" }}>
        {content}
      </div>
    </div>
  </div>
);

const StreamingContent: React.FC<{ content: string }> = ({ content }) => (
  <div className="whitespace-pre-wrap text-foreground">
    {content}
    <span className="inline-block w-0.5 h-[1.1em] bg-primary/70 ml-0.5 align-text-bottom animate-cursor-blink" />
  </div>
);

const Markdown: React.FC<{ content: string }> = ({ content }) => (
  <div
    className="prose prose-sm dark:prose-invert max-w-none 
                    prose-headings:text-foreground prose-p:text-foreground 
                    prose-strong:text-foreground prose-ul:text-foreground 
                    prose-ol:text-foreground prose-li:text-foreground
                    prose-a:text-primary hover:prose-a:underline
                    prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 
                    prose-code:rounded prose-code:text-sm prose-code:text-foreground
                    prose-pre:bg-muted dark:prose-pre:bg-muted/50 prose-pre:p-3 
                    prose-pre:rounded-lg prose-pre:overflow-x-auto"
  >
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        code: ({ className, children, ...props }) => {
          const inline = !className;
          return inline ? (
            <code
              className="bg-muted dark:bg-muted/50 px-1 py-0.5 rounded text-sm text-foreground"
              {...props}
            >
              {children}
            </code>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        a: ({ children, href }) =>
          isSafeExternalUrl(href) ? (
            <a
              href={href}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ) : (
            <span className="text-muted-foreground">{children}</span>
          ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

const AssistantMessage: React.FC<{
  content: string;
  isStreaming?: boolean;
  index: number;
}> = ({ content, isStreaming, index }) => (
  <div
    className="relative w-full animate-message-in"
    style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
  >
    <div className="py-1">
      {isStreaming && content.length === 0 ? (
        <TypingIndicator />
      ) : isStreaming ? (
        <StreamingContent content={content} />
      ) : (
        <Markdown content={content} />
      )}
    </div>
  </div>
);

const ChatInput: React.FC<{
  onSend: (message: string) => void;
  onStop: () => void;
  isAgentRunning: boolean;
}> = ({ onSend, onStop, isAgentRunning }) => {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSend(value.trim());
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        "w-full border p-3 rounded-3xl bg-background dark:bg-secondary",
        "shadow-chat animate-spring-scale outline-none transition-all duration-200",
        isFocused
          ? "border-primary/20 dark:border-primary/30"
          : "border-border",
        isAgentRunning && "border-primary/30 ring-1 ring-primary/15",
      )}
    >
      {isAgentRunning && (
        <div className="flex items-center justify-between px-3 pb-2 pt-0.5">
          <span className="text-xs font-medium text-primary animate-pulse-soft">
            Berry is working…
          </span>
          <button
            type="button"
            onClick={onStop}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
              "text-xs font-semibold bg-destructive text-destructive-foreground",
              "hover:brightness-95 active:brightness-90 transition-all",
            )}
            aria-label="Stop Berry"
          >
            <Square className="size-3 fill-current" />
            Stop
          </button>
        </div>
      )}

      <div className="w-full px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={
            isAgentRunning
              ? "Send a new message (interrupts Berry)…"
              : "Send a message…"
          }
          className="w-full resize-none outline-none bg-transparent 
                             text-foreground placeholder:text-muted-foreground
                             min-h-[24px] max-h-[200px]"
          rows={1}
          style={{ lineHeight: "24px" }}
        />
      </div>

      <div className="w-full flex items-center gap-1.5 px-1 mt-2 mb-1">
        <div className="flex-1" />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className={cn(
            "size-9 rounded-full flex items-center justify-center",
            "transition-all duration-200",
            "bg-primary text-primary-foreground",
            "hover:opacity-80 disabled:opacity-50",
          )}
          aria-label="Send message"
        >
          <ArrowUp className="size-5" />
        </button>
      </div>
    </div>
  );
};

export const Chat: React.FC = () => {
  const { messages, isLoading, sendMessage, stopAgent } = useChat();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useChatScroll(scrollContainerRef, messages, isLoading);

  const showLoadingIndicator =
    isLoading && messages[messages.length - 1]?.role === "user";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
      >
        <div className="px-4 pb-2">
          {messages.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center py-8">
              <div className="mx-auto flex max-w-md flex-col gap-3 text-center animate-fade-in">
                <div className="mx-auto size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="size-3 rounded-full bg-primary animate-pulse-soft" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  Blueberry Assistant
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ask about the page, navigation, or WebMCP actions. Enable
                  WebMCP in settings (sliders icon) and open /demo/index.html.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-2">
              {messages.map((msg, index) =>
                msg.role === "user" ? (
                  <UserMessage
                    key={msg.id}
                    content={msg.content}
                    index={index}
                  />
                ) : (
                  <AssistantMessage
                    key={msg.id}
                    content={msg.content}
                    isStreaming={msg.isStreaming}
                    index={index}
                  />
                ),
              )}
              {showLoadingIndicator && <TypingIndicator />}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <ChatInput
          onSend={sendMessage}
          onStop={() => void stopAgent()}
          isAgentRunning={isLoading}
        />
      </div>
    </div>
  );
};
