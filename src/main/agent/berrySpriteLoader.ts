import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FRAME_IDS = ["003", "004", "005", "006", "007", "008", "009", "010"];

const FALLBACK_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><ellipse cx="32" cy="36" rx="22" ry="20" fill="#5B4FE8"/><circle cx="24" cy="28" r="3.5" fill="#fff"/><circle cx="40" cy="28" r="3.5" fill="#fff"/><circle cx="25" cy="29" r="1.5" fill="#1e1b4b"/><circle cx="41" cy="29" r="1.5" fill="#1e1b4b"/></svg>',
  );

export function getBerrySpriteDir(): string | null {
  const candidates = [
    join(process.cwd(), "src/renderer/public/sprite/blueberry_sprites"),
    join(__dirname, "../renderer/sprite/blueberry_sprites"),
    join(__dirname, "../../src/renderer/public/sprite/blueberry_sprites"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "blueberry_003.png"))) return dir;
  }
  return null;
}

let cachedFrames: string[] | null = null;

export function loadBerrySpriteDataUrls(): string[] {
  if (cachedFrames) return cachedFrames;

  const dir = getBerrySpriteDir();
  if (!dir) {
    cachedFrames = [FALLBACK_SVG];
    return cachedFrames;
  }

  cachedFrames = FRAME_IDS.map((id) => {
    const buf = readFileSync(join(dir, `blueberry_${id}.png`));
    return `data:image/png;base64,${buf.toString("base64")}`;
  });
  return cachedFrames;
}
