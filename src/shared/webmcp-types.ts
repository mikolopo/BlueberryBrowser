export type WebMcpToolSource = "native" | "declarative";

export interface WebMcpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  source: WebMcpToolSource;
}

export interface WebMcpProbeResult {
  supportsNative: boolean;
  origin: string;
  url: string;
  tools: WebMcpToolDescriptor[];
  error?: string;
}

export interface WebMcpTabSnapshot {
  tabId: string;
  origin: string;
  url: string;
  supportsNative: boolean;
  tools: WebMcpToolDescriptor[];
  discoveredAt: number;
  error?: string;
}

export interface WebMcpConsentRequest {
  requestId: string;
  origin: string;
  url: string;
  toolName: string;
  description: string;
  args: Record<string, unknown>;
  source: WebMcpToolSource;
}

export interface WebMcpConsentResponse {
  requestId: string;
  granted: boolean;
  rememberOrigin: boolean;
  origin: string;
}

export interface WebMcpExecuteResult {
  success: boolean;
  result?: unknown;
  error?: string;
}
