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
      "chatgpt-4o-latest",
      "gpt-4o-2024-11-20",
      "gpt-4.1-mini",
      "gpt-4.1",
      "o3-mini",
      "o3-mini-2025-01-31",
      "o4-mini",
      "o1",
      "o1-2024-12-17",
      "o1-mini",
      "o1-preview",
      "gpt-4",
      "gpt-4-turbo",
      "gpt-3.5-turbo"
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
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-opus-4-7",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307"
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
    models: [
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-coder"
    ],
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
      "gemini-2.0-flash-lite-preview-02-05",
      "gemini-2.0-pro-exp-02-05",
      "gemini-2.0-flash-thinking-exp-01-21",
      "gemini-2.0-flash-thinking-exp-1219",
      "gemini-2.0-flash-exp",
      "gemini-1.5-pro-latest",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro",
      "gemini-1.5-flash"
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
