// Registers the TS resolve hook (ts-resolve-hook.mjs) via the modern
// module.register() API, so it can be loaded with `node --import`. Seed-time
// only — see ts-resolve-hook.mjs.
import { register } from "node:module";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(resolve(here, "ts-resolve-hook.mjs")).href);
