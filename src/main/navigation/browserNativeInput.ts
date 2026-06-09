import type { Tab } from "../Tab";

const KEY_CODES: Record<string, string> = {
  ArrowDown: "Down",
  ArrowUp: "Up",
  PageDown: "PageDown",
  PageUp: "PageUp",
  Space: "Space",
  Enter: "Return",
  Escape: "Escape",
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function sendNativeKey(
  tab: Tab,
  key: string,
  options?: { focus?: boolean },
): Promise<void> {
  const keyCode = KEY_CODES[key] ?? key;
  const wc = tab.webContents;
  if (wc.isDestroyed()) throw new Error("Tab destroyed");

  if (options?.focus !== false) {
    wc.focus();
  }
  wc.sendInputEvent({ type: "keyDown", keyCode });
  await sleep(40);
  wc.sendInputEvent({ type: "keyUp", keyCode });
}

export async function sendNativeWheel(
  tab: Tab,
  deltaY: number,
  options?: { focus?: boolean },
): Promise<{ x: number; y: number; deltaY: number }> {
  const wc = tab.webContents;
  if (wc.isDestroyed()) throw new Error("Tab destroyed");

  const center = await tab.runJs(`(${runGetWindowCenter.toString()})()`);

  const x = typeof center?.x === "number" ? center.x : 400;
  const y = typeof center?.y === "number" ? center.y : 400;

  if (options?.focus !== false) {
    wc.focus();
  }
  wc.sendInputEvent({
    type: "mouseWheel",
    x,
    y,
    deltaX: 0,
    deltaY,
    wheelTicksX: 0,
    wheelTicksY: deltaY > 0 ? 1 : -1,
    accelerationRatioX: 1,
    accelerationRatioY: 1,
    hasPreciseScrollingDeltas: true,
    canScroll: true,
  });

  return { x, y, deltaY };
}

function runGetWindowCenter() {
  return {
    x: Math.floor(window.innerWidth / 2),
    y: Math.floor(window.innerHeight / 2),
  };
}
