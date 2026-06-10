import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@common/lib/utils";
import type { AgentActivityKind } from "@shared/agent-activity-types";
import { getBerrySpriteMood } from "@shared/berrySpriteMood";

/** Mini-mode animation frames: walking/idle (003–010, indices 0–7). */
const MINI_FRAME_IDS = [
  "003",
  "004",
  "005",
  "006",
  "007",
  "008",
  "009",
  "010",
];

/** Active/flying mode frames: the bigger "wings out" sprite frames (016–019). */
const ACTIVE_FRAME_IDS = [
  "016",
  "017",
  "018",
  "019",
];

const MINI_SPRITE_FRAMES = MINI_FRAME_IDS.map(
  (id) => `/sprite/blueberry_sprites/blueberry_${id}.png`,
);

const ACTIVE_SPRITE_FRAMES = ACTIVE_FRAME_IDS.map(
  (id) => `/sprite/blueberry_sprites/blueberry_${id}.png`,
);

interface BerrySpriteProps {
  frame?: number;
  kind?: AgentActivityKind;
  size?: number;
  className?: string;
  animated?: boolean;
  /** When true, uses the flying/active frame set (016–019) instead of the walking set (003–010). */
  useActiveFrames?: boolean;
}

export const BerrySprite: React.FC<BerrySpriteProps> = ({
  frame,
  kind = "idle",
  size = 28,
  className,
  animated = false,
  useActiveFrames = false,
}) => {
  const [failed, setFailed] = useState(false);
  const mood = getBerrySpriteMood(kind);

  const spriteFrames = useActiveFrames ? ACTIVE_SPRITE_FRAMES : MINI_SPRITE_FRAMES;
  const frameCount = spriteFrames.length;

  // For active frames, always start at 0 and loop the whole set.
  const baseFrame = useActiveFrames ? 0 : mood.baseFrame;
  const frameMin = useActiveFrames ? 0 : mood.frameMin;
  const frameMax = useActiveFrames ? frameCount - 1 : mood.frameMax;
  const frameMs = useActiveFrames ? 120 : mood.frameMs;

  const [frameIndex, setFrameIndex] = useState(baseFrame);

  useEffect(() => {
    setFrameIndex(baseFrame);
  }, [kind, baseFrame, useActiveFrames]);

  useEffect(() => {
    if (!animated) return;

    // Active frames always loop; mini frames follow mood rules
    if (!useActiveFrames && (kind === "idle" || frameMax <= frameMin || !frameMs)) {
      return;
    }

    const id = window.setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        return next > frameMax ? frameMin : next;
      });
    }, frameMs);

    return () => window.clearInterval(id);
  }, [animated, kind, frameMax, frameMin, frameMs, useActiveFrames]);

  const resolvedFrame =
    frame !== undefined
      ? frame % frameCount
      : frameIndex % frameCount;

  const src = useMemo(() => spriteFrames[resolvedFrame], [spriteFrames, resolvedFrame]);

  const motionClass = animated ? mood.sidebarClass : undefined;

  if (failed) {
    return (
      <img
        src="/sprite/blueberry_default.svg"
        alt=""
        width={size}
        height={size}
        className={cn(
          "shrink-0 object-contain drop-shadow-sm",
          motionClass,
          className,
        )}
        draggable={false}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 object-contain drop-shadow-sm transition-transform duration-300",
        motionClass,
        className,
      )}
      draggable={false}
    />
  );
};
