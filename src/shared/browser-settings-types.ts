import {
  getDefaultModelForProvider,
  isLlmProvider,
  type LlmProvider,
} from "./llm-config";

export interface BrowserSettings {
  forcePageDarkMode: boolean;
  llmProvider: LlmProvider;
  llmModel: string;
  promptCacheEnabled: boolean;
}

export const DEFAULT_BROWSER_SETTINGS: BrowserSettings = {
  forcePageDarkMode: false,
  llmProvider: "openai",
  llmModel: getDefaultModelForProvider("openai"),
  promptCacheEnabled: true,
};

export function normalizeBrowserSettings(
  partial: Partial<BrowserSettings> | null | undefined,
): BrowserSettings {
  const llmProvider = isLlmProvider(partial?.llmProvider)
    ? partial.llmProvider
    : DEFAULT_BROWSER_SETTINGS.llmProvider;

  const llmModel =
    typeof partial?.llmModel === "string" && partial.llmModel.trim()
      ? partial.llmModel.trim()
      : getDefaultModelForProvider(llmProvider);

  return {
    forcePageDarkMode:
      typeof partial?.forcePageDarkMode === "boolean"
        ? partial.forcePageDarkMode
        : DEFAULT_BROWSER_SETTINGS.forcePageDarkMode,
    llmProvider,
    llmModel,
    promptCacheEnabled:
      typeof partial?.promptCacheEnabled === "boolean"
        ? partial.promptCacheEnabled
        : DEFAULT_BROWSER_SETTINGS.promptCacheEnabled,
  };
}
