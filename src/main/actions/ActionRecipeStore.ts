import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ActionRecipe,
  ActionRecipeSummary,
  ActionStep,
} from "../../shared/action-recipe-types";

const MAX_RECIPES = 100;
const MAX_STEPS_PER_RECIPE = 80;

let storeInstance: ActionRecipeStore | null = null;

export function getActionRecipeStore(): ActionRecipeStore {
  if (!storeInstance) {
    storeInstance = new ActionRecipeStore();
  }
  return storeInstance;
}

export class ActionRecipeStore {
  private recipes = new Map<string, ActionRecipe>();
  private readonly filePath: string;

  constructor() {
    this.filePath = join(app.getPath("userData"), "berry-action-recipes.json");
    this.load();
  }

  listSummaries(): ActionRecipeSummary[] {
    return [...this.recipes.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        tags: r.tags,
        stepCount: r.steps.length,
        updatedAt: r.updatedAt,
      }));
  }

  getById(id: string): ActionRecipe | null {
    return this.recipes.get(id) ?? null;
  }

  getByName(name: string): ActionRecipe | null {
    const key = name.trim().toLowerCase();
    for (const recipe of this.recipes.values()) {
      if (recipe.name.toLowerCase() === key) return recipe;
    }
    return null;
  }

  save(input: {
    name: string;
    description?: string;
    tags?: string[];
    steps: ActionStep[];
    id?: string;
  }): ActionRecipe {
    const name = input.name.trim();
    if (!name) throw new Error("Recipe name is required");
    const steps = validateSteps(input.steps);
    const now = Date.now();

    const existing = input.id
      ? this.recipes.get(input.id)
      : this.getByName(name);
    if (existing) {
      const updated: ActionRecipe = {
        ...existing,
        name,
        description: input.description?.trim() || existing.description,
        tags: input.tags ?? existing.tags,
        steps,
        updatedAt: now,
      };
      this.recipes.set(existing.id, updated);
      this.persist();
      return updated;
    }

    if (this.recipes.size >= MAX_RECIPES) {
      throw new Error(`Maximum ${MAX_RECIPES} saved action recipes reached`);
    }

    const recipe: ActionRecipe = {
      id: randomUUID(),
      name,
      description: input.description?.trim(),
      tags: input.tags ?? [],
      steps,
      createdAt: now,
      updatedAt: now,
    };
    this.recipes.set(recipe.id, recipe);
    this.persist();
    return recipe;
  }

  delete(idOrName: string): boolean {
    const byId = this.recipes.get(idOrName);
    if (byId) {
      this.recipes.delete(idOrName);
      this.persist();
      return true;
    }
    const byName = this.getByName(idOrName);
    if (byName) {
      this.recipes.delete(byName.id);
      this.persist();
      return true;
    }
    return false;
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as { recipes?: ActionRecipe[] };
      for (const recipe of parsed.recipes ?? []) {
        if (recipe?.id && recipe?.name && Array.isArray(recipe.steps)) {
          this.recipes.set(recipe.id, {
            ...recipe,
            tags: recipe.tags ?? [],
            steps: validateSteps(recipe.steps),
          });
        }
      }
    } catch {
      /* start fresh */
    }
  }

  private persist(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      this.filePath,
      JSON.stringify({ recipes: [...this.recipes.values()] }, null, 2),
      "utf8",
    );
  }
}

function validateSteps(steps: unknown): ActionStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Recipe must include at least one step");
  }
  if (steps.length > MAX_STEPS_PER_RECIPE) {
    throw new Error(`Maximum ${MAX_STEPS_PER_RECIPE} steps per recipe`);
  }
  return steps.map((s, i) => normalizeStep(s, i));
}

function normalizeStep(raw: unknown, index: number): ActionStep {
  if (!raw || typeof raw !== "object" || !("action" in raw)) {
    throw new Error(`Invalid step at index ${index}`);
  }
  const step = raw as Record<string, unknown>;
  const action = step.action;

  switch (action) {
    case "navigate":
      if (typeof step.url !== "string" || !step.url.trim()) {
        throw new Error(`Step ${index}: navigate requires url`);
      }
      return { action, url: step.url.trim(), label: strLabel(step.label) };
    case "inspect":
      return { action, label: strLabel(step.label) };
    case "click":
      if (typeof step.selector !== "string") {
        throw new Error(`Step ${index}: click requires selector`);
      }
      return { action, selector: step.selector, label: strLabel(step.label) };
    case "type":
      if (typeof step.selector !== "string" || typeof step.text !== "string") {
        throw new Error(`Step ${index}: type requires selector and text`);
      }
      return {
        action,
        selector: step.selector,
        text: step.text,
        pressEnter: Boolean(step.pressEnter),
        label: strLabel(step.label),
      };
    case "scroll":
      return {
        action,
        direction: step.direction === "up" ? "up" : "down",
        amount: typeof step.amount === "number" ? step.amount : undefined,
        label: strLabel(step.label),
      };
    case "key":
      if (typeof step.key !== "string" || !step.key.trim()) {
        throw new Error(`Step ${index}: key requires key name`);
      }
      return { action, key: step.key.trim(), label: strLabel(step.label) };
    case "wait": {
      const ms = typeof step.ms === "number" ? step.ms : 1000;
      return {
        action,
        ms: clamp(ms, 100, 120_000),
        label: strLabel(step.label),
      };
    }
    case "repeat": {
      const count = typeof step.count === "number" ? step.count : 1;
      return {
        action,
        count: clamp(Math.floor(count), 1, 50),
        steps: validateSteps(step.steps),
        label: strLabel(step.label),
      };
    }
    case "interval": {
      const everyMs = typeof step.everyMs === "number" ? step.everyMs : 1000;
      const count = typeof step.count === "number" ? step.count : 1;
      return {
        action,
        everyMs: clamp(everyMs, 500, 120_000),
        count: clamp(Math.floor(count), 1, 120),
        steps: validateSteps(step.steps),
        label: strLabel(step.label),
      };
    }
    default:
      throw new Error(`Step ${index}: unknown action "${String(action)}"`);
  }
}

function strLabel(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
