import { is } from "@electron-toolkit/utils";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeNavigationUrlCore } from "../shared/navigationUrlCore";

export { buildSearchUrl } from "../shared/navigationUrlCore";

const getDevServerOrigin = (): string => {
  const base = process.env.ELECTRON_RENDERER_URL;
  if (base) {
    try {
      return new URL(base).origin;
    } catch {
      /* fall through */
    }
  }
  return "http://localhost:5173";
};

const getRendererRoot = (): string => {
  const mainDir = dirname(fileURLToPath(import.meta.url));
  return join(mainDir, "../renderer");
};

/** Normalize navigation targets in main process (handles local paths reliably). */
export function normalizeNavigationUrl(input: string): string {
  return normalizeNavigationUrlCore(input, {
    devServerOrigin: getDevServerOrigin(),
    resolvePathLike: (normalizedPath) => {
      if (is.dev || process.env.ELECTRON_RENDERER_URL) {
        const path = normalizedPath.startsWith("/")
          ? normalizedPath
          : `/${normalizedPath}`;
        return `${getDevServerOrigin()}${path}`;
      }

      const relative = normalizedPath.replace(/^\//, "");
      const filePath = join(getRendererRoot(), relative);
      if (existsSync(filePath)) {
        return pathToFileURL(filePath).href;
      }
      return null;
    },
    resolveWindowsPath: (path) => {
      if (existsSync(path)) {
        return pathToFileURL(path).href;
      }
      return null;
    },
  });
}
