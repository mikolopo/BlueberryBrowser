import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@common/lib/utils";
import type { AgentActivityKind } from "@shared/agent-activity-types";
import { getBerrySpriteMood } from "@shared/berrySpriteMood";

/** Animation frames from wytnij.py output (003–010 are the first contiguous run). */
const SPRITE_FRAME_IDS = [
  "003",
  "004",
  "005",
  "006",
  "007",
  "008",
  "009",
  "010",
];

const SPRITE_FRAMES = SPRITE_FRAME_IDS.map(
  (id) => `/sprite/blueberry_sprites/blueberry_${id}.png`,
);

interface BerrySpriteProps {
  frame?: number;
  kind?: AgentActivityKind;
  size?: number;
  className?: string;
  animated?: boolean;
}

export const BerrySprite: React.FC<BerrySpriteProps> = ({
  frame,
  kind = "idle",
  size = 28,
  className,
  animated = false,
}) => {
  const [failed, setFailed] = useState(false);
  const mood = getBerrySpriteMood(kind);
  const [frameIndex, setFrameIndex] = useState(mood.baseFrame);

  useEffect(() => {
    setFrameIndex(mood.baseFrame);
  }, [kind, mood.baseFrame]);

  useEffect(() => {
    if (
      !animated ||
      kind === "idle" ||
      mood.frameMax <= mood.frameMin ||
      !mood.frameMs
    ) {
      return;
    }

    const id = window.setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        return next > mood.frameMax ? mood.frameMin : next;
      });
    }, mood.frameMs);

    return () => window.clearInterval(id);
  }, [animated, kind, mood.frameMax, mood.frameMin, mood.frameMs]);

  const resolvedFrame =
    frame !== undefined
      ? frame % SPRITE_FRAMES.length
      : frameIndex % SPRITE_FRAMES.length;

  const src = useMemo(() => SPRITE_FRAMES[resolvedFrame], [resolvedFrame]);

  const motionClass =
    animated && kind !== "idle" ? mood.sidebarClass : undefined;

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
