// ============================================================================
// util.mjs — tiny shared helpers (logging + retry-once/fail-loud).
// ============================================================================
export const log = (m) => console.log(m);
export const step = (m) => console.log(`\n\x1b[1;34m▶ ${m}\x1b[0m`);
export const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
export const info = (m) => console.log(`  \x1b[2m· ${m}\x1b[0m`);
export const warn = (m) => console.log(`  \x1b[33m! ${m}\x1b[0m`);

/**
 * Run `fn`, retrying once on failure, then failing loud — the pipeline's
 * decided failure policy. The second attempt is the last; its error propagates.
 */
export async function withRetry(fn, label) {
  try {
    return await fn();
  } catch (e1) {
    warn(`${label} failed (${e1.message.split("\n")[0]}); retrying once…`);
    try {
      return await fn();
    } catch (e2) {
      throw new Error(`${label} failed after retry: ${e2.message}`);
    }
  }
}
