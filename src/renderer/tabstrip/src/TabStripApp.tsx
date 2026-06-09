import React from "react";
import { BrowserProvider } from "@common/contexts/BrowserContext";
import { VerticalTabBar } from "./components/VerticalTabBar";
import { useDarkMode } from "@common/hooks/useDarkMode";

const TabStripContent: React.FC = () => {
  useDarkMode("slave");

  return (
    <div className="h-full flex flex-col bg-[rgb(var(--tab-strip))] border-r border-border">
      <VerticalTabBar />
    </div>
  );
};

export const TabStripApp: React.FC = () => (
  <BrowserProvider>
    <TabStripContent />
  </BrowserProvider>
);
