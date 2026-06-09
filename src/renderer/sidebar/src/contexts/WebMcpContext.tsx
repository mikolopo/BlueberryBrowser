import React, { createContext, useContext, useState } from "react";
import type { WebMcpTabSnapshot } from "@shared/webmcp-types";

interface WebMcpContextType {
  snapshot: WebMcpTabSnapshot | null;
  setSnapshot: (snapshot: WebMcpTabSnapshot | null) => void;
  hasTools: boolean;
}

const WebMcpContext = createContext<WebMcpContextType | null>(null);

export const useWebMcp = (): WebMcpContextType => {
  const ctx = useContext(WebMcpContext);
  if (!ctx) {
    throw new Error("useWebMcp must be used within WebMcpProvider");
  }
  return ctx;
};

export const WebMcpProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [snapshot, setSnapshot] = useState<WebMcpTabSnapshot | null>(null);

  const value: WebMcpContextType = {
    snapshot,
    setSnapshot,
    hasTools: (snapshot?.tools.length ?? 0) > 0,
  };

  return (
    <WebMcpContext.Provider value={value}>{children}</WebMcpContext.Provider>
  );
};
