import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const src = require.resolve("darkreader/darkreader.js");
const destDir = join(root, "resources", "darkreader");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "darkreader.js"));
console.log("Synced darkreader.js → resources/darkreader/");
