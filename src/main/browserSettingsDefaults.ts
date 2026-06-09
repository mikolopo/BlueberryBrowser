import {
  DEFAULT_BROWSER_SETTINGS,
  normalizeBrowserSettings,
  type BrowserSettings,
} from "../shared/browser-settings-types";
import { isLlmProvider } from "../shared/llm-config";

/** Main-process defaults: UI settings with optional .env overrides on first launch. */
export function getEnvDefaultBrowserSettings(): BrowserSettings {
  const envProvider = process.env.LLM_PROVIDER?.toLowerCase();
  const envModel = process.env.LLM_MODEL?.trim();

  return normalizeBrowserSettings({
    ...DEFAULT_BROWSER_SETTINGS,
    llmProvider: isLlmProvider(envProvider) ? envProvider : undefined,
    llmModel: envModel || undefined,
  });
}
