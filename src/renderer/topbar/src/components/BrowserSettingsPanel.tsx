import React, { useEffect, useRef } from "react";
import { cn } from "@common/lib/utils";
import { Settings } from "lucide-react";
import { useBrowserSettings } from "@common/hooks/useBrowserSettings";
import { LLM_PROVIDER_LIST, getLlmProviderConfig } from "@shared/llm-config";

interface BrowserSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled }) => (
  <label
    className={cn(
      "flex items-start justify-between gap-3",
      disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
    )}
  >
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium text-foreground">{label}</div>
      {description ? (
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-muted",
        disabled && "pointer-events-none",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked && "translate-x-5",
        )}
      />
    </button>
  </label>
);

export const BrowserSettingsPanel: React.FC<BrowserSettingsPanelProps> = ({
  open,
  onClose,
  triggerRef,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    forcePageDarkMode,
    setForcePageDarkMode,
    llmProvider,
    llmModel,
    promptCacheEnabled,
    setLlmProvider,
    setLlmModel,
    setPromptCacheEnabled,
  } = useBrowserSettings();

  const providerConfig = getLlmProviderConfig(llmProvider);
  const modelOptions = providerConfig.models;
  const modelInList = modelOptions.includes(llmModel);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <>
      <div
        className="absolute inset-0 z-40 bg-black/15 animate-panel-fade app-region-no-drag"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={cn(
          "absolute top-2 right-3 z-50 w-[min(calc(100%-1.5rem),22rem)]",
          "rounded-xl border border-border bg-popover shadow-expanded",
          "animate-slide-in-right app-region-no-drag max-h-[calc(100%-1rem)] overflow-y-auto",
        )}
        role="dialog"
        aria-label="Browser settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Settings className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Browser settings
          </h2>
        </div>

        <div className="p-3 space-y-5">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI provider
            </h3>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Provider
              </span>
              <select
                value={llmProvider}
                onChange={(e) =>
                  setLlmProvider(e.target.value as typeof llmProvider)
                }
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
              >
                {LLM_PROVIDER_LIST.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                API key:{" "}
                <code className="text-[10px]">{providerConfig.envKey}</code> in{" "}
                <code className="text-[10px]">.env</code>
              </p>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Model</span>
              <select
                value={modelInList ? llmModel : "__custom__"}
                onChange={(e) => {
                  if (e.target.value !== "__custom__") {
                    setLlmModel(e.target.value);
                  }
                }}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
              >
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                <option value="__custom__">Custom model ID…</option>
              </select>
              <input
                type="text"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder={providerConfig.defaultModel}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
              />
            </label>

            <Toggle
              checked={promptCacheEnabled}
              onChange={setPromptCacheEnabled}
              disabled={!providerConfig.supportsPromptCache}
              label="Prompt caching"
              description={providerConfig.cacheHint}
            />
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Appearance
            </h3>
            <Toggle
              checked={forcePageDarkMode}
              onChange={setForcePageDarkMode}
              label="Force darkMode"
              description="Additionally forces Dark Reader on pages (beyond native Google dark mode, etc.). Off = default page behavior."
            />
          </section>

          <div className="rounded-lg border border-dashed border-border/80 px-3 py-2.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Berry uses a stable system prompt and static tool definitions so
              providers can cache the prefix between turns. Dynamic page context
              is appended only on the latest user message.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
