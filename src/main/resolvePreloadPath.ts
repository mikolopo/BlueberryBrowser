import { existsSync } from "node:fs";
import { join } from "node:path";

/** Resolve preload script path across dev (.js) and production ESM (.mjs) builds. */
export const resolvePreloadPath = (name: "topbar" | "sidebar"): string => {
  const base = join(__dirname, "../preload", name);
  const mjsPath = `${base}.mjs`;
  if (existsSync(mjsPath)) return mjsPath;
  return `${base}.js`;
};
