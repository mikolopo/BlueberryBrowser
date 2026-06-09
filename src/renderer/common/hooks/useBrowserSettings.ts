import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEFAULT_BROWSER_SETTINGS,
  normalizeBrowserSettings,
  type BrowserSettings,
} from "@shared/browser-settings-types";
import { getDefaultModelForProvider } from "@shared/llm-config";

const STORAGE_KEY = "berry-browser-settings";
const LEGACY_DARK_MODE_KEY = "berry-force-page-dark-mode";

function readStoredSettings(): BrowserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeBrowserSettings(
        JSON.parse(raw) as Partial<BrowserSettings>,
      );
    }
  } catch {
    /* ignore */
  }

  try {
    const legacyDark = localStorage.getItem(LEGACY_DARK_MODE_KEY);
    if (legacyDark !== null) {
      return normalizeBrowserSettings({
        ...DEFAULT_BROWSER_SETTINGS,
        forcePageDarkMode: legacyDark === "true",
      });
    }
  } catch {
    /* ignore */
  }

  return { ...DEFAULT_BROWSER_SETTINGS };
}

function persistSettings(settings: BrowserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

interface BrowserSettingsContextType {
  settings: BrowserSettings;
  forcePageDarkMode: boolean;
  setForcePageDarkMode: (enabled: boolean) => void;
  llmProvider: BrowserSettings["llmProvider"];
  llmModel: string;
  promptCacheEnabled: boolean;
  setLlmProvider: (provider: BrowserSettings["llmProvider"]) => void;
  setLlmModel: (model: string) => void;
  setPromptCacheEnabled: (enabled: boolean) => void;
}

const BrowserSettingsContext = createContext<BrowserSettingsContextType | null>(
  null,
);

export const useBrowserSettings = (): BrowserSettingsContextType => {
  const ctx = useContext(BrowserSettingsContext);
  if (!ctx) {
    throw new Error(
      "useBrowserSettings must be used within BrowserSettingsProvider",
    );
  }
  return ctx;
};

export const BrowserSettingsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [settings, setSettingsState] = useState(readStoredSettings);

  const syncToMain = useCallback((next: BrowserSettings) => {
    window.electron?.ipcRenderer.send("browser-settings-changed", next);
  }, []);

  useEffect(() => {
    syncToMain(readStoredSettings());
  }, [syncToMain]);

  const updateSettings = useCallback(
    (patch: Partial<BrowserSettings>) => {
      setSettingsState((prev) => {
        const next = normalizeBrowserSettings({ ...prev, ...patch });
        persistSettings(next);
        syncToMain(next);
        return next;
      });
    },
    [syncToMain],
  );

  const setForcePageDarkMode = useCallback(
    (enabled: boolean) => updateSettings({ forcePageDarkMode: enabled }),
    [updateSettings],
  );

  const setLlmProvider = useCallback(
    (provider: BrowserSettings["llmProvider"]) => {
      updateSettings({
        llmProvider: provider,
        llmModel: getDefaultModelForProvider(provider),
      });
    },
    [updateSettings],
  );

  const setLlmModel = useCallback(
    (model: string) => updateSettings({ llmModel: model }),
    [updateSettings],
  );

  const setPromptCacheEnabled = useCallback(
    (enabled: boolean) => updateSettings({ promptCacheEnabled: enabled }),
    [updateSettings],
  );

  return React.createElement(
    BrowserSettingsContext.Provider,
    {
      value: {
        settings,
        forcePageDarkMode: settings.forcePageDarkMode,
        setForcePageDarkMode,
        llmProvider: settings.llmProvider,
        llmModel: settings.llmModel,
        promptCacheEnabled: settings.promptCacheEnabled,
        setLlmProvider,
        setLlmModel,
        setPromptCacheEnabled,
      },
    },
    children,
  );
};
