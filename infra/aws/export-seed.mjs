// ============================================================================
// export-seed.mjs — emit the real mock payloads as seed JSON for DynamoDB
// ----------------------------------------------------------------------------
// Imports the app's own mock payloads (the single source of truth) and writes
// each as a standalone <sessionId>.json under infra/aws/seed/. The provisioning
// script then loads each into the tuwon-sessions table. Importing from source
// (rather than re-typing the data here) guarantees the seeded backend serves
// EXACTLY what the app's mocks describe — zero drift.
//
// Run with the TS resolve hook so Node's type-stripping can follow the mocks'
// extensionless imports:
//   node --import ./ts-resolve-hook-register.mjs export-seed.mjs
// ============================================================================
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mocksDir = resolve(here, "../../mobile/src/mocks");
const outDir = resolve(here, "seed");

const { photosynthesisQuiz } = await import(resolve(mocksDir, "photosynthesisQuiz.ts"));
const { waterCycleQuiz } = await import(resolve(mocksDir, "waterCycleQuiz.ts"));

const payloads = [photosynthesisQuiz, waterCycleQuiz];

mkdirSync(outDir, { recursive: true });
for (const p of payloads) {
  const file = resolve(outDir, `${p.sessionId}.json`);
  writeFileSync(file, JSON.stringify(p, null, 2));
  console.log(`wrote ${p.sessionId} (${p.blocks.length} blocks) → seed/${p.sessionId}.json`);
}
console.log(`\n${payloads.length} payload(s) exported.`);
