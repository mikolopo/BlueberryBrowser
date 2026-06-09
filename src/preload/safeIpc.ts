import { ipcRenderer, type IpcRendererEvent } from "electron";

type Listener = (event: unknown, ...args: unknown[]) => void;

export interface SafeIpcBridge {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => void;
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    on: (channel: string, listener: Listener) => void;
    removeListener: (channel: string, listener: Listener) => void;
    removeAllListeners: (channel: string) => void;
  };
}

interface ChannelWhitelist {
  send: readonly string[];
  invoke: readonly string[];
  on: readonly string[];
}

/**
 * Minimal channel-whitelisted replacement for @electron-toolkit's electronAPI.
 * Exposes ONLY the listed channels — no process.env, no arbitrary IPC.
 */
export function createSafeBridge(allowed: ChannelWhitelist): SafeIpcBridge {
  const sendSet = new Set(allowed.send);
  const invokeSet = new Set(allowed.invoke);
  const onSet = new Set(allowed.on);

  // Wrapped listeners are tracked so removeListener works with the original fn.
  const wrapped = new Map<
    string,
    Map<Listener, (e: IpcRendererEvent, ...args: unknown[]) => void>
  >();

  const reject = (kind: string, channel: string): never => {
    throw new Error(`IPC ${kind} blocked for channel "${channel}"`);
  };

  return {
    ipcRenderer: {
      send: (channel, ...args) => {
        if (!sendSet.has(channel)) reject("send", channel);
        ipcRenderer.send(channel, ...args);
      },
      invoke: (channel, ...args) => {
        if (!invokeSet.has(channel)) reject("invoke", channel);
        return ipcRenderer.invoke(channel, ...args);
      },
      on: (channel, listener) => {
        if (!onSet.has(channel)) reject("on", channel);
        const wrapper = (event: IpcRendererEvent, ...args: unknown[]): void =>
          listener(event, ...args);
        let byListener = wrapped.get(channel);
        if (!byListener) {
          byListener = new Map();
          wrapped.set(channel, byListener);
        }
        byListener.set(listener, wrapper);
        ipcRenderer.on(channel, wrapper);
      },
      removeListener: (channel, listener) => {
        if (!onSet.has(channel)) return;
        const wrapper = wrapped.get(channel)?.get(listener);
        if (wrapper) {
          ipcRenderer.removeListener(channel, wrapper);
          wrapped.get(channel)?.delete(listener);
        }
      },
      removeAllListeners: (channel) => {
        if (!onSet.has(channel)) return;
        ipcRenderer.removeAllListeners(channel);
        wrapped.delete(channel);
      },
    },
  };
}
