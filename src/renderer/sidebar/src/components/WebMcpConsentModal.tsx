import React, { useEffect, useState } from "react";
import type { WebMcpConsentRequest } from "@shared/webmcp-types";
import { motion } from "framer-motion";

interface WebMcpConsentModalProps {
  request: WebMcpConsentRequest | null;
  onClose: () => void;
}

export const WebMcpConsentModal: React.FC<WebMcpConsentModalProps> = ({
  request,
  onClose,
}) => {
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (request) setRemember(true);
  }, [request]);

  if (!request) return null;

  const respond = async (granted: boolean): Promise<void> => {
    await window.sidebarAPI.respondWebMcpConsent({
      requestId: request.requestId,
      granted,
      rememberOrigin: granted && remember,
      origin: request.origin,
    });
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-border bg-background p-4 shadow-lg"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
      >
        <h3 className="text-sm font-semibold text-foreground">
          Allow WebMCP tool?
        </h3>
        <p className="mt-1 text-xs text-muted-foreground break-all">
          {request.origin || request.url}
        </p>

        <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs">
          <div className="font-medium text-foreground">{request.toolName}</div>
          {request.description ? (
            <div className="text-muted-foreground mt-1">
              {request.description}
            </div>
          ) : null}
          <pre className="mt-2 overflow-x-auto text-[10px] text-muted-foreground">
            {JSON.stringify(request.args, null, 2)}
          </pre>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember for this site
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void respond(false)}
            className="rounded-md px-3 py-1.5 text-xs hover:bg-muted"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={() => void respond(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
          >
            Allow
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
