import React from "react";
import { cn } from "@common/lib/utils";

export const TypingIndicator: React.FC<{ className?: string }> = ({
  className,
}) => (
  <div
    className={cn(
      "flex items-center gap-1.5 px-1 py-2 animate-fade-in",
      className,
    )}
    role="status"
    aria-label="Asystent pisze"
  >
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="size-2 rounded-full bg-primary/70 animate-typing-bounce"
        style={{ animationDelay: `${i * 0.16}s` }}
      />
    ))}
  </div>
);
