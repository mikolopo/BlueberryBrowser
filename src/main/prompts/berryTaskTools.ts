import { dynamicTool, jsonSchema, type ToolSet } from "ai";
import type { OngoingTaskService } from "../actions/OngoingTaskService";
import {
  listActionTemplates,
  listIntervalTemplates,
  listOnceTemplates,
} from "../actions/ActionTemplates";

interface BerryTaskToolRuntime {
  ongoingTasks: OngoingTaskService | null;
}

export function appendBerryTaskTools(
  tools: ToolSet,
  runtime: BerryTaskToolRuntime,
): void {
  tools.berryTaskStart = dynamicTool({
    description:
      "Start a background interval task (scroll Shorts every N seconds, etc.). Returns immediately. " +
      "Multiple tasks CAN run together when concurrent=true (default). " +
      "Starting the same template again replaces only that task's interval. " +
      "For mute/unmute use berryTaskRunOnce — it does not stop scroll tasks. " +
      "Templates: youtube-shorts-next, scroll-down, scroll-down-key, page-down.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        templateId: {
          type: "string",
          description:
            "Interval template id (NOT youtube-toggle-mute — use berryTaskRunOnce for that)",
        },
        recipeIdOrName: {
          type: "string",
          description: "Or a saved action recipe name/id",
        },
        everyMs: {
          type: "number",
          description: "Ms between ticks (5000 = 5s, 10000 = 10s). Min 2000.",
        },
        maxTicks: {
          type: "number",
          description:
            "Optional max repetitions then auto-stop. Omit for unlimited.",
        },
        concurrent: {
          type: "boolean",
          description:
            "Default true — keep other running tasks. false = stop all others first.",
        },
      },
      required: ["everyMs"],
    }),
    execute: async (input) => {
      const service = runtime.ongoingTasks;
      if (!service) throw new Error("Ongoing task service unavailable");

      const { templateId, recipeIdOrName, everyMs, maxTicks, concurrent } =
        input as {
          templateId?: string;
          recipeIdOrName?: string;
          everyMs?: number;
          maxTicks?: number;
          concurrent?: boolean;
        };

      if (everyMs == null || !Number.isFinite(everyMs)) {
        throw new Error("everyMs is required (e.g. 5000 for 5 seconds)");
      }
      if (!templateId?.trim() && !recipeIdOrName?.trim()) {
        throw new Error("Provide templateId or recipeIdOrName");
      }

      return service.start({
        templateId: templateId?.trim(),
        recipeIdOrName: recipeIdOrName?.trim(),
        everyMs,
        maxTicks: maxTicks ?? null,
        concurrent: concurrent !== false,
      });
    },
  });

  tools.berryTaskRunOnce = dynamicTool({
    description:
      "Run a one-shot page action WITHOUT stopping background interval tasks. " +
      "Use for YouTube mute/unmute: templateId youtube-toggle-mute (presses M). " +
      "User says mute or unmute on Shorts → call this while scroll task keeps running. " +
      "Also: browserPressKey with key 'm' works the same on YouTube.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        templateId: {
          type: "string",
          description:
            "Once template: youtube-toggle-mute, youtube-volume-up, youtube-volume-down",
        },
      },
      required: ["templateId"],
    }),
    execute: async (input) => {
      const service = runtime.ongoingTasks;
      if (!service) throw new Error("Ongoing task service unavailable");
      const templateId = (input as { templateId?: string }).templateId?.trim();
      if (!templateId) throw new Error("Missing templateId");
      return service.runOnce({ templateId });
    },
  });

  tools.berryTaskStop = dynamicTool({
    description:
      "Stop background task(s). Omit templateId to stop ALL. " +
      "Pass templateId (e.g. youtube-shorts-next) to stop only scroll and keep others.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        templateId: {
          type: "string",
          description:
            "Optional — stop only this template/task id. Omit to stop all.",
        },
      },
    }),
    execute: async (input) => {
      const service = runtime.ongoingTasks;
      if (!service) throw new Error("Ongoing task service unavailable");
      const templateId = (input as { templateId?: string }).templateId?.trim();
      return service.stop(templateId);
    },
  });

  tools.berryTaskStatus = dynamicTool({
    description:
      "List running background tasks and available action templates.",
    inputSchema: jsonSchema({ type: "object", properties: {} }),
    execute: async () => {
      const service = runtime.ongoingTasks;
      return {
        activeTasks: service?.listTasks() ?? [],
        intervalTemplates: listIntervalTemplates().map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        })),
        onceTemplates: listOnceTemplates().map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        })),
        allTemplates: listActionTemplates().map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          once: Boolean(t.once),
        })),
      };
    },
  });
}
