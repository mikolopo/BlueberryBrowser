import React, { useEffect, useRef } from "react";
import { cn } from "@common/lib/utils";
import { useChatSettings } from "../contexts/ChatSettingsContext";
import { SettingsSlidersIcon } from "./icons/SettingsSlidersIcon";

interface ChatSettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <label className="flex items-start justify-between gap-3 cursor-pointer group">
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
      onClick={() => onChange(!checked)}
      className={cn(
        "relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-muted",
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

export const ChatSettingsPanel: React.FC<ChatSettingsPanelProps> = ({
  open,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { webMcpEnabled, setWebMcpEnabled } = useChatSettings();

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

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
          "absolute top-1 right-2 z-50 w-[min(calc(100%-1rem),18rem)]",
          "rounded-xl border border-border bg-popover shadow-expanded",
          "animate-slide-in-right app-region-no-drag",
        )}
        role="dialog"
        aria-label="Chat settings"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <SettingsSlidersIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Chat settings
          </h2>
        </div>

        <div className="p-3 space-y-4">
          <Toggle
            checked={webMcpEnabled}
            onChange={setWebMcpEnabled}
            label="WebMCP"
            description="Globally enables page tools in bot conversations (when the page exposes them)."
          />

          <div className="rounded-lg border border-dashed border-border/80 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              More settings (model, memory, shortcuts) will appear here.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
