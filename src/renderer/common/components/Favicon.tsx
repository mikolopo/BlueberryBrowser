import React, { useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@common/lib/utils";

interface FaviconProps {
  src?: string | null;
  className?: string;
}

export const Favicon: React.FC<FaviconProps> = ({ src, className }) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return <Globe className={cn("size-4 text-muted-foreground", className)} />;
  }

  return (
    <div
      className={cn(
        "size-4 overflow-hidden rounded-sm flex items-center justify-center",
        className,
      )}
    >
      <img
        src={src}
        className="object-contain size-full"
        onError={() => setError(true)}
        alt=""
      />
    </div>
  );
};
