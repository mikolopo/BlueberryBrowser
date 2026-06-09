import React from "react";
import { Moon, Sun } from "lucide-react";
import { ToolBarButton } from "../components/ToolBarButton";

interface DarkModeToggleProps {
  isDarkMode: boolean;
  onToggle: () => void;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({
  isDarkMode,
  onToggle,
}) => (
  <ToolBarButton
    Icon={isDarkMode ? Sun : Moon}
    onClick={onToggle}
    className="transition-transform"
  />
);
