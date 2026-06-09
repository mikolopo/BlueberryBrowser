import { randomUUID } from "node:crypto";
import type { ActionStep } from "../../shared/action-recipe-types";
import type {
  BerryOngoingTaskState,
  BerryTaskRunOnceResult,
  BerryTaskStartResult,
  BerryTaskStopResult,
} from "../../shared/berry-task-types";
import { NO_ONGOING_TASK } from "../../shared/berry-task-types";
import type { AgentActivityService } from "../agent/AgentActivityService";
import type { Window } from "../Window";
import { getActionTemplate } from "./ActionTemplates";
import { getActionRecipeStore } from "./ActionRecipeStore";
import { runActionStepsOnce } from "./ActionRecipeRunner";
import { isActionTimeoutError } from "../navigation/actionTimeout";
import { execBrowserWait } from "../navigation/browserActionExecutors";

const MIN_EVERY_MS = 2_000;
const MAX_EVERY_MS = 120_000;
const MAX_TICKS_CAP = 9_999;
const MAX_CONCURRENT_TASKS = 4;
const MAX_PAGE_TEXT = 3000;

export interface StartBerryTaskInput {
  templateId?: string;
  recipeIdOrName?: string;
  everyMs: number;
  maxTicks?: number | null;
  /** Default true — keep other interval tasks (e.g. scroll while changing speed). */
  concurrent?: boolean;
}

export interface RunBerryTaskOnceInput {
  templateId: string;
}

interface InternalTask {
  state: BerryOngoingTaskState;
  tickSteps: ActionStep[];
  cancelled: boolean;
}

export class OngoingTaskService {
  private tasks = new Map<string, InternalTask>();

  constructor(
    private getWindow: () => Window | null,
    private getAgentActivity: () => AgentActivityService | null,
  ) {}

  listTasks(): BerryOngoingTaskState[] {
    return [...this.tasks.values()]
      .filter((t) => t.state.running && !t.cancelled)
      .map((t) => ({ ...t.state }));
  }

  /** Summary for prompts — single task or aggregate label. */
  getState(): BerryOngoingTaskState {
    const list = this.listTasks();
    if (list.length === 0) return { ...NO_ONGOING_TASK };
    if (list.length === 1) return list[0];
    return {
      taskId: "multi",
      running: true,
      name: `${list.length} tasks (${list.map((t) => t.name).join(", ")})`,
      templateId: null,
      recipeId: null,
      everyMs: list[0].everyMs,
      tickCount: list.reduce((n, t) => n + t.tickCount, 0),
      maxTicks: null,
      tabId: list[0].tabId,
      url: list[0].url,
      startedAt: Math.min(...list.map((t) => t.startedAt)),
    };
  }

  isRunning(): boolean {
    return this.listTasks().length > 0;
  }

  start(input: StartBerryTaskInput): BerryTaskStartResult {
    const everyMs = clamp(
      Math.floor(input.everyMs),
      MIN_EVERY_MS,
      MAX_EVERY_MS,
    );
    const maxTicks =
      input.maxTicks == null
        ? null
        : clamp(Math.floor(input.maxTicks), 1, MAX_TICKS_CAP);

    const resolved = resolveTickSteps(input.templateId, input.recipeIdOrName);
    if (!resolved.ok) {
      throw new Error(resolved.error);
    }

    const template = input.templateId
      ? getActionTemplate(input.templateId)
      : null;
    if (template?.once) {
      throw new Error(
        `Template "${template.id}" is one-shot — use berryTaskRunOnce instead of berryTaskStart.`,
      );
    }

    const window = this.getWindow();
    const tab = window?.activeTab;
    if (!tab) {
      throw new Error(
        "No active tab — open the page first (e.g. YouTube Shorts).",
      );
    }

    const taskKey = taskKeyFor(resolved.templateId, resolved.recipeId);
    const concurrent = input.concurrent !== false;

    if (!concurrent) {
      this.stopAll(false);
    } else {
      const existing = this.tasks.get(taskKey);
      if (existing) {
        this.stopTask(taskKey, false);
      }
      if (this.listTasks().length >= MAX_CONCURRENT_TASKS) {
        throw new Error(
          `Maximum ${MAX_CONCURRENT_TASKS} concurrent tasks — stop one with berryTaskStop first.`,
        );
      }
    }

    const taskId = taskKey;
    const state: BerryOngoingTaskState = {
      taskId,
      running: true,
      name: resolved.name,
      templateId: resolved.templateId,
      recipeId: resolved.recipeId,
      everyMs,
      tickCount: 0,
      maxTicks,
      tabId: tab.id,
      url: tab.url,
      startedAt: Date.now(),
    };

    this.tasks.set(taskId, {
      state,
      tickSteps: resolved.steps,
      cancelled: false,
    });

    this.syncViewport();
    this.getAgentActivity()?.emit({
      kind: "tool_running",
      label: `Started: ${resolved.name} every ${Math.round(everyMs / 1000)}s`,
      tabId: tab.id,
      url: tab.url,
      toolName: "berryTaskStart",
    });

    void this.runLoop(taskId);

    const activeTasks = this.listTasks();
    const intervalLabel = `${Math.round(everyMs / 1000)}s`;
    return {
      ok: true,
      message:
        `Ongoing task "${resolved.name}" started every ${intervalLabel}. ` +
        `${activeTasks.length} task(s) active — use berryTaskRunOnce for mute/unmute without stopping scroll.`,
      task: state,
      activeTasks,
    };
  }

