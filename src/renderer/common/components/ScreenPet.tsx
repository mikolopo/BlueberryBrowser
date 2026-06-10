import React, { useState, useEffect, useRef } from "react";
import { BerrySprite } from "@common/components/BerrySprite";
import { cn } from "@common/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAgentActivity } from "../../sidebar/src/contexts/AgentActivityContext";

const GRAVITY = 0.55;
const TICK_RATE = 1000 / 30; // 30 FPS

// ─── Sizes ───────────────────────────────────────────────────────────────────
// Mini mode: small wandering pet
const MINI_SPRITE_SIZE = 32;
const MINI_WIN_W = 44;
const MINI_WIN_H = 44;

// Active mode: 64px flying berry + speech bubble beside it
const ACTIVE_SPRITE_SIZE = 64;
const ACTIVE_WIN_W = 260; // sprite (64) + gap (8) + bubble (~180) + padding
const ACTIVE_WIN_H = 72;

// Hover animation params (active mode floats up/down)
const HOVER_AMPLITUDE = 6; // px
const HOVER_SPEED = 0.0035; // radians per ms

export const ScreenPet: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewport } = useAgentActivity();
  const isBig = viewport.isActive;

  const petWidth = isBig ? ACTIVE_WIN_W : MINI_WIN_W;
  const petHeight = isBig ? ACTIVE_WIN_H : MINI_WIN_H;

  // ─── Walking physics state (mini mode only) ───────────────────────────────
  const [petState, setPetState] = useState<"running" | "climbing" | "falling">("falling");
  const [climbWall, setClimbWall] = useState<"left" | "right">("left");
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, petX: 200, petY: 100 });

  // Mutable physics state (avoids stale closures in setInterval)
  const stateRef = useRef({
    x: 200,
    y: 100,
    vy: 0,
    state: "falling" as "running" | "climbing" | "falling",
    dir: 1 as 1 | -1,
    climbDir: -1 as 1 | -1,
    climbWall: "left" as "left" | "right",
    width: 800,
    height: 600,
    // Hover animation reference time
    hoverStartTime: 0,
    hoverBaseY: 0,
  });

  // ─── Notify main process of window size when mode changes ─────────────────
  useEffect(() => {
    const api = (window as any).sidebarAPI;
    if (api) {
      api.setPetSize({ width: petWidth, height: petHeight });
    }
  }, [petWidth, petHeight]);

  // ─── When switching FROM mini TO active: save position for later ──────────
  const wasBigRef = useRef(isBig);
  useEffect(() => {
    const prevBig = wasBigRef.current;
    wasBigRef.current = isBig;

    if (!prevBig && isBig) {
      // Entering active mode: record hover base position
      const vars = stateRef.current;
      // Hover near the top-center of the screen
      vars.hoverBaseY = Math.max(20, vars.height * 0.15);
      vars.hoverStartTime = Date.now();
      // Jump x to center
      vars.x = Math.max(0, vars.width / 2 - ACTIVE_WIN_W / 2);
    } else if (prevBig && !isBig) {
      // Returning to mini: drop from hover spot, let physics take over
      const vars = stateRef.current;
      vars.state = "falling";
      vars.vy = 0;
      setPetState("falling");
    }
  }, [isBig]);

  // ─── Track parent window bounds ───────────────────────────────────────────
  useEffect(() => {
    const api = (window as any).sidebarAPI;
    if (!api) return;

    let active = true;

    api.getMainWindowBounds().then((bounds: any) => {
      if (!active || !bounds) return;
      stateRef.current.width = bounds.width;
      stateRef.current.height = bounds.height;
    });

    const handleBounds = (bounds: any) => {
      if (!bounds) return;
      const vars = stateRef.current;
      if (vars.state === "climbing" && (vars.width !== bounds.width || vars.height !== bounds.height)) {
        vars.state = "falling";
        vars.vy = 0;
        setPetState("falling");
      }
      vars.width = bounds.width;
      vars.height = bounds.height;
    };

    api.onMainWindowBounds(handleBounds);
    return () => {
      active = false;
      api.removeMainWindowBoundsListener();
    };
  }, []);

  // ─── 30fps physics loop ───────────────────────────────────────────────────
  useEffect(() => {
    const api = (window as any).sidebarAPI;
    const interval = setInterval(() => {
      if (isDraggingRef.current) return;

      const vars = stateRef.current;
      const w = vars.width;
      const h = vars.height;
      if (w <= 0 || h <= 0) return;

      if (isBig) {
        // ── ACTIVE MODE: gentle hover bob ──────────────────────────────────
        const elapsed = Date.now() - vars.hoverStartTime;
        const bobOffset = Math.sin(elapsed * HOVER_SPEED) * HOVER_AMPLITUDE;
        vars.y = Math.max(0, vars.hoverBaseY + bobOffset);
        // Keep x clamped
        vars.x = Math.max(0, Math.min(w - ACTIVE_WIN_W, vars.x));
      } else {
        // ── MINI MODE: walking / climbing / falling physics ────────────────
        if (vars.state === "falling") {
          vars.vy += GRAVITY;
          vars.y += vars.vy;

          if (vars.y >= h - MINI_WIN_H) {
            vars.y = h - MINI_WIN_H;
            vars.vy = 0;
            vars.state = "running";
            vars.dir = Math.random() > 0.5 ? 1 : -1;
            setPetState("running");
          }
        } else if (vars.state === "running") {
          vars.x += vars.dir * 1.25;

          if (vars.x <= 0) {
            vars.x = 0;
            if (Math.random() < 0.7) {
              vars.state = "climbing";
              vars.climbWall = "left";
              vars.climbDir = -1;
              setClimbWall("left");
              setPetState("climbing");
            } else {
              vars.dir = 1;
            }
          } else if (vars.x >= w - MINI_WIN_W) {
            vars.x = w - MINI_WIN_W;
            if (Math.random() < 0.7) {
              vars.state = "climbing";
              vars.climbWall = "right";
              vars.climbDir = -1;
              setClimbWall("right");
              setPetState("climbing");
            } else {
              vars.dir = -1;
            }
          }
        } else if (vars.state === "climbing") {
          vars.x = vars.climbWall === "left" ? 0 : w - MINI_WIN_W;
          vars.y += vars.climbDir * 1.0;

          if (vars.y <= 0) {
            vars.y = 0;
            vars.state = "falling";
            vars.vy = 0;
            setPetState("falling");
          } else if (vars.y >= h - MINI_WIN_H) {
            vars.y = h - MINI_WIN_H;
            vars.state = "running";
            vars.dir = vars.climbWall === "left" ? 1 : -1;
            setPetState("running");
          }
        }
      }

      if (api) {
        api.movePet(vars.x, vars.y);
      }
    }, TICK_RATE);

    return () => clearInterval(interval);
    // Re-create interval when isBig changes so the loop uses the right branch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBig]);

  // ─── Drag handlers ────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.screenX,
      mouseY: e.screenY,
      petX: stateRef.current.x,
      petY: stateRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.screenX - dragStartRef.current.mouseX;
    const dy = e.screenY - dragStartRef.current.mouseY;
    const vars = stateRef.current;
    const newX = Math.max(0, Math.min(vars.width - petWidth, dragStartRef.current.petX + dx));
    const newY = Math.max(0, Math.min(vars.height - petHeight, dragStartRef.current.petY + dy));
    vars.x = newX;
    vars.y = newY;
    const api = (window as any).sidebarAPI;
    if (api) api.movePet(newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDraggingRef.current = false;
    setIsDragging(false);
    const vars = stateRef.current;
    if (!isBig) {
      vars.state = "falling";
      vars.vy = 0;
      setPetState("falling");
    }
  };

  // ─── Mini mode sprite rotation ────────────────────────────────────────────
  let rotationStyle = "";
  if (!isBig) {
    if (petState === "falling") {
      rotationStyle = "rotate-180";
    } else if (petState === "climbing") {
      rotationStyle = climbWall === "left" ? "rotate-90" : "-rotate-90";
    } else if (petState === "running" && stateRef.current.dir === -1) {
      rotationStyle = "scale-x-[-1]";
    }
  }

  // ─── Mini mode: map physics state to sprite kind ──────────────────────────
  let miniSpriteKind: "navigating" | "thinking" | "idle" = "idle";
  if (petState === "running") miniSpriteKind = "navigating";
  else if (petState === "climbing") miniSpriteKind = "thinking";

  // ─── Spring transition config ─────────────────────────────────────────────
  const transformTransition = isBig
    ? { type: "spring" as const, stiffness: 380, damping: 14, mass: 0.9 }
    : { type: "spring" as const, stiffness: 500, damping: 24, mass: 0.6 };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
    >
      <AnimatePresence mode="wait">
        {isBig ? (
          // ── ACTIVE MODE ──────────────────────────────────────────────────
          <motion.div
            key="active"
            initial={{ scale: 0.2, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.2, opacity: 0, y: 20 }}
            transition={transformTransition}
            className="flex items-center justify-start w-full h-full px-1.5 gap-2"
          >
            {/* Flying Berry sprite */}
            <div className="shrink-0 flex items-center justify-center">
              <BerrySprite
                size={ACTIVE_SPRITE_SIZE}
                animated={!isDragging}
                kind={viewport.currentKind}
                useActiveFrames={true}
                className="filter drop-shadow-lg"
              />
            </div>

            {/* Speech bubble — only shown when there's a label */}
            {viewport.currentLabel && (
              <motion.div
                initial={{ opacity: 0, x: -8, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -8, scale: 0.9 }}
                transition={{ delay: 0.08, type: "spring", stiffness: 400, damping: 20 }}
                className={cn(
                  "relative flex-1 min-w-0",
                  "bg-slate-900/95 text-slate-100 text-[10px] font-semibold leading-tight",
                  "px-2.5 py-1.5 rounded-2xl border border-white/10 shadow-lg",
                  "truncate select-none",
                  // Triangle pointer on the left side
                  "before:content-[''] before:absolute before:top-1/2 before:-left-[7px]",
                  "before:-translate-y-1/2 before:w-0 before:h-0",
                  "before:border-t-[6px] before:border-t-transparent",
                  "before:border-b-[6px] before:border-b-transparent",
                  "before:border-r-[7px] before:border-r-slate-900/95",
                )}
              >
                {viewport.currentLabel}
              </motion.div>
            )}
          </motion.div>
        ) : (
          // ── MINI MODE ────────────────────────────────────────────────────
          <motion.div
            key="mini"
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={transformTransition}
            className="w-full h-full flex items-center justify-center"
          >
            <div className={cn("flex items-center justify-center shrink-0", rotationStyle)}>
              <BerrySprite
                size={MINI_SPRITE_SIZE}
                animated={petState !== "falling" && !isDragging}
                kind={miniSpriteKind}
                useActiveFrames={false}
                className="filter drop-shadow-md"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
