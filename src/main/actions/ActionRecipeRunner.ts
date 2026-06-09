import type {
  ActionRecipe,
  ActionRecipeRunResult,
  ActionStep,
} from "../../shared/action-recipe-types";
import type { BrowserActionContext } from "../navigation/browserActionExecutors";
import type { AgentActivityService } from "../agent/AgentActivityService";
import {
  execBrowserClick,
  execBrowserInspect,
  execBrowserKey,
  execBrowserNavigate,
  execBrowserScroll,
  execBrowserType,
  execBrowserWait,
} from "../navigation/browserActionExecutors";

export interface RunRecipeOptions {
  countMultiplier?: number;
  agentActivity?: AgentActivityService | null;
  tabId?: string;
  url?: string;
  isCancelled?: () => boolean;
}

export async function runActionRecipe(
  ctx: BrowserActionContext,
  recipe: ActionRecipe,
  options: RunRecipeOptions = {},
): Promise<ActionRecipeRunResult> {
  const logs: string[] = [];
  let stepsCompleted = 0;
  let stepsFailed = 0;
  let lastError: string | undefined;

  try {
    await runSteps(ctx, recipe.steps, logs, options, (ok) => {
      if (ok) stepsCompleted += 1;
      else stepsFailed += 1;
    });
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    logs.push(`ERROR: ${lastError}`);
  }

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    ok: !lastError && stepsFailed === 0,
    stepsCompleted,
    stepsFailed,
    logs,
    lastError,
  };
}

async function runSteps(
  ctx: BrowserActionContext,
  steps: ActionStep[],
  logs: string[],
  options: RunRecipeOptions,
  onStep: (ok: boolean) => void,
): Promise<void> {
  for (const step of steps) {
    if (options.isCancelled?.()) throw new Error("Agent run cancelled");
    const label = step.label ?? step.action;
    try {
      await runSingleStep(ctx, step, logs, options, onStep);
      logs.push(`OK: ${label}`);
      onStep(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logs.push(`FAIL: ${label} — ${msg}`);
      onStep(false);
      throw error;
    }
  }
}

async function runSingleStep(
  ctx: BrowserActionContext,
  step: ActionStep,
  logs: string[],
  options: RunRecipeOptions,
  onStep: (ok: boolean) => void,
): Promise<void> {
  switch (step.action) {
    case "navigate":
      await execBrowserNavigate(ctx, step.url);
      return;
    case "inspect":
      await execBrowserInspect(ctx);
      return;
    case "click":
      await execBrowserClick(ctx, step.selector);
      return;
    case "type":
      await execBrowserType(ctx, step.selector, step.text, step.pressEnter);
      return;
    case "scroll":
      await execBrowserScroll(ctx, step.direction, step.amount);
      return;
    case "key":
      await execBrowserKey(ctx, step.key);
      return;
    case "wait":
      await execBrowserWait(step.ms, options.isCancelled);
      return;
    case "repeat": {
      const count = Math.max(
        1,
        Math.floor(step.count * (options.countMultiplier ?? 1)),
      );
      for (let i = 0; i < count; i++) {
        logs.push(`repeat ${i + 1}/${count}`);
        await runSteps(ctx, step.steps, logs, options, onStep);
      }
      return;
    }
    case "interval": {
      const count = Math.max(
        1,
        Math.floor(step.count * (options.countMultiplier ?? 1)),
      );
      for (let i = 0; i < count; i++) {
        logs.push(`interval ${i + 1}/${count}`);
        options.agentActivity?.emit({
          kind: "tool_running",
          label: `Recipe step ${i + 1}/${count}…`,
          tabId: options.tabId,
          url: options.url,
        });
        await runSteps(ctx, step.steps, logs, options, onStep);
        if (i < count - 1)
          await execBrowserWait(step.everyMs, options.isCancelled);
      }
      return;
    }
    default:
      throw new Error("Unknown step action");
  }
}

/** Run a flat list of steps once (used by background Berry tasks). */
export async function runActionStepsOnce(
  ctx: BrowserActionContext,
  steps: ActionStep[],
  options: RunRecipeOptions = {},
): Promise<void> {
  const logs: string[] = [];
  await runSteps(ctx, steps, logs, options, () => {});
}
