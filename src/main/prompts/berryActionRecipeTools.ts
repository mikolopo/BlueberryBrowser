import { dynamicTool, jsonSchema, type ToolSet } from "ai";
import type { ActionStep } from "../../shared/action-recipe-types";
import type { AgentActivityService } from "../agent/AgentActivityService";
import type { Window } from "../Window";
import { getActionRecipeStore } from "../actions/ActionRecipeStore";
import { runActionRecipe } from "../actions/ActionRecipeRunner";
import type { BrowserActionContext } from "../navigation/browserActionExecutors";

const STEP_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: [
        "navigate",
        "inspect",
        "click",
        "type",
        "scroll",
        "key",
        "wait",
        "repeat",
        "interval",
      ],
    },
    url: { type: "string" },
    selector: { type: "string" },
    text: { type: "string" },
    key: { type: "string" },
    direction: { type: "string", enum: ["up", "down"] },
    amount: { type: "number" },
    ms: { type: "number" },
    everyMs: { type: "number" },
    count: { type: "number" },
    pressEnter: { type: "boolean" },
    label: { type: "string" },
    steps: { type: "array", items: { type: "object" } },
  },
  required: ["action"],
};

interface RecipeToolRuntime {
  window: Window | null;
  agentActivity: AgentActivityService | null;
  isCancelled?: () => boolean;
}

export function appendActionRecipeTools(
  tools: ToolSet,
  runtime: RecipeToolRuntime,
  browserCtx: () => BrowserActionContext,
): void {
  const store = getActionRecipeStore();

  tools.actionRecipeSave = dynamicTool({
    description:
      "Save a reusable multi-step browser action (macro) for later. Steps: navigate, inspect, click, type, scroll, key, wait, repeat, interval. " +
      "Use after you figured out a flow (e.g. YouTube Shorts: key ArrowDown every 30s). Same name updates existing recipe.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Unique recipe name, e.g. youtube-shorts-next",
        },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        steps: { type: "array", items: STEP_SCHEMA, minItems: 1 },
      },
      required: ["name", "steps"],
    }),
    execute: async (input) => {
      const { name, description, tags, steps } = input as {
        name?: string;
        description?: string;
        tags?: string[];
        steps?: ActionStep[];
      };
      if (!name?.trim()) throw new Error("Missing name");
      if (!steps?.length) throw new Error("Missing steps");
      const recipe = store.save({ name, description, tags, steps });
      return {
        ok: true,
        id: recipe.id,
        name: recipe.name,
        stepCount: recipe.steps.length,
        message: `Saved action recipe "${recipe.name}" (${recipe.steps.length} steps)`,
      };
    },
  });

  tools.actionRecipeList = dynamicTool({
    description: "List all saved action recipes (macros) available to run.",
    inputSchema: jsonSchema({ type: "object", properties: {} }),
    execute: async () => ({
      recipes: store.listSummaries(),
    }),
  });

  tools.actionRecipeRun = dynamicTool({
    description:
      "Run a saved action recipe by name or id. Use countOverride to run more/fewer interval ticks (e.g. scroll shorts 10 times).",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        idOrName: { type: "string" },
        countOverride: {
          type: "number",
          description:
            "Multiply interval/repeat counts (e.g. 10 for scroll 10 times)",
        },
      },
      required: ["idOrName"],
    }),
    execute: async (input) => {
      const { idOrName, countOverride } = input as {
        idOrName?: string;
        countOverride?: number;
      };
      if (!idOrName?.trim()) throw new Error("Missing idOrName");
      const recipe = store.getById(idOrName) ?? store.getByName(idOrName);
      if (!recipe) throw new Error(`Recipe not found: ${idOrName}`);

      runtime.agentActivity?.emit({
        kind: "tool_running",
        label: `Running: ${recipe.name}`,
        tabId: runtime.window?.activeTab?.id,
        url: runtime.window?.activeTab?.url,
      });

      return runActionRecipe(browserCtx(), recipe, {
        countMultiplier: countOverride,
        agentActivity: runtime.agentActivity,
        tabId: runtime.window?.activeTab?.id,
        url: runtime.window?.activeTab?.url,
        isCancelled: runtime.isCancelled,
      });
    },
  });

  tools.actionRecipeDelete = dynamicTool({
    description: "Delete a saved action recipe by name or id.",
    inputSchema: jsonSchema({
      type: "object",
      properties: { idOrName: { type: "string" } },
      required: ["idOrName"],
    }),
    execute: async (input) => {
      const idOrName = (input as { idOrName?: string }).idOrName?.trim();
      if (!idOrName) throw new Error("Missing idOrName");
      const ok = store.delete(idOrName);
      if (!ok) throw new Error(`Recipe not found: ${idOrName}`);
      return { ok: true, deleted: idOrName };
    },
  });
}
