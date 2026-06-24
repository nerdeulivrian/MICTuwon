// ============================================================================
// Server config — paths + the read API base.
// ----------------------------------------------------------------------------
// The teacher app lives at <repo>/teacher, the generation pipeline at
// <repo>/infra/pipeline. Next runs with cwd = teacher/, so the repo root is one
// level up. (The pipeline resolves its OWN paths via import.meta.url, so cwd
// only needs to be somewhere sane — we use the repo root.)
// ============================================================================
import path from "node:path";

export const REPO_ROOT = path.resolve(process.cwd(), "..");
export const PIPELINE_CLI = path.join(REPO_ROOT, "infra", "pipeline", "pipeline.mjs");

// The same public read API the student app uses (Lambda Function URL). The
// gallery reads the catalog here for ready sessions + their status/icon.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://rftxk2xx7qqicrcj6x54fzgkxa0zqouv.lambda-url.ap-southeast-1.on.aws/";
