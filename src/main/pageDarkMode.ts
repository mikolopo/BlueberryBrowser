import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import type { WebContents } from "electron";

const nodeRequire = createRequire(import.meta.url);

const DARKREADER_THEME = {
  mode: 1 as const,
  brightness: 100,
  contrast: 90,
  sepia: 0,
  grayscale: 0,
};

function runToggleDarkReader(isDark: boolean, theme: any) {
  try {
    if (isDark) {
      (window as any).DarkReader.enable(theme);
    } else {
      (window as any).DarkReader.disable();
    }
    (window as any).__blueberryPageDarkMode = isDark;
    if (document.documentElement) {
      document.documentElement.dataset.blueberryPageTheme = isDark
        ? "dark"
        : "light";
    }
    return true;
  } catch (e) {
    console.error("[Blueberry] Dark Reader toggle failed", e);
    return false;
  }
}

function runDisableDarkReader() {
  try {
    if (
      typeof (window as any).DarkReader !== "undefined" &&
      (window as any).DarkReader.isEnabled()
    ) {
      (window as any).DarkReader.disable();
    }
    (window as any).__blueberryPageDarkMode = false;
    if (document.documentElement) {
      delete document.documentElement.dataset.blueberryPageTheme;
    }
  } catch (e) {
    console.error("[Blueberry] Dark Reader disable failed", e);
  }
}

const TOGGLE_SCRIPT = `(function(isDark, theme) {
  return (${runToggleDarkReader.toString()})(isDark, theme);
})`;

const DISABLE_SCRIPT = `(${runDisableDarkReader.toString()})()`;

let cachedBundle: string | null = null;

function resolveDarkReaderBundlePath(): string {
  const bundled = join(
    fileURLToPath(
      new URL("../../resources/darkreader/darkreader.js", import.meta.url),
    ),
  );
  if (existsSync(bundled)) {
    return bundled;
  }

  if (app.isPackaged) {
    const resourcePath = join(
      process.resourcesPath,
      "darkreader",
      "darkreader.js",
    );
    if (existsSync(resourcePath)) {
      return resourcePath;
    }
  }

  return nodeRequire.resolve("darkreader/darkreader.js");
}

function getDarkReaderBundle(): string {
  if (!cachedBundle) {
    cachedBundle = readFileSync(resolveDarkReaderBundlePath(), "utf8");
  }
  return cachedBundle;
}

export function shouldApplyPageDarkMode(url: string): boolean {
  if (!url || url === "about:blank") {
    return false;
  }

  const blockedSchemes = ["devtools:", "chrome:", "chrome-extension:"];
  if (blockedSchemes.some((s) => url.startsWith(s))) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:" && /\/demo\//i.test(parsed.pathname)) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

async function ensureDarkReaderLoaded(
  webContents: WebContents,
): Promise<boolean> {
  if (webContents.isDestroyed()) {
    return false;
  }

  const alreadyLoaded = await webContents.executeJavaScript(
    "typeof DarkReader !== 'undefined'",
    true,
  );

  if (alreadyLoaded) {
    return true;
  }

  const bundle = getDarkReaderBundle();
  await webContents.executeJavaScript(bundle, true);

  return webContents.executeJavaScript(
    "typeof DarkReader !== 'undefined'",
    true,
  );
}

async function disableDarkReaderOnPage(
  webContents: WebContents,
): Promise<void> {
  if (webContents.isDestroyed()) {
    return;
  }

  try {
    await webContents.executeJavaScript(DISABLE_SCRIPT, true);
  } catch {
    /* page may not be ready */
  }
}

/**
 * @param forceDarkReader — when true and isDark, apply Dark Reader (Force darkMode setting).
 * When false, only disables Dark Reader if it was active; native prefers-color-scheme handles pages.
 */
export async function applyPageDarkMode(
  webContents: WebContents,
  isDark: boolean,
  forceDarkReader: boolean,
): Promise<void> {
  if (webContents.isDestroyed()) {
    return;
  }

  const url = webContents.getURL();

  if (!forceDarkReader || !isDark) {
    if (shouldApplyPageDarkMode(url)) {
      await disableDarkReaderOnPage(webContents);
    }
    return;
  }

  if (!shouldApplyPageDarkMode(url)) {
    return;
  }

  try {
    const loaded = await ensureDarkReaderLoaded(webContents);
    if (!loaded) {
      console.warn("[Blueberry] Dark Reader bundle failed to load on", url);
      return;
    }

    const themeJson = JSON.stringify(DARKREADER_THEME);
    await webContents.executeJavaScript(
      `${TOGGLE_SCRIPT}(true, ${themeJson});`,
      true,
    );
  } catch (error) {
    console.warn("[Blueberry] applyPageDarkMode failed:", error);
  }
}

export async function applyPageDarkModeWithRetry(
  webContents: WebContents,
  isDark: boolean,
  forceDarkReader: boolean,
  delaysMs: number[] = [0, 120, 400],
): Promise<void> {
  for (const delay of delaysMs) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (webContents.isDestroyed()) {
      return;
    }
    await applyPageDarkMode(webContents, isDark, forceDarkReader);
  }
}
