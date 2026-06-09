import type { CoreMessage } from "ai";
import type { LlmProvider } from "../../shared/llm-config";

const BERRY_PROMPT_CACHE_KEY = "berry-browser-static-v2";

type StreamProviderOptions = {
  openai?: { promptCacheKey?: string };
  anthropic?: { cacheControl?: { type: "ephemeral" } };
};

export interface PromptCacheResult {
  messages: CoreMessage[];
  providerOptions?: StreamProviderOptions;
}

export function applyPromptCache(
  messages: CoreMessage[],
  provider: LlmProvider,
  enabled: boolean,
): PromptCacheResult {
  if (!enabled || messages.length === 0) {
    return { messages };
  }

  switch (provider) {
    case "anthropic":
      return {
        messages: applyAnthropicCacheControl(messages),
      };
    case "openai":
      return {
        messages,
        providerOptions: {
          openai: {
            promptCacheKey: BERRY_PROMPT_CACHE_KEY,
          },
        },
      };
    case "deepseek":
    case "gemini":
      // Stable static prefix is enough for implicit / KV caching on these providers.
      return { messages };
    default:
      return { messages };
  }
}

function applyAnthropicCacheControl(messages: CoreMessage[]): CoreMessage[] {
  return messages.map((message, index) => {
    if (index !== 0 || message.role !== "system") {
      return message;
    }

    return {
      ...message,
      providerOptions: {
        anthropic: {
          cacheControl: { type: "ephemeral" },
        },
      },
    };
  });
}

export function logPromptCacheUsage(
  provider: LlmProvider,
  usage:
    | {
        inputTokens?: number;
        cachedInputTokens?: number;
      }
    | undefined,
  providerMetadata: Record<string, Record<string, unknown>> | undefined,
): void {
  if (!usage && !providerMetadata) return;

  const cached =
    usage?.cachedInputTokens ??
    (providerMetadata?.anthropic?.cacheReadInputTokens as number | undefined) ??
    (providerMetadata?.openai?.cachedInputTokens as number | undefined) ??
    (providerMetadata?.deepseek?.promptCacheHitTokens as number | undefined);

  if (typeof cached === "number" && cached > 0) {
    console.log(`[Berry LLM cache] ${provider}: ${cached} cached input tokens`);
  }
}
