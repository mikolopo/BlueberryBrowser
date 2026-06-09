import type { ActionStep } from "./action-recipe-types";

export interface BerryActionTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  steps: ActionStep[];
  /** If true, meant for berryTaskRunOnce (not interval loops). */
  once?: boolean;
}

export interface BerryOngoingTaskState {
  taskId: string;
  running: boolean;
  name: string;
  templateId: string | null;
  recipeId: string | null;
  everyMs: number;
  tickCount: number;
  maxTicks: number | null;
  tabId: string | null;
  url: string | null;
  startedAt: number;
}

export const NO_ONGOING_TASK: BerryOngoingTaskState = {
  taskId: "",
  running: false,
  name: "",
  templateId: null,
  recipeId: null,
  everyMs: 0,
  tickCount: 0,
  maxTicks: null,
  tabId: null,
  url: null,
  startedAt: 0,
};

export interface BerryTaskStartResult {
  ok: boolean;
  message: string;
  task: BerryOngoingTaskState;
  activeTasks: BerryOngoingTaskState[];
}

export interface BerryTaskStopResult {
  ok: boolean;
  stopped: boolean;
  stoppedCount: number;
  tickCount: number;
  message: string;
  activeTasks: BerryOngoingTaskState[];
}

export interface BerryTaskRunOnceResult {
  ok: boolean;
  message: string;
  templateId: string;
  result: Record<string, unknown>;
  activeTasks: BerryOngoingTaskState[];
}
