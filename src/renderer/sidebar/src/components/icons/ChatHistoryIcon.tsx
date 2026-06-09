import React from "react";
import { cn } from "@common/lib/utils";

interface IconProps {
  className?: string;
}

/** Custom chat history icon — stacked bubbles with clock arc. */
export const ChatHistoryIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("size-5 shrink-0", className)}
    aria-hidden
  >
    <path
      d="M5 6.5C5 5.12 6.12 4 7.5 4H14c1.38 0 2.5 1.12 2.5 2.5v5.25c0 1.38-1.12 2.5-2.5 2.5H9.5L5 18.5V6.5Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 18.5V15.25H14c1.38 0 2.5-1.12 2.5-2.5V6.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.5 8.5a5 5 0 1 1 0 10"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M16.5 8.5V11h2.25"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
