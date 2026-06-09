import React, { useEffect, useState } from "react";
import {
  Globe,
  Eye,
  Camera,
  MousePointer2,
  Wrench,
  Shield,
  CheckCircle2,
  XCircle,
  Brain,
  MessageSquare,
  ChevronDown,
  Square,
  Circle,
  CircleDot,
  ListChecks,
} from "lucide-react";
import { BerrySprite } from "@common/components/BerrySprite";
import { cn } from "@common/lib/utils";
import { useAgentActivity } from "../contexts/AgentActivityContext";
import { useChat } from "../contexts/ChatContext";
import type {
  AgentActivityKind,
  AgentPlanState,
} from "@shared/agent-activity-types";

const kindMeta: Record<
  AgentActivityKind,
  { icon: React.ElementType; tone: string }
> = {
  idle: { icon: MessageSquare, tone: "text-muted-foreground" },
  thinking: { icon: Brain, tone: "text-primary" },
  navigating: { icon: Globe, tone: "text-primary" },
  reading_page: { icon: Eye, tone: "text-primary" },
  screenshot: { icon: Camera, tone: "text-primary" },
  tool_consent: { icon: Shield, tone: "text-amber-600 dark:text-amber-400" },
  tool_running: { icon: Wrench, tone: "text-primary" },
  tool_done: {
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  tool_denied: { icon: XCircle, tone: "text-destructive" },
  clicking: {
    icon: MousePointer2,
    tone: "text-violet-600 dark:text-violet-400",
  },
  responding: { icon: MessageSquare, tone: "text-muted-foreground" },
};

const formatUrl = (url: string | null): string => {
  if (!url) return "No active tab";
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    if (path === "/" || path === "") return u.hostname;
    const short = path.length > 28 ? `${path.slice(0, 25)}…` : path;
    return `${u.hostname}${short}`;
  } catch {
    return url.length > 32 ? `${url.slice(0, 29)}…` : url;
  }
};

const PlanChecklist: React.FC<{ plan: AgentPlanState }> = ({ plan }) => (
  <div className="mt-1.5 border-t border-border/40 pt-1.5 pl-1">
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground/80">
      <ListChecks className="size-3 shrink-0 text-primary" />
      <span className="truncate">{plan.title}</span>
      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
        {plan.steps.filter((s) => s.status === "done").length}/
        {plan.steps.length}
      </span>
    </div>
    <ul className="mt-1 space-y-0.5">
      {plan.steps.map((step) => (
        <li
          key={step.index}
          className={cn(
            "flex items-center gap-1.5 text-[10px]",
            step.status === "done" && "text-muted-foreground line-through",
            step.status === "in_progress" && "font-medium text-foreground",
            step.status === "pending" && "text-muted-foreground",
            step.status === "failed" && "text-destructive",
          )}
        >
          {step.status === "done" ? (
            <CheckCircle2 className="size-2.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : step.status === "failed" ? (
            <XCircle className="size-2.5 shrink-0 text-destructive" />
          ) : step.status === "in_progress" ? (
            <CircleDot className="size-2.5 shrink-0 text-primary animate-pulse-soft" />
          ) : (
            <Circle className="size-2.5 shrink-0 text-muted-foreground/50" />
          )}
          <span className="min-w-0 flex-1 truncate">{step.label}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const AgentStatusBar: React.FC = () => {
  const { feed, viewport } = useAgentActivity();
  const { isLoading, stopAgent } = useChat();
  const [expanded, setExpanded] = useState(false);

  const taskRunning =
    (viewport.ongoingTasks?.length ?? 0) > 0 || viewport.ongoingTask?.running;
  const active = viewport.isActive || isLoading || taskRunning;
  const history = feed.filter((e) => e.kind !== "idle").slice(0, 6);
  const canExpand = history.length > 1;

  const tasks = viewport.ongoingTasks?.length
    ? viewport.ongoingTasks
    : viewport.ongoingTask?.running
      ? [viewport.ongoingTask]
      : [];

  const statusLabel =
    tasks.length > 1
      ? `${tasks.length} tasks · ${tasks.map((t) => t.name).join(", ")}`
      : tasks.length === 1
        ? `${tasks[0].name} · every ${Math.round(tasks[0].everyMs / 1000)}s · tick ${tasks[0].tickCount}`
        : viewport.currentLabel;

  useEffect(() => {
    if (!active) setExpanded(false);
  }, [active]);

  return (
    <div
      className={cn(
        "shrink-0 border-b px-2.5 py-1.5 transition-colors duration-300",
        active
          ? "border-primary/20 bg-primary/5 animate-agent-strip-glow"
          : "border-border/60 bg-muted/20",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          disabled={!canExpand}
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-0.5 text-left",
            canExpand && "hover:opacity-90 transition-opacity cursor-pointer",
            !canExpand && "cursor-default",
          )}
          aria-expanded={expanded}
          aria-label="Agent status"
        >
          <div className="flex items-center gap-2 min-w-0">
            <BerrySprite
              kind={viewport.currentKind}
              frame={viewport.spriteFrame}
              size={20}
              animated={active}
            />
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                active
                  ? "bg-primary animate-pulse-soft"
                  : "bg-muted-foreground/40",
              )}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[11px] leading-tight",
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
              title={statusLabel}
            >
              {statusLabel}
            </span>
            {canExpand ? (
              <ChevronDown
                className={cn(
                  "size-3 shrink-0 text-muted-foreground transition-transform duration-200",
                  expanded && "rotate-180",
                )}
              />
            ) : null}
          </div>

          <div className="flex items-center gap-1 pl-7 min-w-0">
            {active && viewport.currentKind === "clicking" ? (
              <MousePointer2 className="size-2.5 shrink-0 text-primary" />
            ) : (
              <Globe className="size-2.5 shrink-0 text-muted-foreground/70" />
            )}
            <span
              className="truncate text-[10px] text-muted-foreground tabular-nums"
              title={viewport.url ?? undefined}
            >
              {formatUrl(viewport.url)}
            </span>
          </div>
        </button>

        {isLoading || taskRunning ? (
          <button
            type="button"
            onClick={() => void stopAgent()}
            className={cn(
              "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1",
              "text-[10px] font-semibold bg-destructive text-destructive-foreground",
              "hover:brightness-95 active:brightness-90 transition-all",
            )}
            aria-label={
              taskRunning && !isLoading ? "Stop ongoing task" : "Stop Berry"
            }
          >
            <Square className="size-2.5 fill-current" />
            Stop
          </button>
        ) : null}
      </div>

      {viewport.plan ? <PlanChecklist plan={viewport.plan} /> : null}

      {expanded && canExpand ? (
        <ul className="mt-1.5 max-h-[3.5rem] space-y-0.5 overflow-y-auto border-t border-border/40 pt-1 pl-7">
          {history.slice(1).map((entry) => {
            const meta = kindMeta[entry.kind] ?? kindMeta.thinking;
            const Icon = meta.icon;
            return (
              <li
                key={entry.id}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
              >
                <Icon className={cn("size-2.5 shrink-0", meta.tone)} />
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
