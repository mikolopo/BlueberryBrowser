import React, { useState, useEffect } from "react";
import { cn } from "@common/lib/utils";

interface AnimatedSpritesheetProps {
  src: string;
  cols: number;
  rows: number;
  totalFrames: number;
  size?: number;
  className?: string;
  triggerPlay?: boolean;
  defaultFrame?: number;
}

export const AnimatedSpritesheet: React.FC<AnimatedSpritesheetProps> = ({
  src,
  cols,
  rows,
  totalFrames,
  size = 18,
  className,
  triggerPlay = false,
  defaultFrame = 0,
}) => {
  const [frameIndex, setFrameIndex] = useState(defaultFrame);

  useEffect(() => {
    if (!triggerPlay) {
      setFrameIndex(defaultFrame);
      return;
    }

    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % totalFrames);
    }, 115); // Cozy 115ms frame duration

    return () => clearInterval(interval);
  }, [triggerPlay, totalFrames, defaultFrame]);

  const x = frameIndex % cols;
  const y = Math.floor(frameIndex / cols);

  return (
    <div
      className={cn("shrink-0 overflow-hidden select-none pointer-events-none", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${src})`,
        backgroundSize: `${cols * size}px ${rows * size}px`,
        backgroundPosition: `-${x * size}px -${y * size}px`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        transition: "none", // Prevent scrolling transitions
        WebkitTransition: "none",
      }}
    />
  );
};

