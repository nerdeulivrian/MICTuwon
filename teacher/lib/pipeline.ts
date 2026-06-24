// ============================================================================
// Pipeline runner (SERVER ONLY) — spawns the proven infra/pipeline CLI.
// ----------------------------------------------------------------------------
// We reuse the exact CLI that already works end-to-end (Author → Media →
// Publish) by spawning it as a child process. This keeps ALL secrets server-
// side: the pipeline reads its own keys from infra/.env and uses the machine's
// AWS credentials — the browser never sees them, and there is no public write
// endpoint. The child runs detached from the HTTP request (which returns
// immediately with a "processing" job); its exit code flips the job to
// ready/failed in the registry.
// ============================================================================
import { spawn } from "node:child_process";
import { PIPELINE_CLI, REPO_ROOT } from "./config";
import { upsertJob, setJobStatus } from "./jobs";

export interface GenerateInput {
  topic: string;
  slides: number;
  questions: number;
}

// URL/QR-safe session code derived from the topic, plus a short suffix so the
// same topic twice doesn't collide. This code is what the student scans/enters.
function makeSessionId(topic: string): string {
  const slug =
    topic
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "session";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug}-${suffix}`;
}

export function startGeneration(input: GenerateInput): { sessionId: string } {
  const sessionId = makeSessionId(input.topic);

  upsertJob({
    sessionId,
    topic: input.topic,
    slides: input.slides,
    questions: input.questions,
    status: "processing",
    startedAt: Date.now(),
  });

  const args = [
    PIPELINE_CLI,
    "make",
    input.topic,
    "--slides",
    String(input.slides),
    "--questions",
    String(input.questions),
    "--session",
    sessionId,
  ];

  // process.execPath = the same Node binary running Next → guarantees the .mjs
  // pipeline runs under the same runtime. cwd = repo root (paths are module-
  // relative anyway); env inherited so AWS creds + PATH reach the child.
  const child = spawn(process.execPath, args, {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let errTail = "";
  child.stderr?.on("data", (d: Buffer) => {
    errTail = (errTail + d.toString()).slice(-2000);
  });
  child.on("exit", (code) => {
    if (code === 0) {
      setJobStatus(sessionId, "ready");
    } else {
      const lastLine = errTail.trim().split("\n").pop() || `pipeline exited ${code}`;
      setJobStatus(sessionId, "failed", lastLine);
    }
  });
  child.on("error", (e) => setJobStatus(sessionId, "failed", e.message));

  return { sessionId };
}
