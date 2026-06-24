// ============================================================================
// Job registry — tracks in-flight generations.
// ----------------------------------------------------------------------------
// A session is "processing" before its payload exists, so it does NOT appear in
// the student catalog yet. The teacher app remembers the jobs IT kicked off
// here (and their live status), so the gallery can show a processing card and
// flip it to ready/failed. In-memory is fine for the local single-teacher MVP
// (it resets if the dev server restarts). Kept on globalThis so it survives
// Next's hot-reload module re-evaluation in dev.
// ============================================================================
export type JobStatus = "processing" | "ready" | "failed";

export interface Job {
  sessionId: string;
  topic: string;
  slides: number;
  questions: number;
  status: JobStatus;
  startedAt: number;
  error?: string;
}

const store: Map<string, Job> =
  (globalThis as unknown as { __tuwonJobs?: Map<string, Job> }).__tuwonJobs ??
  ((globalThis as unknown as { __tuwonJobs?: Map<string, Job> }).__tuwonJobs = new Map());

export function upsertJob(job: Job): void {
  store.set(job.sessionId, job);
}

export function setJobStatus(sessionId: string, status: JobStatus, error?: string): void {
  const job = store.get(sessionId);
  if (job) {
    job.status = status;
    if (error) job.error = error;
  }
}

export function listJobs(): Job[] {
  return [...store.values()];
}

export function getJob(sessionId: string): Job | undefined {
  return store.get(sessionId);
}
