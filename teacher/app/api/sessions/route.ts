// GET /api/sessions  → the teacher gallery feed: live "ready" sessions from the
// read API, overlaid with this server's in-flight jobs (processing/failed).
import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";
import { fetchCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface GallerySession {
  sessionId: string;
  title: string;
  createdBy: string;
  status: "processing" | "ready" | "failed";
  icon?: string;
  estimatedMinutes?: number;
  questionCount?: number;
  slideCount?: number;
  error?: string;
}

export async function GET() {
  const catalog = await fetchCatalog().catch(() => []);
  const jobs = listJobs();

  const byId = new Map<string, GallerySession>();

  // Ready (and any other) sessions from the live catalog.
  for (const s of catalog) {
    byId.set(s.sessionId, {
      sessionId: s.sessionId,
      title: s.title,
      createdBy: s.createdBy,
      status: (s.status as GallerySession["status"]) ?? "ready",
      icon: s.icon,
      estimatedMinutes: s.estimatedMinutes,
      questionCount: s.questionCount,
      slideCount: s.slideCount,
    });
  }

  // Overlay in-flight jobs. Once the catalog has it as ready, the catalog wins
  // (it has the real title/icon); otherwise show the job's processing/failed.
  for (const j of jobs) {
    const existing = byId.get(j.sessionId);
    if (existing && existing.status === "ready") continue;
    byId.set(j.sessionId, {
      sessionId: j.sessionId,
      title: existing?.title ?? j.topic,
      createdBy: "Mr. Mic",
      status: j.status,
      icon: existing?.icon,
      estimatedMinutes: existing?.estimatedMinutes,
      questionCount: existing?.questionCount ?? j.questions,
      slideCount: existing?.slideCount ?? j.slides,
      error: j.error,
    });
  }

  const sessions = [...byId.values()].sort((a, b) =>
    a.title.localeCompare(b.title)
  );
  return NextResponse.json({ sessions });
}
