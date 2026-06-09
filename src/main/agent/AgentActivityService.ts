import { randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import type {
  AgentActivityEvent,
  AgentActivityKind,
  AgentPlanState,
  AgentPlanStepStatus,
  AgentViewportState,
} from "../../shared/agent-activity-types";
import { IDLE_VIEWPORT } from "../../shared/agent-activity-types";
import type { BerryOngoingTaskState } from "../../shared/berry-task-types";
import { spriteFrameForKind } from "../../shared/berrySpriteMood";

const MAX_FEED = 40;

export interface EmitAgentActivityInput {
  kind: AgentActivityKind;
  label: string;
  detail?: string;
  tabId?: string;
  url?: string;
  toolName?: string;
  selector?: string;
}

export class AgentActivityService {
  private _viewport: AgentViewportState = { ...IDLE_VIEWPORT };
  private _ongoingTasks: BerryOngoingTaskState[] = [];
  private _plan: AgentPlanState | null = null;
  private _feed: AgentActivityEvent[] = [];
  private _topBarWebContents: (() => WebContents | null) | null = null;
  private _sidebarWebContents: (() => WebContents | null) | null = null;
  private _idleTimer: NodeJS.Timeout | null = null;
  private _pageVisualHandler: ((event: AgentActivityEvent) => void) | null =
    null;
  private _onPlanUpdated: (() => void) | null = null;
  private _onActivityEmit: ((event: AgentActivityEvent) => void) | null = null;

  onPlanUpdated(callback: () => void): void {
    this._onPlanUpdated = callback;
  }

  onActivityEmit(callback: (event: AgentActivityEvent) => void): void {
    this._onActivityEmit = callback;
  }

  bindRenderers(
    getTopBar: () => WebContents | null,
    getSidebar: () => WebContents | null,
  ): void {
    this._topBarWebContents = getTopBar;
    this._sidebarWebContents = getSidebar;
  }

  setPageVisualHandler(handler: (event: AgentActivityEvent) => void): void {
    this._pageVisualHandler = handler;
  }

  getViewport(): AgentViewportState {
    const ongoingTask = this.summarizeOngoingTasks(this._ongoingTasks);
    return {
      ...this._viewport,
      ongoingTask,
      ongoingTasks: [...this._ongoingTasks],
      plan: this._plan,
    };
  }

  setPlan(title: string, stepLabels: string[]): AgentPlanState {
    this._plan = {
      title: title.trim() || "Task plan",
      steps: stepLabels.map((label, index) => ({
        index,
        label: label.trim(),
        status: index === 0 ? ("in_progress" as const) : ("pending" as const),
      })),
      updatedAt: Date.now(),
    };
    this.broadcastState();
    this._onPlanUpdated?.();
    return this._plan;
  }

  updatePlanStep(
    stepIndex: number,
    status: AgentPlanStepStatus,
  ): AgentPlanState | null {
    if (!this._plan) return null;
    const step = this._plan.steps[stepIndex];
    if (!step) return this._plan;

    step.status = status;
    // Auto-advance: completing a step puts the next pending one in progress.
    if (status === "done" || status === "failed") {
      const next = this._plan.steps.find((s) => s.status === "pending");
      if (next) next.status = "in_progress";
    }
    this._plan.updatedAt = Date.now();
    this.broadcastState();
    this._onPlanUpdated?.();
    return this._plan;
  }

  insertPlanStep(
    index: number | undefined,
    label: string,
  ): AgentPlanState | null {
    if (!this._plan) return null;
    const cleanLabel = label.trim();
    if (!cleanLabel) return this._plan;

    const steps = [...this._plan.steps];
    let targetIdx = index !== undefined ? index : steps.length;
    if (targetIdx < 0) targetIdx = 0;
    if (targetIdx > steps.length) targetIdx = steps.length;

    const newStep = {
      index: targetIdx,
      label: cleanLabel,
      status: "pending" as const,
    };

    steps.splice(targetIdx, 0, newStep);

    // Re-index all steps to ensure they are continuous 0-based
    this._plan.steps = steps.map((s, idx) => ({
      ...s,
      index: idx,
    }));

    this._plan.updatedAt = Date.now();
    this.broadcastState();
    this._onPlanUpdated?.();
    return this._plan;
  }

  deletePlanStep(stepIndex: number): AgentPlanState | null {
    if (!this._plan) return null;
    if (stepIndex < 0 || stepIndex >= this._plan.steps.length)
      return this._plan;

    this._plan.steps.splice(stepIndex, 1);

    // Re-index
    this._plan.steps = this._plan.steps.map((s, idx) => ({
      ...s,
      index: idx,
    }));

    // If we deleted the step that was "in_progress" or if there is no step currently "in_progress",
    // auto-advance the first remaining "pending" step to "in_progress"
    const hasInProgress = this._plan.steps.some(
      (s) => s.status === "in_progress",
    );
    if (!hasInProgress) {
      const next = this._plan.steps.find((s) => s.status === "pending");
      if (next) next.status = "in_progress";
    }

    this._plan.updatedAt = Date.now();
    this.broadcastState();
    this._onPlanUpdated?.();
    return this._plan;
  }

  getPlan(): AgentPlanState | null {
    return this._plan;
  }

  clearPlan(): void {
    if (!this._plan) return;
    this._plan = null;
    this.broadcastState();
    this._onPlanUpdated?.();
  }

  setOngoingTasks(tasks: BerryOngoingTaskState[]): void {
    this._ongoingTasks = tasks.map((t) => ({ ...t }));
    this.broadcastState();
  }

  /** @deprecated use setOngoingTasks */
  setOngoingTask(task: BerryOngoingTaskState | null): void {
    this.setOngoingTasks(task?.running ? [task] : []);
  }

  private summarizeOngoingTasks(
    tasks: BerryOngoingTaskState[],
  ): BerryOngoingTaskState | null {
    if (tasks.length === 0) return null;
    if (tasks.length === 1) return tasks[0];
    return {
      taskId: "multi",
      running: true,
      name: `${tasks.length} tasks (${tasks.map((t) => t.name).join(", ")})`,
      templateId: null,
      recipeId: null,
      everyMs: tasks[0].everyMs,
      tickCount: tasks.reduce((n, t) => n + t.tickCount, 0),
      maxTicks: null,
      tabId: tasks[0].tabId,
      url: tasks[0].url,
      startedAt: Math.min(...tasks.map((t) => t.startedAt)),
    };
  }

  private get ongoingTaskSummary(): BerryOngoingTaskState | null {
    return this.summarizeOngoingTasks(this._ongoingTasks);
  }

  getFeed(): AgentActivityEvent[] {
    return [...this._feed];
  }

  emit(input: EmitAgentActivityInput): AgentActivityEvent {
    const event: AgentActivityEvent = {
      id: randomUUID(),
      timestamp: Date.now(),
      ...input,
    };

    this._feed.unshift(event);
    if (this._feed.length > MAX_FEED) {
      this._feed.length = MAX_FEED;
    }

    this._viewport = {
      isActive: input.kind !== "idle",
      tabId: input.tabId ?? this._viewport.tabId,
      url: input.url ?? this._viewport.url,
      title: this._viewport.title,
      currentKind: input.kind,
      currentLabel: input.label,
      spriteFrame: spriteFrameForKind(input.kind),
      ongoingTask: this.ongoingTaskSummary,
      ongoingTasks: [...this._ongoingTasks],
      plan: this._plan,
    };

    if (input.kind === "idle" && this._ongoingTasks.length === 0) {
      this._viewport = {
        ...IDLE_VIEWPORT,
        ongoingTask: null,
        ongoingTasks: [],
        plan: this._plan,
      };
    }

    this.broadcast(event);
    this._pageVisualHandler?.(event);
    this._onActivityEmit?.(event);
    this.scheduleIdleReset(input.kind);
    return event;
  }

  setViewportUrl(
    tabId: string | null,
    url: string | null,
    title?: string,
  ): void {
    this._viewport = {
      ...this._viewport,
      tabId,
      url,
      title: title ?? this._viewport.title,
      ongoingTask: this.ongoingTaskSummary,
    };
    this.broadcastState();
  }

  private scheduleIdleReset(kind: AgentActivityKind): void {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    if (kind === "idle") return;

    this._idleTimer = setTimeout(() => {
      if (this._ongoingTasks.length > 0) return;
      this.emit({
        kind: "idle",
        label: "Berry is idle",
      });
    }, 8000);
  }

  private broadcast(event: AgentActivityEvent): void {
    const payload = {
      event,
      viewport: this.getViewport(),
      feed: this._feed.slice(0, 20),
    };

    for (const getWc of [this._topBarWebContents, this._sidebarWebContents]) {
      const wc = getWc?.();
      if (wc && !wc.isDestroyed()) {
        wc.send("agent-activity-updated", payload);
      }
    }
  }

  private broadcastState(): void {
    const payload = {
      event: null,
      viewport: this.getViewport(),
      feed: this._feed.slice(0, 20),
    };

    for (const getWc of [this._topBarWebContents, this._sidebarWebContents]) {
      const wc = getWc?.();
      if (wc && !wc.isDestroyed()) {
        wc.send("agent-activity-updated", payload);
      }
    }
  }

  syncToRenderer(): void {
    this.broadcastState();
  }

  dispose(): void {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }
}
