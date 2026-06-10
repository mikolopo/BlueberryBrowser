import React, { useState, useEffect } from "react";
import { Copy, Save, X, Check, Eye } from "lucide-react";
import { cn } from "@common/lib/utils";
import { BerrySprite } from "@common/components/BerrySprite";
import { motion } from "framer-motion";

interface ScriptPopupModalProps {
  scriptData: {
    python: string;
    typescript: string;
    actions: any[];
  } | null;
  onClose: () => void;
}

export const ScriptPopupModal: React.FC<ScriptPopupModalProps> = ({ scriptData, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"python" | "typescript">("python");
  const [copied, setCopied] = useState(false);
  const [scriptName, setScriptName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    if (scriptData) {
      setScriptName("");
      setSaveStatus("idle");
      setCopied(false);
      setIsExpanded(false);
    }
  }, [scriptData]);

  if (!scriptData) return null;

  const codeToDisplay = activeTab === "python" ? scriptData.python : scriptData.typescript;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!scriptName.trim()) return;
    try {
      const savedRaw = localStorage.getItem("saved_dendrite_scripts");
      const savedList = savedRaw ? JSON.parse(savedRaw) : [];

      const newScript = {
        id: Date.now().toString(),
        name: scriptName.trim(),
        actions: scriptData.actions,
        python: scriptData.python,
        typescript: scriptData.typescript,
        timestamp: Date.now(),
      };
      savedList.push(newScript);
      localStorage.setItem("saved_dendrite_scripts", JSON.stringify(savedList));

      window.dispatchEvent(new Event("saved-scripts-updated"));

      setSaveStatus("saved");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e) {
      console.error("Failed to save script:", e);
    }
  };

  // 1. Notification / Collapsed State
  if (!isExpanded) {
    return (
      <div className="absolute inset-x-0 top-0 z-50 flex justify-center p-2 pointer-events-none">
        <motion.div
          className="w-full rounded-xl border border-primary/20 bg-card/95 p-3 shadow-lg flex items-center justify-between gap-3 pointer-events-auto backdrop-blur-sm"
          initial={{ y: -40, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -40, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="shrink-0">
              <BerrySprite kind="idle" size={20} animated={true} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-foreground leading-snug">
                Automation script ready!
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {scriptData.actions.length} actions recorded
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground font-bold text-[10px] rounded-lg shadow-sm hover:opacity-90 transition-opacity"
            >
              <Eye className="size-3" />
              <span>View & Save</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. Expanded State (No full backdrop, floats over chat, doesn't block other clicks)
  return (
    <div className="absolute inset-x-0 top-0 z-50 flex justify-center p-2 pointer-events-none">
      <motion.div
        role="dialog"
        aria-modal="false"
        className="w-full rounded-2xl border border-border bg-card/95 p-4 shadow-2xl flex flex-col max-h-[50vh] pointer-events-auto backdrop-blur-sm"
        initial={{ y: -40, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -40, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
          <div className="flex items-center gap-2 text-primary">
            <BerrySprite kind="idle" size={20} animated={true} />
            <h3 className="text-xs font-bold text-foreground">
              Save Automation Script
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Minimize
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Tab switch & Actions */}
        <div className="flex items-center justify-between my-2.5">
          <div className="flex gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/20">
            <button
              onClick={() => setActiveTab("python")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all",
                activeTab === "python"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Python
            </button>
            <button
              onClick={() => setActiveTab("typescript")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all",
                activeTab === "typescript"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              TypeScript
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500" />
                <span className="text-emerald-500">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3 text-muted-foreground" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Script code area */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2.5 mb-3 max-h-[160px]">
          <pre className="text-[10px] font-mono leading-relaxed text-foreground select-text m-0 whitespace-pre overflow-x-auto">
            <code>{codeToDisplay}</code>
          </pre>
        </div>

        {/* Save to library block */}
        <div className="flex gap-2 items-center pt-2.5 border-t border-border/60">
          <input
            type="text"
            placeholder="Enter script name..."
            value={scriptName}
            onChange={(e) => setScriptName(e.target.value)}
            className="flex-1 px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60 shadow-sm"
            disabled={saveStatus === "saved"}
          />
          <button
            onClick={handleSave}
            disabled={!scriptName.trim() || saveStatus === "saved"}
            className="px-3 py-1.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md disabled:opacity-50 flex items-center gap-1 transition-all shrink-0"
          >
            <Save className="size-3" />
            <span>{saveStatus === "saved" ? "Saved!" : "Save"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
