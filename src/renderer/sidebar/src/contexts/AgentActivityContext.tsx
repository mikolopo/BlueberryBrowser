import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type {
  AgentActivityEvent,
  AgentViewportState,
} from "@shared/agent-activity-types";
import { IDLE_VIEWPORT } from "@shared/agent-activity-types";

interface AgentActivityPayload {
  event: AgentActivityEvent | null;
  viewport: AgentViewportState;
  feed: AgentActivityEvent[];
}

interface AgentActivityContextType {
  viewport: AgentViewportState;
  feed: AgentActivityEvent[];
  clearFeed: () => void;
}

const AgentActivityContext = createContext<AgentActivityContextType | null>(
  null,
);

export const useAgentActivity = (): AgentActivityContextType => {
  const ctx = useContext(AgentActivityContext);
  if (!ctx) {
    throw new Error(
      "useAgentActivity must be used within AgentActivityProvider",
    );
  }
  return ctx;
};

export const AgentActivityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [viewport, setViewport] = useState<AgentViewportState>(IDLE_VIEWPORT);
  const [feed, setFeed] = useState<AgentActivityEvent[]>([]);

  useEffect(() => {
    const api = window.sidebarAPI;

    void api.getAgentActivity().then((payload: AgentActivityPayload | null) => {
      if (!payload) return;
      setViewport(payload.viewport);
      setFeed(payload.feed ?? []);
    });

    api.onAgentActivityUpdated((payload: AgentActivityPayload) => {
      if (payload.viewport) setViewport(payload.viewport);
      if (payload.feed) setFeed(payload.feed);
    });

    return () => api.removeAgentActivityListener();
  }, []);

  const clearFeed = useCallback(() => setFeed([]), []);

  return (
    <AgentActivityContext.Provider value={{ viewport, feed, clearFeed }}>
      {children}
    </AgentActivityContext.Provider>
  );
};
