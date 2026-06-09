/** Shared URL normalization — used by main process and renderer address bar. */

export const NAVIGATION_ALIASES: Record<string, string> = {
  x: "https://x.com/home",
  twitter: "https://x.com/home",
  "x.com": "https://x.com/home",
  "twitter.com": "https://x.com/home",
  shorts: "https://www.youtube.com/shorts",
  "youtube shorts": "https://www.youtube.com/shorts",
  discord: "https://discord.com/register",
  "discord.com": "https://discord.com/register",
  tempmail: "https://temp-mail.org/en/",
  "temp-mail": "https://temp-mail.org/en/",
  tempmailo: "https://tempmailo.com/",
};

export const DEFAULT_SEARCH_ENGINE = "https://www.google.com/search?q=";

export function buildSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return DEFAULT_SEARCH_ENGINE;
  return `${DEFAULT_SEARCH_ENGINE}${encodeURIComponent(q)}`;
}

export interface NormalizeNavigationUrlOptions {
  /** Origin for dev paths like /demo/index.html */
  devServerOrigin?: string;
  /** Turn a path-like string into a loadable URL, or null to fall through. */
  resolvePathLike?: (normalizedPath: string) => string | null;
  /** Turn an absolute Windows path into a file URL, or null to fall through. */
  resolveWindowsPath?: (path: string) => string | null;
}

export function normalizeNavigationUrlCore(
  input: string,
  options: NormalizeNavigationUrlOptions = {},
): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const alias = NAVIGATION_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^file:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed.replace(/ /g, "%20")).href;
    } catch {
      return trimmed.replace(/ /g, "%20");
    }
  }

  const pathLike =
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    /^[a-zA-Z]:[\\/]/.test(trimmed);

  if (pathLike && !trimmed.startsWith("//")) {
    const normalizedPath = trimmed.startsWith("/")
      ? trimmed
      : trimmed.startsWith("./")
        ? trimmed.slice(1)
        : `/${trimmed.replace(/\\/g, "/")}`;

    const resolved = options.resolvePathLike?.(normalizedPath);
    if (resolved) return resolved;
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    const fileUrl = options.resolveWindowsPath?.(trimmed);
    if (fileUrl) return fileUrl;
  }

  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return `https://${trimmed.replace(/^\/\//, "")}`;
  }

  if (/^[a-z0-9-]+$/i.test(trimmed)) {
    return `https://www.${trimmed}.com`;
  }

  return buildSearchUrl(trimmed);
}
