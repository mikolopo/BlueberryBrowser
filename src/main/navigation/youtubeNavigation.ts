const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function isValidYouTubeVideoId(
  id: string | null | undefined,
): id is string {
  return typeof id === "string" && YOUTUBE_VIDEO_ID_RE.test(id);
}

export function buildYouTubeSearchUrl(query: string): string {
  const q = query.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export interface YouTubeWatchLink {
  id: string;
  title: string;
  url: string;
}

export interface PageNavigationSignals {
  pageTitle: string | null;
  youtubeUnavailable: boolean;
  youtubeWatchLinks: YouTubeWatchLink[];
}

export function extractYouTubeVideoIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return isValidYouTubeVideoId(id) ? id : null;
    }
    if (host.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (isValidYouTubeVideoId(v)) return v;
      const embed = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embed && isValidYouTubeVideoId(embed[1])) return embed[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function isYouTubeHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.includes("youtube.com") || host === "youtu.be";
  } catch {
    return false;
  }
}

/**
 * Reject invented/placeholder YouTube watch IDs before loadURL.
 * Returns error message when navigation should be blocked.
 */
export function validateYouTubeWatchNavigation(url: string): string | null {
  if (!isYouTubeHost(url)) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (id && !isValidYouTubeVideoId(id)) {
        return `Invalid YouTube video id "${id}". Search first; only open watch URLs from youtubeWatchLinks in a prior browserNavigate result.`;
      }
      return null;
    }

    if (parsed.pathname.startsWith("/watch")) {
      const v = parsed.searchParams.get("v");
      if (!v) {
        return "YouTube watch URL missing ?v= parameter. Use youtubeWatchLinks from search results.";
      }
      if (!isValidYouTubeVideoId(v)) {
        return `Invalid YouTube video id "${v}". Never guess ids — use youtubeWatchLinks from the last search navigation.`;
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** Injected after navigation to enrich tool results (YouTube links + error signals). */
function runYouTubeProbe() {
  const title = document.title || "";
  let bodyText = "";
  try {
    bodyText = (document.body && document.body.innerText) || "";
  } catch {}

  const unavailable =
    /video unavailable|does not exist|not available|this video isn't available|private video|sign in to confirm your age|playback id/i.test(
      bodyText,
    );

  const watchLinks: any[] = [];
  const seen: Record<string, boolean> = {};
  try {
    const anchors = document.querySelectorAll(
      'a[href*="watch"], a[href*="youtu.be/"]',
    );
    for (let i = 0; i < anchors.length && watchLinks.length < 10; i++) {
      const a = anchors[i] as HTMLAnchorElement;
      const href = a.href || "";
      let id: string | null = null;
      const m = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (m) {
        id = m[1];
      } else {
        const s = href.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (s) id = s[1];
      }
      if (!id || seen[id]) continue;
      seen[id] = true;
      const t = (
        a.getAttribute("title") ||
        a.getAttribute("aria-label") ||
        a.textContent ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim();
      watchLinks.push({
        id: id,
        title: t.slice(0, 100),
        url: "https://www.youtube.com/watch?v=" + id,
      });
    }
  } catch {}

  return {
    pageTitle: title,
    youtubeUnavailable: unavailable,
    youtubeWatchLinks: watchLinks,
  };
}

export const PAGE_PROBE_SCRIPT = `(function() {
  return (${runYouTubeProbe.toString()})();
})()`;

export function mergePageSignals(
  pageText: string | null,
  probe: Partial<PageNavigationSignals> | null,
): PageNavigationSignals {
  const text = pageText ?? "";
  const fromText =
    /video unavailable|does not exist|not available|this video isn't available/i.test(
      text,
    );

  return {
    pageTitle: probe?.pageTitle ?? null,
    youtubeUnavailable: Boolean(probe?.youtubeUnavailable || fromText),
    youtubeWatchLinks: probe?.youtubeWatchLinks ?? [],
  };
}

const YOUTUBE_PROBE_WAIT_MS = 1400;
const YOUTUBE_PROBE_RETRIES = 3;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Read page text + probe; retry on YouTube while links are still loading. */
export async function readPageWithSignals(
  url: string,
  getTabText: () => Promise<string>,
  runProbe: () => Promise<Partial<PageNavigationSignals> | null>,
  maxTextLength: number,
): Promise<{ pageTextExcerpt: string; pageSignals: PageNavigationSignals }> {
  const isSearch =
    isYouTubeHost(url) &&
    (url.includes("/results") || url.includes("search_query="));

  let pageTextExcerpt = "";
  let pageSignals = mergePageSignals(null, null);

  const attempts = isSearch ? YOUTUBE_PROBE_RETRIES : 1;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(YOUTUBE_PROBE_WAIT_MS);

    const text = await getTabText();
    pageTextExcerpt =
      text.length > maxTextLength
        ? `${text.substring(0, maxTextLength)}...`
        : text;

    const probe = await runProbe();
    pageSignals = mergePageSignals(text, probe);

    if (!isSearch || pageSignals.youtubeWatchLinks.length > 0) break;
  }

  return { pageTextExcerpt, pageSignals };
}
