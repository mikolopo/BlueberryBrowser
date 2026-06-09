import type { BerryActionTemplate } from "../../shared/berry-task-types";

/** Built-in action templates Berry can start without saving a recipe first. */
export const BERRY_ACTION_TEMPLATES: BerryActionTemplate[] = [
  {
    id: "youtube-shorts-next",
    name: "YouTube Shorts — next Short",
    description:
      "Press ArrowDown once per tick to advance to the next Short (use on youtube.com/shorts).",
    tags: ["youtube", "shorts", "scroll", "interval"],
    steps: [{ action: "key", key: "ArrowDown", label: "Next Short" }],
  },
  {
    id: "youtube-toggle-mute",
    name: "YouTube — toggle mute",
    description:
      "Press M once to mute or unmute the focused YouTube player (Shorts, watch, embed). Use berryTaskRunOnce — does not stop scroll tasks.",
    tags: ["youtube", "shorts", "audio", "mute", "once"],
    once: true,
    steps: [{ action: "key", key: "m", label: "Toggle mute (M)" }],
  },
  {
    id: "youtube-volume-up",
    name: "YouTube — volume up",
    description: "Press ArrowUp to raise YouTube player volume.",
    tags: ["youtube", "audio", "once"],
    once: true,
    steps: [{ action: "key", key: "ArrowUp", label: "Volume up" }],
  },
  {
    id: "youtube-volume-down",
    name: "YouTube — volume down",
    description:
      "Press ArrowDown on player (when not scrolling Shorts feed) lowers volume — prefer M for mute.",
    tags: ["youtube", "audio", "once"],
    once: true,
    steps: [{ action: "key", key: "ArrowDown", label: "Volume down" }],
  },
  {
    id: "scroll-down",
    name: "Scroll page down",
    description: "Native mouse wheel scroll down once per tick.",
    tags: ["scroll", "feed"],
    steps: [
      {
        action: "scroll",
        direction: "down",
        amount: 720,
        label: "Scroll down",
      },
    ],
  },
  {
    id: "scroll-down-key",
    name: "Scroll down + ArrowDown",
    description:
      "ArrowDown plus wheel scroll — works on Shorts, X feeds, Reddit.",
    tags: ["scroll", "shorts", "feed"],
    steps: [
      { action: "key", key: "ArrowDown", label: "ArrowDown" },
      {
        action: "scroll",
        direction: "down",
        amount: 480,
        label: "Scroll down",
      },
    ],
  },
  {
    id: "page-down",
    name: "Page Down key",
    description: "Press PageDown once per tick.",
    tags: ["scroll", "page"],
    steps: [{ action: "key", key: "PageDown", label: "Page Down" }],
  },
];

const byId = new Map(BERRY_ACTION_TEMPLATES.map((t) => [t.id, t]));

export function getActionTemplate(id: string): BerryActionTemplate | null {
  const key = id.trim().toLowerCase();
  return byId.get(key) ?? null;
}

export function listActionTemplates(): BerryActionTemplate[] {
  return [...BERRY_ACTION_TEMPLATES];
}

export function listIntervalTemplates(): BerryActionTemplate[] {
  return BERRY_ACTION_TEMPLATES.filter((t) => !t.once);
}

export function listOnceTemplates(): BerryActionTemplate[] {
  return BERRY_ACTION_TEMPLATES.filter((t) => t.once);
}
