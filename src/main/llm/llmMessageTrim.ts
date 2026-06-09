import type { CoreMessage } from "ai";

const AGENT_STEP_PAGE_TEXT_MAX = 1800;

/** Shrink repeated page context on later agent steps to save TPM. */
export function trimMessagesForAgentStep(
  messages: CoreMessage[],
): CoreMessage[] {
  return messages.map((message) => {
    if (message.role !== "user") return message;

    if (typeof message.content === "string") {
      return {
        ...message,
        content: trimContextBlock(message.content, AGENT_STEP_PAGE_TEXT_MAX),
      };
    }

    if (!Array.isArray(message.content)) return message;

    return {
      ...message,
      content: message.content.map((part) => {
        if (part.type === "text" && typeof part.text === "string") {
          return {
            ...part,
            text: trimContextBlock(part.text, AGENT_STEP_PAGE_TEXT_MAX),
          };
        }
        // Drop screenshots on follow-up agent steps — they burn TPM fast.
        if (part.type === "image") {
          return {
            type: "text" as const,
            text: "<screenshot_omitted_on_agent_step/>",
          };
        }
        return part;
      }),
    };
  });
}

const trimContextBlock = (text: string, maxPageText: number): string => {
  if (!text.includes("<active_webpage_text>")) return text;

  return text.replace(
    /<active_webpage_text>([\s\S]*?)<\/active_webpage_text>/,
    (_match, body: string) => {
      const trimmed = body.trim();
      if (trimmed.length <= maxPageText) {
        return `<active_webpage_text>${trimmed}</active_webpage_text>`;
      }
      return `<active_webpage_text>${trimmed.slice(0, maxPageText)}…</active_webpage_text>`;
    },
  );
};
