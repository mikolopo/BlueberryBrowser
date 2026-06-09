import { app } from "electron";

/** Enable Chromium WebMCP preview flags — must run before app.ready. */
export const enableWebMcpChromiumFlags = (): void => {
  app.commandLine.appendSwitch("enable-experimental-web-platform-features");
  app.commandLine.appendSwitch("enable-features", "WebModelContext");
};
