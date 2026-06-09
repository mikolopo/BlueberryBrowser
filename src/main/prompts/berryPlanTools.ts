import { dynamicTool, jsonSchema, type ToolSet } from "ai";
import type { AgentActivityService } from "../agent/AgentActivityService";

interface BerryPlanToolRuntime {
  agentActivity: AgentActivityService | null;
}

export function appendBerryPlanTools(
  tools: ToolSet,
  runtime: BerryPlanToolRuntime,
): void {
  tools.berryPlanSet = dynamicTool({
    description:
      "Show the user a visible step checklist for a multi-step task (signup flows, multi-site pipelines, 3+ phases). " +
      "Call this FIRST, before navigating. Step 1 is auto-marked in_progress. " +
      "Replaces any previous plan. Keep steps short (3-7 items) and structured.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        title: {
          type: "string",
          description:
            'Short task title, e.g. "Domino\'s account via temp mail"',
        },
        steps: {
          type: "array",
          items: { type: "string" },
          description:
            'Ordered structured step labels. Each step MUST explicitly mention the active tab and data action/validation, e.g. ["Tab 1: Get temp email, copy/validate email address", "Tab 2: Open dominos.pl, paste email/submit form", ...]',
        },
      },
      required: ["title", "steps"],
    }),
    execute: async (input) => {
      const service = runtime.agentActivity;
      if (!service) throw new Error("Agent activity service unavailable");
      const { title, steps } = input as { title?: string; steps?: string[] };
      const labels = (steps ?? []).map((s) => String(s).trim()).filter(Boolean);
      if (!title?.trim() || labels.length === 0) {
        throw new Error("Provide title and at least one step");
      }
      const plan = service.setPlan(title, labels.slice(0, 15));
      return { ok: true, plan };
    },
  });

  tools.berryPlanUpdate = dynamicTool({
    description:
      "Update one step of the visible plan checklist. Mark done as soon as a phase finishes, failed if blocked. " +
      "Completing a step auto-starts the next pending one. Use stepIndex from berryPlanSet result (0-based).",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        stepIndex: { type: "number", description: "0-based step index" },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "done", "failed"],
        },
      },
      required: ["stepIndex", "status"],
    }),
    execute: async (input) => {
      const service = runtime.agentActivity;
      if (!service) throw new Error("Agent activity service unavailable");
      const { stepIndex, status } = input as {
        stepIndex?: number;
        status?: "pending" | "in_progress" | "done" | "failed";
      };
      if (stepIndex == null || !Number.isInteger(stepIndex) || stepIndex < 0) {
        throw new Error("stepIndex must be a non-negative integer");
      }
      if (!status) throw new Error("Missing status");
      const plan = service.updatePlanStep(stepIndex, status);
      if (!plan)
        return { ok: false, error: "No active plan — call berryPlanSet first" };
      return { ok: true, plan };
    },
  });

  tools.berryPlanStepInsert = dynamicTool({
    description:
      "Insert/append a new step to the active plan checklist on the go when new requirements or steps pop up. " +
      "Use index to place it at a specific position (optional, defaults to the end of the plan).",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        label: {
          type: "string",
          description:
            "Step action/validation label (e.g. 'Tab 1: Check checkbox X and verify state')",
        },
        index: {
          type: "number",
          description:
            "Optional 0-based index where the step should be inserted (defaults to end of plan)",
        },
      },
      required: ["label"],
    }),
    execute: async (input) => {
      const service = runtime.agentActivity;
      if (!service) throw new Error("Agent activity service unavailable");
      const { label, index } = input as { label?: string; index?: number };
      if (!label?.trim()) throw new Error("Missing label");
      const plan = service.insertPlanStep(index, label);
      if (!plan)
        return { ok: false, error: "No active plan — call berryPlanSet first" };
      return { ok: true, plan };
    },
  });

  tools.berryPlanStepDelete = dynamicTool({
    description:
      "Delete a step from the active plan checklist on the go if it becomes redundant or unnecessary. " +
      "Takes the 0-based stepIndex of the step to delete.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        stepIndex: {
          type: "number",
          description: "0-based step index to delete",
        },
      },
      required: ["stepIndex"],
    }),
    execute: async (input) => {
      const service = runtime.agentActivity;
      if (!service) throw new Error("Agent activity service unavailable");
      const { stepIndex } = input as { stepIndex?: number };
      if (stepIndex == null || !Number.isInteger(stepIndex) || stepIndex < 0) {
        throw new Error("stepIndex must be a non-negative integer");
      }
      const plan = service.deletePlanStep(stepIndex);
      if (!plan)
        return { ok: false, error: "No active plan — call berryPlanSet first" };
      return { ok: true, plan };
    },
  });
}
