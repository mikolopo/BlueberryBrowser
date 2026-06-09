export type ActionStepType =
  | "navigate"
  | "inspect"
  | "click"
  | "type"
  | "scroll"
  | "key"
  | "wait"
  | "repeat"
  | "interval";

export interface ActionStepBase {
  action: ActionStepType;
  label?: string;
}

export interface NavigateStep extends ActionStepBase {
  action: "navigate";
  url: string;
}

export interface InspectStep extends ActionStepBase {
  action: "inspect";
}

export interface ClickStep extends ActionStepBase {
  action: "click";
  selector: string;
}

export interface TypeStep extends ActionStepBase {
  action: "type";
  selector: string;
  text: string;
  pressEnter?: boolean;
}

export interface ScrollStep extends ActionStepBase {
  action: "scroll";
  direction: "up" | "down";
  /** wheel pixels (default 720) */
  amount?: number;
}

export interface KeyStep extends ActionStepBase {
  action: "key";
  /** e.g. ArrowDown, PageDown, Space */
  key: string;
}

export interface WaitStep extends ActionStepBase {
  action: "wait";
  ms: number;
}

export interface RepeatStep extends ActionStepBase {
  action: "repeat";
  count: number;
  steps: ActionStep[];
}

export interface IntervalStep extends ActionStepBase {
  action: "interval";
  everyMs: number;
  count: number;
  steps: ActionStep[];
}

export type ActionStep =
  | NavigateStep
  | InspectStep
  | ClickStep
  | TypeStep
  | ScrollStep
  | KeyStep
  | WaitStep
  | RepeatStep
  | IntervalStep;

export interface ActionRecipe {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  steps: ActionStep[];
  createdAt: number;
  updatedAt: number;
}

export interface ActionRecipeSummary {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  stepCount: number;
  updatedAt: number;
}

export interface ActionRecipeRunResult {
  recipeId: string;
  recipeName: string;
  ok: boolean;
  stepsCompleted: number;
  stepsFailed: number;
  logs: string[];
  lastError?: string;
}
