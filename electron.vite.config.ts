import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const root = dirname(fileURLToPath(import.meta.url));

const rendererAliases = {
  "@common": resolve(root, "src/renderer/common"),
  "@shared": resolve(root, "src/shared"),
};

export default defineConfig({
  main: {
    plugins: [
      tsconfigPaths({ projects: ["tsconfig.node.json"] }),
      externalizeDepsPlugin(),
    ],
    resolve: {
      alias: rendererAliases,
    },
    build: {
      rollupOptions: {
        output: {
          format: "es",
        },
      },
    },
  },
  preload: {
    plugins: [
      tsconfigPaths({ projects: ["tsconfig.node.json"] }),
      externalizeDepsPlugin(),
    ],
    resolve: {
      alias: rendererAliases,
    },
    build: {
      rollupOptions: {
        input: {
          topbar: resolve(root, "src/preload/topbar.ts"),
          sidebar: resolve(root, "src/preload/sidebar.ts"),
        },
        output: {
          format: "es",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    root: resolve(root, "src/renderer"),
    publicDir: resolve(root, "src/renderer/public"),
    build: {
      rollupOptions: {
        input: {
          topbar: resolve(root, "src/renderer/topbar/index.html"),
          sidebar: resolve(root, "src/renderer/sidebar/index.html"),
          tabstrip: resolve(root, "src/renderer/tabstrip/index.html"),
          newtab: resolve(root, "src/renderer/newtab/index.html"),
        },
      },
    },
    resolve: {
      alias: rendererAliases,
    },
    plugins: [
      tsconfigPaths({ projects: [resolve(root, "tsconfig.web.json")] }),
      react(),
    ],
    server: {
      fs: {
        allow: [".."],
      },
    },
  },
});