  async runOnce(input: RunBerryTaskOnceInput): Promise<BerryTaskRunOnceResult> {
    const templateId = input.templateId.trim().toLowerCase();
    const template = getActionTemplate(templateId);
    if (!template) {
      throw new Error(`Unknown template "${templateId}". Use berryTaskStatus.`);
    }

    const window = this.getWindow();
    const tab = window?.activeTab;
    if (!tab) throw new Error("No active tab");

    await tab.prepareForInteraction({ focus: false });

    this.getAgentActivity()?.emit({
      kind: "tool_running",
      label: template.name,
      tabId: tab.id,
      url: tab.url,
      toolName: "berryTaskRunOnce",
    });

    let stepResult: Record<string, unknown> = { ok: true };
    try {
      await runActionStepsOnce(
        {
          window,
          agentActivity: this.getAgentActivity(),
          maxPageTextLength: MAX_PAGE_TEXT,
          isCancelled: () => false,
          focusForInteraction: false,
        },
        template.steps,
        {
          agentActivity: this.getAgentActivity(),
          tabId: tab.id,
          url: tab.url,
        },
      );
      stepResult = { ok: true, action: template.id };
    } catch (error) {
      if (isActionTimeoutError(error)) {
        stepResult = {
          ok: false,
          timedOut: true,
          error: error instanceof Error ? error.message : String(error),
        };
      } else {
        throw error;
      }
    }

    const activeTasks = this.listTasks();
    return {
      ok: Boolean(stepResult.ok),
      message:
        `${template.name} executed.` +
        (activeTasks.length > 0
          ? ` ${activeTasks.length} background task(s) still running.`
          : ""),
      templateId: template.id,
      result: stepResult,
      activeTasks,
    };
  }

  stop(templateOrTaskId?: string, notify = true): BerryTaskStopResult {
    if (templateOrTaskId?.trim()) {
      return this.stopTask(templateOrTaskId.trim().toLowerCase(), notify);
    }
    return this.stopAll(notify);
  }

  stopAll(notify = true): BerryTaskStopResult {
    const list = this.listTasks();
    let totalTicks = 0;
    for (const task of list) {
      totalTicks += task.tickCount;
      this.stopTask(task.taskId, false);
    }

    if (notify && list.length > 0) {
      this.getAgentActivity()?.emit({
        kind: "tool_done",
        label: `Stopped ${list.length} task(s)`,
        tabId: list[0]?.tabId ?? undefined,
        url: list[0]?.url ?? undefined,
        toolName: "berryTaskStop",
      });
    }

    this.syncViewport();
    return {
      ok: true,
      stopped: list.length > 0,
      stoppedCount: list.length,
      tickCount: totalTicks,
      message:
        list.length > 0
          ? `Stopped ${list.length} ongoing task(s).`
          : "No ongoing tasks were running.",
      activeTasks: [],
    };
  }

  private stopTask(taskId: string, notify: boolean): BerryTaskStopResult {
    const key = this.tasks.has(taskId)
      ? taskId
      : ([...this.tasks.keys()].find((k) => k === taskId) ??
        [...this.tasks.entries()].find(
          ([, t]) =>
            t.state.templateId === taskId || t.state.recipeId === taskId,
        )?.[0]);

    const entry = key ? this.tasks.get(key) : undefined;
    if (!entry) {
      return {
        ok: true,
        stopped: false,
        stoppedCount: 0,
        tickCount: 0,
        message: `No task matching "${taskId}".`,
        activeTasks: this.listTasks(),
      };
    }

    entry.cancelled = true;
    const ticks = entry.state.tickCount;
    const name = entry.state.name;

    if (notify) {
      this.getAgentActivity()?.emit({
        kind: "tool_done",
        label: `Stopped: ${name} (${ticks} ticks)`,
        tabId: entry.state.tabId ?? undefined,
        url: entry.state.url ?? undefined,
        toolName: "berryTaskStop",
      });
    }

    this.tasks.delete(key!);
    this.syncViewport();

    return {
      ok: true,
      stopped: true,
      stoppedCount: 1,
      tickCount: ticks,
      message: `Stopped "${name}".`,
      activeTasks: this.listTasks(),
    };
  }

