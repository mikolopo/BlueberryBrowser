import React, { useState, useEffect } from "react";
import { cn } from "@common/lib/utils";
import { Play, Copy, Trash2, X, Terminal, Radio, Save } from "lucide-react";

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

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedActions, setRecordedActions] = useState<any[]>([]);
  const [stoppedResult, setStoppedResult] = useState<{
    python: string;
    typescript: string;
    actions: any[];
  } | null>(null);
  const [newScriptName, setNewScriptName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [previewTab, setPreviewTab] = useState<"python" | "typescript">("python");

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

    // Initial recording state check
    window.sidebarAPI.isRecordingActive().then((active) => {
      setIsRecording(active);
    });

    // Subscriptions
    window.sidebarAPI.onRecordingStateChanged((active) => {
      setIsRecording(active);
      if (active) {
        setStoppedResult(null);
      }
    });

    window.sidebarAPI.onActionsRecordedUpdated((actions) => {
      setRecordedActions(actions);
    });

    return () => {
      window.removeEventListener("saved-scripts-updated", loadScripts);
      window.sidebarAPI.removeRecordingStateChangedListener();
      window.sidebarAPI.removeActionsRecordedUpdatedListener();
    };
  }, []);

  if (!open) return null;

  const handleStartRecording = async () => {
    setRecordedActions([]);
    setStoppedResult(null);
    await window.sidebarAPI.startRecording();
  };

  const handleStopRecording = async () => {
    const result = await window.sidebarAPI.stopRecording();
    setStoppedResult(result);
  };

  const handleSaveRecorded = () => {
    if (!newScriptName.trim() || !stoppedResult) return;
    try {
      const savedRaw = localStorage.getItem("saved_dendrite_scripts");
      const savedList = savedRaw ? JSON.parse(savedRaw) : [];
      
      const newScript: SavedScript = {
        id: Date.now().toString(),
        name: newScriptName.trim(),
        actions: stoppedResult.actions,
        python: stoppedResult.python,
        typescript: stoppedResult.typescript,
        timestamp: Date.now()
      };

      savedList.push(newScript);
      localStorage.setItem("saved_dendrite_scripts", JSON.stringify(savedList));
      setScripts(savedList);
      
      // Reset
      setSaveStatus("saved");
      setTimeout(() => {
        setStoppedResult(null);
        setNewScriptName("");
        setSaveStatus("idle");
      }, 1000);
    } catch (e) {
      console.error("Failed to save script:", e);
    }
  };

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
      {/* Header */}
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Recording Console Card */}
        <div className="border border-border/80 dark:border-border/30 rounded-xl p-4 bg-card/60 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className={cn("size-4", isRecording ? "text-red-500 animate-pulse" : "text-muted-foreground")} />
              <span className="text-xs font-bold text-foreground">
                {isRecording ? "Recording User Actions..." : "Record Actions"}
              </span>
            </div>
            {isRecording && (
              <span className="text-[10px] bg-red-500/10 text-red-500 font-semibold px-2 py-0.5 rounded-full">
                {recordedActions.length} Step{recordedActions.length !== 1 && "s"}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:brightness-110 shadow-sm transition-all"
              >
                <div className="size-2 bg-red-600 rounded-full animate-ping" />
                <span>Start Recording</span>
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm transition-all"
              >
                <div className="size-2 bg-white rounded-full animate-pulse" />
                <span>Stop Recording</span>
              </button>
            )}
          </div>

          {/* Real-time actions list feed */}
          {isRecording && recordedActions.length > 0 && (
            <div className="mt-2 bg-muted/40 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1.5 border border-border/20">
              {recordedActions.map((act, index) => (
                <div key={index} className="text-[10px] font-mono text-muted-foreground flex gap-1.5 items-center">
                  <span className="text-primary font-bold">{index + 1}.</span>
                  <span className="capitalize font-semibold text-foreground/80">{act.type}</span>
                  {act.url && <span className="truncate max-w-[150px] text-muted-foreground/60">{act.url}</span>}
                  {act.selector && <span className="truncate max-w-[100px] text-muted-foreground/60 font-semibold">({act.selector})</span>}
                </div>
              ))}
            </div>
          )}

          {/* Stop Recording Preview Dialog */}
          {stoppedResult && (
            <div className="mt-4 border border-border/80 dark:border-border/30 rounded-xl bg-muted/20 overflow-hidden space-y-3 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Save Recorded Script</span>
                <div className="flex gap-1 bg-muted/60 p-0.5 rounded-md">
                  <button
                    onClick={() => setPreviewTab("python")}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold rounded transition-all",
                      previewTab === "python" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    Py
                  </button>
                  <button
                    onClick={() => setPreviewTab("typescript")}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold rounded transition-all",
                      previewTab === "typescript" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    TS
                  </button>
                </div>
              </div>

              <pre className="p-3 text-[10px] font-mono overflow-x-auto bg-black/10 text-foreground leading-relaxed max-h-32 border border-border/10 rounded-lg whitespace-pre select-text">
                <code>{previewTab === "python" ? stoppedResult.python : stoppedResult.typescript}</code>
              </pre>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Script name..."
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-background border border-border/80 rounded-md focus:outline-none focus:border-primary text-foreground"
                />
                <button
                  onClick={handleSaveRecorded}
                  disabled={!newScriptName.trim() || saveStatus === "saved"}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white font-semibold rounded-md shadow-sm disabled:opacity-55 flex items-center gap-1 hover:bg-emerald-700"
                >
                  <Save className="size-3.5" />
                  <span>{saveStatus === "saved" ? "Saved!" : "Save"}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global tab switches for existing script libraries */}
        {scripts.length > 0 && (
          <div className="flex justify-center bg-muted/10 p-1 border-b border-border/20">
            <div className="flex gap-1.5 bg-muted/40 p-0.5 rounded-lg">
              <button
                onClick={() => setActiveTab("python")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  activeTab === "python" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground"
                )}
              >
                Python SDK
              </button>
              <button
                onClick={() => setActiveTab("typescript")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  activeTab === "typescript" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground"
                )}
              >
                TypeScript SDK
              </button>
            </div>
          </div>
        )}

        {/* Saved scripts list */}
        <div className="space-y-3">
          {scripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-xs text-muted-foreground">No saved scripts found.</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[200px]">
                Click "Start Recording" above or perform actions via the AI chat assistant.
              </p>
            </div>
          ) : (
            scripts.map((script) => (
              <div
                key={script.id}
                className="border border-border/80 dark:border-border/30 rounded-xl p-3 bg-card/40 hover:bg-card/75 transition-all shadow-sm space-y-3 animate-in fade-in"
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
    </div>
  );
};
