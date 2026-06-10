import React, { useState, useEffect, useRef } from "react";
import { Search, ArrowRight } from "lucide-react";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { cn } from "@common/lib/utils";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
}

export const NewTabApp: React.FC = () => {
  useDarkMode("slave"); // Follow main process dark mode settings
  const [searchQuery, setSearchQuery] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  // Handle Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    let target = searchQuery.trim();
    if (!/^https?:\/\//i.test(target)) {
      if (target.includes(".") && !target.includes(" ")) {
        target = "https://" + target;
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
      }
    }
    window.location.href = target;
  };

  // Canvas particle and glow loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Initialize particles
    const particlesCount = 45;
    const particles: Particle[] = [];
    for (let i = 0; i < particlesCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35 - 0.15, // Drift slightly upwards
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.3 + 0.15,
        baseAlpha: Math.random() * 0.3 + 0.15,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains("dark");
      // Violet/lavender theme accent color mapping
      const accentRGB = isDark ? "167, 139, 250" : "109, 40, 217";

      const mouse = mouseRef.current;

      // 1. Draw Mouse Glow
      if (mouse.active) {
        const glowRadius = isDark ? 280 : 220;
        const gradient = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          glowRadius
        );
        gradient.addColorStop(0, `rgba(${accentRGB}, ${isDark ? 0.08 : 0.06})`);
        gradient.addColorStop(0.5, `rgba(${accentRGB}, ${isDark ? 0.03 : 0.02})`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw and update particles
      particles.forEach((p) => {
        // Apply velocity
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around borders
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // React to mouse coordinates
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const range = 180;

          if (dist < range) {
            // Glow brighter
            const factor = (range - dist) / range;
            p.alpha = Math.min(0.85, p.baseAlpha + factor * 0.45);

            // Subtle push away (repel)
            const repelStrength = factor * 0.4;
            p.x += (dx / dist) * repelStrength;
            p.y += (dy / dist) * repelStrength;
          } else {
            // Smoothly ease back to base alpha
            p.alpha += (p.baseAlpha - p.alpha) * 0.05;
          }
        } else {
          p.alpha += (p.baseAlpha - p.alpha) * 0.05;
        }

        // Draw particle
        ctx.fillStyle = `rgba(${accentRGB}, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background select-none">
      
      {/* 1. Fullscreen interactive canvas and background gradient */}
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
        />
        {/* Soft elegant background gradient that blends light/dark modes */}
        <div className="absolute inset-0 bg-gradient-to-tr from-background via-background to-secondary/15 dark:to-secondary/5 pointer-events-none" />
      </div>

      {/* 2. Glassmorphic Central Search Card */}
      <div className="relative z-10 w-full max-w-[35rem] bg-card/25 dark:bg-card/10 backdrop-blur-2xl border border-white/20 dark:border-white/5 shadow-2xl rounded-2xl p-6 flex flex-col items-center">
        
        {/* Clean Logo or Title Header */}
        <div className="mb-5 text-center">
          <h2 className="text-xl font-bold tracking-tight text-foreground/90">
            Blueberry Browser
          </h2>
        </div>

        {/* Transparent Search Bar */}
        <form onSubmit={handleSearchSubmit} className="w-full flex items-center gap-2 relative">
          <div className="absolute left-4 text-muted-foreground/80 pointer-events-none">
            <Search className="size-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Google or enter address..."
            className={cn(
              "w-full pl-12 pr-12 py-3 text-sm rounded-xl outline-none text-foreground border",
              "bg-background/40 border-border",
              "focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-background/80",
              "transition-all"
            )}
            autoFocus
            spellCheck={false}
          />
          <button
            type="submit"
            className="absolute right-3 p-1 text-muted-foreground hover:text-primary transition-colors"
            title="Search"
          >
            <ArrowRight className="size-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
