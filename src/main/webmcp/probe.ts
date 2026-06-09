import type { WebMcpProbeResult } from "../../shared/webmcp-types";

// Injected WebMCP page-probing function
async function runWebMcpProbe(): Promise<WebMcpProbeResult> {
  const base = {
    supportsNative: false,
    origin: location.origin,
    url: location.href,
    tools: [] as any[],
  };

  const schemaFromForm = (form: HTMLFormElement) => {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    form.querySelectorAll("[name]").forEach((el: any) => {
      if (!("name" in el) || !el.name) return;
      const parentLabel = el.closest("label");
      let labelText = el.name;
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("input,select,textarea,button").forEach((node) => {
          node.remove();
        });
        labelText = clone.textContent?.trim() || el.name;
      }
      if (!labelText || labelText === el.name) {
        labelText = el.getAttribute("aria-label") || el.placeholder || el.name;
      }
      let type = "string";
      if (el.type === "number") type = "number";
      properties[el.name] = { type, description: labelText };
      if (el.required) required.push(el.name);
    });
    const schema: Record<string, any> = { type: "object", properties };
    if (required.length > 0) schema.required = required;
    return schema;
  };

  const mapTool = (tool: any, source: any) => ({
    name: String(tool.name || ""),
    description: String(tool.description || ""),
    inputSchema: tool.inputSchema && typeof tool.inputSchema === "object"
      ? tool.inputSchema
      : { type: "object", properties: {} },
    source,
  });

  const declarativeTools = Array.from(document.querySelectorAll("form[toolname]")).map(
    (form: any) =>
      mapTool(
        {
          name: form.getAttribute("toolname"),
          description: form.getAttribute("tooldescription") || "",
          inputSchema: schemaFromForm(form),
        },
        "declarative"
      )
  );

  const mergeTools = (baseTools: any[], extraTools: any[]) => {
    const merged = [...baseTools];
    for (const tool of extraTools || []) {
      if (!tool?.name) continue;
      const idx = merged.findIndex((t) => t.name === tool.name);
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...tool };
      } else {
        merged.push(tool);
      }
    }
    return merged;
  };

  const pageTools = (() => {
    try {
      const bt = (window as any).__berryTools;
      if (!bt) return [];
      const list = typeof bt.tools === "object" && Array.isArray(bt.tools) ? bt.tools : [];
      return list.map((t: any) =>
        mapTool(
          {
            name: t.name,
            description: t.description || "",
            inputSchema: t.inputSchema || { type: "object", properties: {} },
          },
          t.source === "native" ? "native" : "declarative"
        )
      );
    } catch {
      return [];
    }
  })();

  const allDeclarative = mergeTools(declarativeTools, pageTools);

  try {
    const mc = (navigator as any).modelContext ?? (navigator as any).modelContextTesting;
    if (mc && typeof mc.listTools === "function") {
      const listed = await mc.listTools();
      const nativeTools = (listed || []).map((t: any) => mapTool(t, "native"));
      const merged = mergeTools(allDeclarative, nativeTools);
      return {
        ...base,
        supportsNative: Boolean((navigator as any).modelContext),
        tools: merged,
      };
    }
  } catch (error) {
    return {
      ...base,
      tools: allDeclarative,
      error: String(error),
    };
  }

  return {
    ...base,
    tools: allDeclarative,
  };
}

export const WEBMCP_PROBE_SCRIPT = `(async () => {
  return await (${runWebMcpProbe.toString()})();
})()`;
