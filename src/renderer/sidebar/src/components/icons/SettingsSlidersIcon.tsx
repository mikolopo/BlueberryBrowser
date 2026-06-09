import React from "react";
import { cn } from "@common/lib/utils";

interface IconProps {
  className?: string;
}

/** Custom settings icon — horizontal sliders (not emoji, not Lucide). */
export const SettingsSlidersIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("size-5 shrink-0", className)}
    aria-hidden
  >
    <path
      d="M4 6.5H9.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M14.5 6.5H20"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <circle cx="12" cy="6.5" r="2.25" fill="currentColor" />

    <path
      d="M4 12H11"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M16 12H20"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <circle cx="13.5" cy="12" r="2.25" fill="currentColor" />

    <path
      d="M4 17.5H10"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M15 17.5H20"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <circle cx="12.5" cy="17.5" r="2.25" fill="currentColor" />
  </svg>
);
