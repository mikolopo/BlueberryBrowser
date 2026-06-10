import type { BerryOngoingTaskState } from "./berry-task-types";

export type AgentActivityKind =
  | "idle"
  | "thinking"
  | "navigating"
  | "reading_page"
  | "screenshot"
  | "tool_consent"
  | "tool_running"
  | "tool_done"
  | "tool_denied"
  | "clicking"
  | "responding";

export interface AgentActivityEvent {
  id: string;
  kind: AgentActivityKind;
  /** Short line for chat feed / topbar */
  label: string;
  detail?: string;
  tabId?: string;
  url?: string;
  toolName?: string;
  timestamp: number;
  /** CSS selector for cursor animation on the page */
  selector?: string;
  /**
   * Normalized click target position within the main browser window (0–1).
   * x=0 is left edge, x=1 is right edge; y=0 is top, y=1 is bottom.
   * Only present for `clicking` events when coordinates are known.
   */
  clickTarget?: { x: number; y: number };
}

export type AgentPlanStepStatus = "pending" | "in_progress" | "done" | "failed";

export interface AgentPlanStep {
  index: number;
  label: string;
  status: AgentPlanStepStatus;
}

export interface AgentPlanState {
  title: string;
  steps: AgentPlanStep[];
  updatedAt: number;
}

export interface AgentViewportState {
  isActive: boolean;
  tabId: string | null;
  url: string | null;
  title: string | null;
  currentKind: AgentActivityKind;
  currentLabel: string;
  spriteFrame: number;
  /** Primary summary for UI (first task or aggregate). */
  ongoingTask: BerryOngoingTaskState | null;
  /** All concurrent background tasks. */
  ongoingTasks: BerryOngoingTaskState[];
  /** Berry's current multi-step plan (checklist shown in sidebar). */
  plan: AgentPlanState | null;
  /** Last known click target (normalized 0–1). Present only during clicking events. */
  clickTarget?: { x: number; y: number };
}

export const IDLE_VIEWPORT: AgentViewportState = {
  isActive: false,
  tabId: null,
  url: null,
  title: null,
  currentKind: "idle",
  currentLabel: "Berry is idle",
  spriteFrame: 0,
  ongoingTask: null,
  ongoingTasks: [],
  plan: null,
};
