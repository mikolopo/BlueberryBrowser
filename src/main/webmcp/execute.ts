import type { WebContents } from "electron";
import type { WebMcpToolSource } from "../../shared/webmcp-types";

// Injected WebMCP tool executor function
async function runExecuteWebMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  source: WebMcpToolSource,
) {
  if (
    (window as any).__berryTools &&
    typeof (window as any).__berryTools.execute === "function"
  ) {
    return await (window as any).__berryTools.execute(toolName, args);
  }

  if (source === "native") {
    const mc =
      (navigator as any).modelContext ?? (navigator as any).modelContextTesting;
    if (mc && typeof mc.executeTool === "function") {
      return await mc.executeTool(toolName, args);
    }
  }

  const form = document.querySelector(
    'form[toolname="' + toolName.replace(/"/g, "") + '"]',
  ) as HTMLFormElement | null;
  if (!form) {
    throw new Error("Tool not found on page: " + toolName);
  }

  for (const [key, value] of Object.entries(args)) {
    const field = form.querySelector('[name="' + key.replace(/"/g, "") + '"]') as any;
    if (field && "value" in field) {
      field.value = value == null ? "" : String(value);
    }
  }

  const collected: Record<string, string> = {};
  form.querySelectorAll("[name]").forEach((el: any) => {
    if ("name" in el && "value" in el && el.name) {
      collected[el.name] = el.value;
    }
  });

  return {
    ok: true,
    tool: toolName,
    input: collected,
    note: "Form filled; page handler missing.",
  };
}

export const executeWebMcpTool = async (
  webContents: WebContents,
  toolName: string,
  args: Record<string, unknown>,
  source: WebMcpToolSource,
): Promise<unknown> => {
  if (webContents.isDestroyed()) {
    throw new Error("Tab was closed");
  }

  const script = `(async () => {
    return await (${runExecuteWebMcpTool.toString()})(
      ${JSON.stringify(toolName)},
      ${JSON.stringify(args ?? {})},
      ${JSON.stringify(source)}
    );
  })()`;

  return webContents.executeJavaScript(script);
};
