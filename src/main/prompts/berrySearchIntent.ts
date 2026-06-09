import type { CoreMessage } from "ai";

const URL_LIKE = /^(https?:\/\/|\w+\.\w+)/i;
const PRONOUN_ONLY = /^(it|that|this|them|one|there)$/i;
const CHAT_ONLY =
  /^(hi|hello|hey|thanks|thank you|thx|ok|okay|yes|no|stop|help|yo|sup|cool|nice|great|got it|understood|continue|nevermind|nvm)[!.?\s]*$/i;

/** Short follow-ups that refer to the immediately prior browse/search request. */
const VAGUE_FOLLOWUP =
  /^(try\s*(again|now)?|search(\s+for)?\s*(it|that)?|same\b|do\s+it|go\s+ahead|please(\s+search)?|now)[!.?\s]*$/i;

const EXPLICIT_SEARCH =
  /\b(?:search(?:\s+the\s+web|\s+google)?\s+for|look\s+up|google)\s+(.+)/i;

function userText(content: CoreMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function cleanQuery(raw: string): string {
  return raw
    .replace(/[?.!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  return URL_LIKE.test(t) || t.startsWith("/") || t.includes("://");
}

function getPreviousUserMessage(history: CoreMessage[]): string | null {
  let seenLatest = false;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m?.role !== "user") continue;
    const text = userText(m.content).trim();
    if (!text) continue;
    if (!seenLatest) {
      seenLatest = true;
      continue;
    }
    return text;
  }
  return null;
}

/** Strict: only patterns that clearly mean "find this site on the web". */
function extractSiteReferenceStrict(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const searchFor = trimmed.match(EXPLICIT_SEARCH);
  if (searchFor?.[1]) {
    const q = cleanQuery(searchFor[1]);
    if (q && !PRONOUN_ONLY.test(q)) return q;
  }

  const sameInline = trimmed.match(/\bsame\s+([a-z0-9][\w-]{1,32})(?:\s+site)?\b/i);
  if (sameInline?.[1]) {
    const ref = cleanQuery(sameInline[1]);
    return ref.includes("site") ? ref : `${ref} site`;
  }

  const siteNamed = trimmed.match(/\b([a-z0-9][\w-]{1,32})\s+site\b/i);
  if (siteNamed?.[1] && !/^(the|a|an|this|that|same)$/i.test(siteNamed[1])) {
    return cleanQuery(`${siteNamed[1]} site`);
  }

  const goToUnknown = trimmed.match(
    /\b(?:go|navigate|open|visit)\s+to\s+(?:the\s+)?(?!https?:\/\/)([a-z0-9][\w\s-]{2,48}?)(?:\s+site\b|\s+and\b|[?.!]|$)/i
  );
  if (goToUnknown?.[1] && !looksLikeUrl(goToUnknown[1])) {
    const q = cleanQuery(goToUnknown[1]);
    if (q.length >= 3 && !/^(a|an|the|some|that|this|it|page|tab|site)$/i.test(q)) {
      return q.includes("site") ? q : `${q} site`;
    }
  }

  const same = trimmed.match(/^same\s+(.+)/i);
  if (same?.[1]) {
    const ref = cleanQuery(same[1]);
    return ref.includes("site") ? ref : `${ref} site`;
  }

  return null;
}

/**
 * Auto-run Google search only when THIS turn clearly needs it.
 * Completely disabled here to eliminate search preflight time and token overhead.
 */
export function resolveSearchPreflightQuery(
  _history: CoreMessage[],
  _latestMessage: string,
): string | null {
  return null;
}

/**
 * Softer hint for LLM / refusal retry — still scoped to current turn, not full history.
 * Used exclusively for refusal recovery, returning a query only when the LLM gets stuck.
 */
export function resolveSearchQueryFromConversation(
  history: CoreMessage[],
  latestMessage: string,
): string | null {
  const latest = latestMessage.trim();
  if (!latest || latest.length < 3) return null;
  if (CHAT_ONLY.test(latest)) return null;

  const fromLatest = extractSiteReferenceStrict(latest);
  if (fromLatest) return fromLatest;

  if (/\bsearch\s+for\s+(it|that|this)\b/i.test(latest)) {
    const prev = getPreviousUserMessage([
      ...history,
      { role: "user", content: latest },
    ]);
    if (prev) {
      const q = extractSiteReferenceStrict(prev);
      if (q) return q;
    }
    return null;
  }

  if (VAGUE_FOLLOWUP.test(latest)) {
    const prev = getPreviousUserMessage([
      ...history,
      { role: "user", content: latest },
    ]);
    if (prev) {
      const q = extractSiteReferenceStrict(prev);
      if (q) return q;
    }
  }

  return null;
}

export function isSearchRefusal(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("don't know what") ||
    t.includes("do not know what") ||
    t.includes("need a specific website") ||
    t.includes("provide the website") ||
    t.includes("tell me what to search") ||
    t.includes("tell me what you'd like me to search") ||
    t.includes("without a more specific url") ||
    t.includes("without knowing what")
  );
}
