// Minimal ESM resolve hook: lets Node's built-in TS type-stripping import the
// app's mock payloads, which use TypeScript's extensionless relative imports
// (e.g. `import { mockImage } from "./assets"` → ./assets.ts). Node's ESM
// resolver doesn't auto-append extensions, so we do it for relative specifiers
// that have no extension and point at an existing .ts file. Used only by the
// seed exporter (export-seed.mjs) — never ships in the app or the Lambda.
import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExt = /\.[mc]?[jt]s$/.test(specifier);
  if (isRelative && !hasExt && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const candidate = resolvePath(dirname(parentPath), `${specifier}.ts`);
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
}
