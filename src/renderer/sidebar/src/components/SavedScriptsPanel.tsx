import React, { useState, useEffect } from "react";
import { cn } from "@common/lib/utils";
import { Play, Copy, Trash2, X, Terminal } from "lucide-react";

interface SavedScript {
  id: string;
  name: string;
  actions: any[];
  python: string;
  typescript: string;
  timestamp: number;
}

interface SavedScriptsPanelProps {
  open: boolean;
  onClose: () => void;
}

export const SavedScriptsPanel: React.FC<SavedScriptsPanelProps> = ({ open, onClose }) => {
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [activeTab, setActiveTab] = useState<"python" | "typescript">("python");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const loadScripts = () => {
    try {
      const savedRaw = localStorage.getItem("saved_dendrite_scripts");
      setScripts(savedRaw ? JSON.parse(savedRaw) : []);
    } catch (e) {
      console.error("Failed to load scripts:", e);
    }
  };

  useEffect(() => {
    loadScripts();
    window.addEventListener("saved-scripts-updated", loadScripts);
    return () => {
      window.removeEventListener("saved-scripts-updated", loadScripts);
    };
  }, []);

  if (!open) return null;

  const handleRun = async (script: SavedScript) => {
    if (replayingId) return;
    setReplayingId(script.id);
    try {
      await window.sidebarAPI.runActions(script.actions);
    } catch (e) {
      console.error("Failed to replay script:", e);
    } finally {
      setReplayingId(null);
    }
  };

  const handleCopy = (script: SavedScript) => {
    const code = activeTab === "python" ? script.python : script.typescript;
    navigator.clipboard.writeText(code);
    setCopiedId(script.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string) => {
    try {
      const updated = scripts.filter((s) => s.id !== id);
      localStorage.setItem("saved_dendrite_scripts", JSON.stringify(updated));
      setScripts(updated);
    } catch (e) {
      console.error("Failed to delete script:", e);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/95 backdrop-blur-md animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Saved Scripts</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex justify-center border-b border-border bg-muted/10 p-2">
        <div className="flex gap-1.5 bg-muted/40 p-0.5 rounded-lg">
          <button
            onClick={() => setActiveTab("python")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md transition-all",
              activeTab === "python"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Python SDK
          </button>
          <button
            onClick={() => setActiveTab("typescript")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md transition-all",
              activeTab === "typescript"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            TypeScript SDK
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {scripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-xs text-muted-foreground">No saved automation scripts found.</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[200px]">
              Perform actions via chat or browser, then click "Save to Library" on the generated card.
            </p>
          </div>
        ) : (
          scripts.map((script) => (
            <div
              key={script.id}
              className="border border-border/80 dark:border-border/30 rounded-xl p-3 bg-card/40 hover:bg-card/75 transition-all shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground truncate max-w-[180px]">
                    {script.name}
                  </h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {script.actions.length} action{script.actions.length !== 1 && "s"} • {new Date(script.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(script.id)}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete script"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRun(script)}
                  disabled={replayingId !== null}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all",
                    replayingId === script.id
                      ? "bg-emerald-600/25 text-emerald-500 border border-emerald-500/30"
                      : "bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50"
                  )}
                >
                  <Play className="size-3" />
                  <span>{replayingId === script.id ? "Running..." : "Run Replay"}</span>
                </button>

                <button
                  onClick={() => handleCopy(script)}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors"
                >
                  {copiedId === script.id ? (
                    <span className="text-emerald-500 font-semibold text-[10px]">Copied!</span>
                  ) : (
                    <>
                      <Copy className="size-3 text-muted-foreground" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
