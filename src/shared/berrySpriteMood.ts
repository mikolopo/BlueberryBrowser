import type { AgentActivityKind } from "./agent-activity-types";

/** Sprite frames 003–010 → indices 0–7 */
export interface BerrySpriteMood {
  baseFrame: number;
  frameMin: number;
  frameMax: number;
  /** ms between frame advances while animating */
  frameMs: number;
  pageMood: string;
  sidebarClass?: string;
}

export const BERRY_SPRITE_MOODS: Record<AgentActivityKind, BerrySpriteMood> = {
  idle: {
    baseFrame: 0,
    frameMin: 0,
    frameMax: 0,
    frameMs: 0,
    pageMood: "idle",
    sidebarClass: "animate-agent-bob",
  },
  thinking: {
    baseFrame: 1,
    frameMin: 0,
    frameMax: 2,
    frameMs: 450,
    pageMood: "think",
    sidebarClass: "animate-agent-think",
  },
  navigating: {
    baseFrame: 4,
    frameMin: 3,
    frameMax: 6,
    frameMs: 110,
    pageMood: "fly",
    sidebarClass: "animate-agent-fly",
  },
  reading_page: {
    baseFrame: 2,
    frameMin: 1,
    frameMax: 4,
    frameMs: 380,
    pageMood: "read",
    sidebarClass: "animate-agent-read",
  },
  screenshot: {
    baseFrame: 3,
    frameMin: 2,
    frameMax: 4,
    frameMs: 320,
    pageMood: "peek",
    sidebarClass: "animate-agent-peek",
  },
  tool_consent: {
    baseFrame: 0,
    frameMin: 0,
    frameMax: 1,
    frameMs: 520,
    pageMood: "wait",
    sidebarClass: "animate-agent-wait",
  },
  tool_running: {
    baseFrame: 5,
    frameMin: 4,
    frameMax: 7,
    frameMs: 130,
    pageMood: "work",
    sidebarClass: "animate-agent-work",
  },
  tool_done: {
    baseFrame: 7,
    frameMin: 6,
    frameMax: 7,
    frameMs: 280,
    pageMood: "happy",
    sidebarClass: "animate-agent-happy",
  },
  tool_denied: {
    baseFrame: 0,
    frameMin: 0,
    frameMax: 1,
    frameMs: 0,
    pageMood: "denied",
    sidebarClass: "animate-agent-shake",
  },
  clicking: {
    baseFrame: 5,
    frameMin: 4,
    frameMax: 6,
    frameMs: 95,
    pageMood: "click",
    sidebarClass: "animate-agent-click",
  },
  responding: {
    baseFrame: 6,
    frameMin: 5,
    frameMax: 7,
    frameMs: 340,
    pageMood: "happy",
    sidebarClass: "animate-agent-happy",
  },
};

export function getBerrySpriteMood(kind: AgentActivityKind): BerrySpriteMood {
  return BERRY_SPRITE_MOODS[kind] ?? BERRY_SPRITE_MOODS.thinking;
}

/** Serialized for injection into page tabs (berryPageAssistant). */
export function getBerryPageMoodMap(): Record<
  string,
  Pick<BerrySpriteMood, "frameMin" | "frameMax" | "frameMs" | "pageMood">
> {
  const out: Record<
    string,
    Pick<BerrySpriteMood, "frameMin" | "frameMax" | "frameMs" | "pageMood">
  > = {};
  for (const [kind, mood] of Object.entries(BERRY_SPRITE_MOODS)) {
    out[kind] = {
      frameMin: mood.frameMin,
      frameMax: mood.frameMax,
      frameMs: mood.frameMs,
      pageMood: mood.pageMood,
    };
  }
  return out;
}

export function spriteFrameForKind(kind: AgentActivityKind): number {
  return getBerrySpriteMood(kind).baseFrame;
}
