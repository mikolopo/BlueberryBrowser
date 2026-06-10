/** Shared WebMCP bridge for Blueberry demo pages (works without native modelContext). */
window.__berryTools = window.__berryTools || {
  site: "unknown",
  tools: [],
  async execute() {
    throw new Error("Demo tools not initialized on this page.");
  },
};

window.__berryInitDemo = function initDemo(config) {
  // Setup overlay styles for the confirmation dialog
  if (!document.getElementById("webmcp-dialog-styles")) {
    const style = document.createElement("style");
    style.id = "webmcp-dialog-styles";
    style.textContent = `
      .webmcp-confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .webmcp-confirm-card {
        background: #182232;
        border: 1px solid #2d3c54;
        border-radius: 12px;
        width: 100%;
        max-width: 420px;
        padding: 1.5rem;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
        color: #f0f6fc;
      }
      .webmcp-confirm-title {
        font-size: 1.25rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        color: #38bdf8;
      }
      .webmcp-confirm-body {
        font-size: 0.9rem;
        color: #94a3b8;
        line-height: 1.5;
        margin-bottom: 1.25rem;
      }
      .webmcp-confirm-args {
        background: #0f172a;
        padding: 0.75rem;
        border-radius: 6px;
        font-family: monospace;
        font-size: 0.8rem;
        color: #cbd5e1;
        margin-bottom: 1.5rem;
        max-height: 150px;
        overflow-y: auto;
      }
      .webmcp-confirm-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      .webmcp-confirm-btn {
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        border: none;
        transition: opacity 0.2s;
      }
      .webmcp-confirm-btn:hover {
        opacity: 0.9;
      }
      .webmcp-confirm-btn.cancel {
        background: #374151;
        color: #f3f4f6;
      }
      .webmcp-confirm-btn.confirm {
        background: #38bdf8;
        color: #071018;
      }
    `;
    document.head.appendChild(style);
  }

  window.__berryTools = {
    site: config.site || "Blueberry Demo",
    tools: config.tools || [],
    async execute(toolName, args) {
      if (typeof config.execute !== "function") {
        throw new Error("No execute handler for " + toolName);
      }

      // Check if this is a sensitive action that requires user confirmation
      const sensitiveTools = ["bookFlight", "checkout"];
      if (sensitiveTools.includes(toolName)) {
        const confirmed = await new Promise((resolve) => {
          const overlay = document.createElement("div");
          overlay.className = "webmcp-confirm-overlay";

          const card = document.createElement("div");
          card.className = "webmcp-confirm-card";

          const title = document.createElement("div");
          title.className = "webmcp-confirm-title";
          title.textContent = `⚠️ Confirm ${toolName === "bookFlight" ? "Flight Booking" : "Checkout"}`;

          const body = document.createElement("div");
          body.className = "webmcp-confirm-body";
          body.textContent = `The AI Agent is requesting to perform a sensitive transaction on ${config.site || "this page"}. Please confirm the parameters below:`;

          const argsPre = document.createElement("pre");
          argsPre.className = "webmcp-confirm-args";
          argsPre.textContent = JSON.stringify(args, null, 2);

          const buttons = document.createElement("div");
          buttons.className = "webmcp-confirm-buttons";

          const cancelBtn = document.createElement("button");
          cancelBtn.className = "webmcp-confirm-btn cancel";
          cancelBtn.textContent = "Deny & Stop";
          cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
            resolve(false);
          };

          const confirmBtn = document.createElement("button");
          confirmBtn.className = "webmcp-confirm-btn confirm";
          confirmBtn.textContent = "Confirm & Proceed";
          confirmBtn.onclick = () => {
            document.body.removeChild(overlay);
            resolve(true);
          };

          buttons.appendChild(cancelBtn);
          buttons.appendChild(confirmBtn);
          card.appendChild(title);
          card.appendChild(body);
          card.appendChild(argsPre);
          card.appendChild(buttons);
          overlay.appendChild(card);
          document.body.appendChild(overlay);
        });

        if (!confirmed) {
          throw new Error(`User canceled the sensitive action: ${toolName}`);
        }
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
