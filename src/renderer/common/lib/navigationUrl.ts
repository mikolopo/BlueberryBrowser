import { normalizeNavigationUrlCore } from "@shared/navigationUrlCore";

/** Normalize user input from the address bar into a loadable URL. */
export function normalizeNavigationUrl(input: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:5173";

  return normalizeNavigationUrlCore(input, {
    devServerOrigin: origin,
    resolvePathLike: (normalizedPath) => {
      const path = normalizedPath.startsWith("/")
        ? normalizedPath
        : `/${normalizedPath}`;
      return `${origin}${path}`;
    },
  });
}
