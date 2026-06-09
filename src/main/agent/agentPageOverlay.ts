/**
 * agentPageOverlay.ts
 * Injects a transparent overlay into the active page tab when the agent is working.
 * Shows a highlighted border around the element being clicked/inspected.
 * All styling is done inline via injected JS — no external assets needed.
 */

import type { Tab } from "../Tab";

const OVERLAY_ID = "blueberry-agent-overlay";
const HIGHLIGHT_ID = "blueberry-agent-highlight";

// Injected function for showing overlay
function runShowOverlay(overlayId: string) {
  let overlay = document.getElementById(overlayId);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:100vw",
      "height:100vh",
      "background:rgba(0,0,0,0.18)",
      "z-index:2147483640",
      "pointer-events:none",
      "transition:background 0.3s ease",
    ].join(";");
    document.body.appendChild(overlay);
  }
  overlay.style.display = "block";
  overlay.style.background = "rgba(0,0,0,0.18)";
}

// Injected function for hiding overlay
function runHideOverlay(overlayId: string, highlightId: string) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.style.display = "none";
  const hl = document.getElementById(highlightId);
  if (hl) hl.remove();
}

// Injected function for highlighting element
function runHighlightElement(selector: string, color: string, highlightId: string) {
  function findEl(s: string): HTMLElement | null {
    const el = document.querySelector(s);
    if (el) return el as HTMLElement;
    try {
      const iframes = document.querySelectorAll("iframe");
      for (let f = 0; f < iframes.length; f++) {
        try {
          const doc = iframes[f].contentDocument || iframes[f].contentWindow?.document;
          if (doc) {
            const sub = doc.querySelector(s);
            if (sub) return sub as HTMLElement;
          }
        } catch {}
      }
    } catch {}
    return null;
  }

  const el = findEl(selector);
  if (!el) return;

  // Scroll it into view so the highlight is visible
  try {
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as any });
  } catch {}

  const rect = el.getBoundingClientRect();
  let hl = document.getElementById(highlightId);
  if (!hl) {
    hl = document.createElement("div");
    hl.id = highlightId;
    hl.style.cssText = [
      "position:fixed",
      "z-index:2147483645",
      "pointer-events:none",
      "border-radius:4px",
      "box-sizing:border-box",
      "transition:all 0.15s ease",
    ].join(";");
    document.body.appendChild(hl);
  }

  const padding = 3;
  hl.style.left = (rect.left - padding) + "px";
  hl.style.top = (rect.top - padding) + "px";
  hl.style.width = (rect.width + padding * 2) + "px";
  hl.style.height = (rect.height + padding * 2) + "px";
  hl.style.border = "2.5px solid " + color;
  hl.style.background = color + "18";
  hl.style.boxShadow = "0 0 0 4px " + color + "28, 0 2px 12px rgba(0,0,0,0.18)";
  hl.style.display = "block";

  // Pulse animation
  hl.style.animation = "none";
  void hl.offsetWidth; // reflow
  let styleTag = document.getElementById("blueberry-highlight-keyframes");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "blueberry-highlight-keyframes";
    styleTag.textContent = "@keyframes blueberry-hl-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }";
    document.head.appendChild(styleTag);
  }
  hl.style.animation = "blueberry-hl-pulse 1s ease-in-out 3";
}

// Injected function for clearing highlight
function runClearHighlight(highlightId: string) {
  const hl = document.getElementById(highlightId);
  if (hl) hl.remove();
}

/** Show the semi-transparent page-level overlay. Idempotent — safe to call repeatedly. */
export async function showAgentPageOverlay(tab: Tab): Promise<void> {
  if (!tab || tab.webContents.isDestroyed()) return;
  try {
    await tab.runJs(`(${runShowOverlay.toString()})(${JSON.stringify(OVERLAY_ID)})`);
  } catch {
    /* page may not be ready — non-fatal */
  }
}

/** Hide the overlay (keeps DOM element for fast re-show). */
export async function hideAgentPageOverlay(tab: Tab): Promise<void> {
  if (!tab || tab.webContents.isDestroyed()) return;
  try {
    await tab.runJs(`(${runHideOverlay.toString()})(${JSON.stringify(OVERLAY_ID)}, ${JSON.stringify(HIGHLIGHT_ID)})`);
  } catch {
    /* non-fatal */
  }
}

/**
 * Highlight a specific element on the page by CSS selector.
 * Draws a colored border box positioned exactly over the element.
 * Pass null/undefined to clear any existing highlight.
 */
export async function highlightAgentElement(
  tab: Tab,
  selector: string | null | undefined,
  color = "#6366f1",
): Promise<void> {
  if (!tab || tab.webContents.isDestroyed()) return;
  if (!selector) {
    await clearAgentHighlight(tab);
    return;
  }
  try {
    await tab.runJs(
      `(${runHighlightElement.toString()})(${JSON.stringify(selector)}, ${JSON.stringify(color)}, ${JSON.stringify(HIGHLIGHT_ID)})`,
    );
  } catch {
    /* non-fatal */
  }
}

/** Remove the highlight box. */
export async function clearAgentHighlight(tab: Tab): Promise<void> {
  if (!tab || tab.webContents.isDestroyed()) return;
  try {
    await tab.runJs(`(${runClearHighlight.toString()})(${JSON.stringify(HIGHLIGHT_ID)})`);
  } catch {
    /* non-fatal */
  }
}
