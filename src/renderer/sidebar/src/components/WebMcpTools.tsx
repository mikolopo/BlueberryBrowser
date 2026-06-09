import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, RefreshCw, Wrench } from "lucide-react";
import { cn } from "@common/lib/utils";
import { useWebMcp } from "../contexts/WebMcpContext";
import { useChatSettings } from "../contexts/ChatSettingsContext";

export const WebMcpTools: React.FC = () => {
  const { snapshot, setSnapshot, hasTools } = useWebMcp();
  const { webMcpEnabled } = useChatSettings();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadTools = useCallback(async () => {
    const data = await window.sidebarAPI.getWebMcpTools();
    setSnapshot(data);
  }, [setSnapshot]);

  useEffect(() => {
    void loadTools();

    window.sidebarAPI.onWebMcpToolsUpdated((next) => {
      setSnapshot(next);
    });

    return () => {
      window.sidebarAPI.removeWebMcpToolsListener();
    };
  }, [loadTools, setSnapshot]);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      const data = await window.sidebarAPI.refreshWebMcpTools();
      setSnapshot(data);
    } finally {
      setIsRefreshing(false);
    }
  };

  const tools = snapshot?.tools ?? [];

  if (!hasTools && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="shrink-0 border-b border-border px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        No WebMCP on this page · <span className="underline">show</span>
      </button>
    );
  }

  return (
    <section
      className={cn(
        "border-b border-border shrink-0 overflow-hidden transition-all duration-300",
        expanded ? "max-h-[35%]" : "max-h-9",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground min-w-0"
        >
          <Wrench className="size-3.5 shrink-0" />
          <span className="truncate">
            WebMCP {hasTools ? `(${tools.length})` : "— none"}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50"
          title="Refresh tools"
        >
          <RefreshCw
            className={cn("size-3.5", isRefreshing && "animate-spin")}
          />
        </button>
      </div>

      {expanded ? (
        <div className="px-3 pb-2 overflow-y-auto animate-fade-in">
          {webMcpEnabled && hasTools ? (
            <p className="mb-2 text-[10px] text-primary">
              WebMCP enabled globally — AI can call tools (with your consent).
            </p>
          ) : webMcpEnabled ? (
            <p className="mb-2 text-[10px] text-muted-foreground">
              WebMCP is enabled, but this page does not expose tools.
            </p>
          ) : (
            <p className="mb-2 text-[10px] text-muted-foreground">
              Enable WebMCP in chat settings (sliders icon).
            </p>
          )}

          {!hasTools ? (
            <p className="text-xs text-muted-foreground">
              Open <code className="text-[10px]">/demo/index.html</code>
            </p>
          ) : (
            <ul className="space-y-1.5">
              {tools.map((tool) => (
                <li
                  key={tool.name}
                  className="rounded-md bg-muted/50 px-2 py-1.5 text-xs animate-fade-in"
                >
                  <div className="font-medium text-foreground">{tool.name}</div>
                  {tool.description ? (
                    <div className="text-muted-foreground line-clamp-2">
                      {tool.description}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
};
