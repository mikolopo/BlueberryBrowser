export type LlmProvider = "openai" | "anthropic" | "deepseek" | "gemini";

export interface LlmProviderConfig {
  id: LlmProvider;
  label: string;
  envKey: string;
  defaultModel: string;
  models: string[];
  supportsPromptCache: boolean;
  cacheHint: string;
}

export const LLM_PROVIDER_CONFIGS: Record<LlmProvider, LlmProviderConfig> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    models: [
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-4.1-mini",
      "gpt-4.1",
      "o3-mini",
      "o4-mini",
    ],
    supportsPromptCache: true,
    cacheHint:
      "Stable system prompt + tools are cached via prompt_cache_key (automatic prefix caching on supported models).",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-6",
    models: [
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-opus-4-7",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
    ],
    supportsPromptCache: true,
    cacheHint:
      "Ephemeral cache_control on the static system prompt reduces input token cost on repeat turns.",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    supportsPromptCache: true,
    cacheHint:
      "KV disk cache hits automatically when the prompt prefix (system + tools) stays identical.",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
    ],
    supportsPromptCache: true,
    cacheHint:
      "Gemini 2.5+ applies implicit prefix caching when the static system block is unchanged.",
  },
};

export const LLM_PROVIDER_LIST = Object.values(LLM_PROVIDER_CONFIGS);

export function isLlmProvider(value: unknown): value is LlmProvider {
  return (
    value === "openai" ||
    value === "anthropic" ||
    value === "deepseek" ||
    value === "gemini"
  );
}

export function getLlmProviderConfig(provider: LlmProvider): LlmProviderConfig {
  return LLM_PROVIDER_CONFIGS[provider];
}

export function getDefaultModelForProvider(provider: LlmProvider): string {
  return LLM_PROVIDER_CONFIGS[provider].defaultModel;
}