  private syncViewport(): void {
    this.getAgentActivity()?.setOngoingTasks(this.listTasks());
  }

  private async runLoop(taskId: string): Promise<void> {
    while (true) {
      const entry = this.tasks.get(taskId);
      if (!entry || entry.cancelled) return;

      const window = this.getWindow();
      const tabId = entry.state.tabId;
      const tab = tabId && window ? window.getTab(tabId) : null;

      if (!window || !tab || tab.webContents.isDestroyed()) {
        this.tasks.delete(taskId);
        this.syncViewport();
        return;
      }

      if (
        tabId &&
        window.activeTab?.id !== tabId &&
        !window.isSidebarFocused()
      ) {
        window.switchActiveTab(tabId);
      }

      entry.state.tickCount += 1;
      entry.state.url = tab.url;
      this.syncViewport();

      const tickLabel = `${entry.state.name} · tick ${entry.state.tickCount}${
        entry.state.maxTicks ? `/${entry.state.maxTicks}` : ""
      }`;

      this.getAgentActivity()?.emit({
        kind: "tool_running",
        label: tickLabel,
        tabId: tab.id,
        url: tab.url,
        toolName: "berryTask",
      });

      void tab.playBerryActivity({
        id: `task-${taskId}-${Date.now()}`,
        kind: "clicking",
        label: tickLabel,
        tabId: tab.id,
        url: tab.url,
        timestamp: Date.now(),
      });

      try {
        await runActionStepsOnce(
          {
            window,
            agentActivity: this.getAgentActivity(),
            maxPageTextLength: MAX_PAGE_TEXT,
            isCancelled: () => entry.cancelled,
            focusForInteraction: false,
          },
          entry.tickSteps,
          {
            isCancelled: () => entry.cancelled,
            agentActivity: this.getAgentActivity(),
            tabId: tab.id,
            url: tab.url,
          },
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (entry.cancelled || msg.includes("cancelled")) {
          this.tasks.delete(taskId);
          this.syncViewport();
          return;
        }
        if (isActionTimeoutError(error)) {
          console.warn("[Berry task tick timeout]", taskId, msg);
        } else {
          console.warn("[Berry task tick error]", taskId, msg);
        }
      }

      if (entry.cancelled) {
        this.tasks.delete(taskId);
        this.syncViewport();
        return;
      }

      if (
        entry.state.maxTicks != null &&
        entry.state.tickCount >= entry.state.maxTicks
      ) {
        this.tasks.delete(taskId);
        this.syncViewport();
        return;
      }

      try {
        await execBrowserWait(entry.state.everyMs, () => entry.cancelled);
      } catch {
        this.tasks.delete(taskId);
        this.syncViewport();
        return;
      }
    }
  }
}

function resolveTickSteps(
  templateId?: string,
  recipeIdOrName?: string,
):
  | {
      ok: true;
      name: string;
      steps: ActionStep[];
      templateId: string | null;
      recipeId: string | null;
    }
  | { ok: false; error: string } {
  if (templateId?.trim()) {
    const template = getActionTemplate(templateId);
    if (!template) {
      return {
        ok: false,
        error: `Unknown template "${templateId}". Use berryTaskStatus to list templates.`,
      };
    }
    return {
      ok: true,
      name: template.name,
      steps: template.steps,
      templateId: template.id,
      recipeId: null,
    };
  }

  if (recipeIdOrName?.trim()) {
    const store = getActionRecipeStore();
    const recipe =
      store.getById(recipeIdOrName) ?? store.getByName(recipeIdOrName);
    if (!recipe) {
      return { ok: false, error: `Recipe not found: ${recipeIdOrName}` };
    }

    const intervalStep = recipe.steps.find((s) => s.action === "interval");
    if (intervalStep && intervalStep.action === "interval") {
      return {
        ok: true,
        name: recipe.name,
        steps: intervalStep.steps,
        templateId: null,
        recipeId: recipe.id,
      };
    }

    return {
      ok: true,
      name: recipe.name,
      steps: recipe.steps,
      templateId: null,
      recipeId: recipe.id,
    };
  }

  return {
    ok: false,
    error: "Provide templateId (e.g. youtube-shorts-next) or recipeIdOrName.",
  };
}

function taskKeyFor(
  templateId: string | null,
  recipeId: string | null,
): string {
  return templateId ?? recipeId ?? `task-${randomUUID()}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
