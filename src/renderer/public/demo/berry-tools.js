/** Shared WebMCP bridge for Blueberry demo pages (works without native modelContext). */
window.__berryTools = window.__berryTools || {
  site: "unknown",
  tools: [],
  async execute() {
    throw new Error("Demo tools not initialized on this page.");
  },
};

window.__berryInitDemo = function initDemo(config) {
  window.__berryTools = {
    site: config.site || "Blueberry Demo",
    tools: config.tools || [],
    async execute(toolName, args) {
      if (typeof config.execute !== "function") {
        throw new Error("No execute handler for " + toolName);
      }
      return config.execute(toolName, args || {});
    },
  };

  const statusEl = document.getElementById("berry-status");
  if (statusEl) {
    statusEl.textContent =
      config.statusText ||
      "WebMCP ready — " + (config.tools?.length || 0) + " tools registered.";
  }
};
