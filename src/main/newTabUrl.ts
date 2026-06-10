import { is } from "@electron-toolkit/utils";
import { join } from "path";

export function getNewTabUrl(): string {
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    return `${process.env["ELECTRON_RENDERER_URL"]}/newtab/index.html`;
  }
  return `file://${join(__dirname, "../renderer/newtab/index.html")}`;
}
