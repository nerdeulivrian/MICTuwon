// POST /api/sessions/generate  → kick off a generation (returns immediately).
// Body: { topic: string, slides?: number, questions?: number }
import { NextResponse } from "next/server";
import { startGeneration } from "@/lib/pipeline";

export const runtime = "nodejs"; // needs child_process
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const topic = String(body?.topic ?? "").trim();
  const slides = Number.isInteger(body?.slides) ? Number(body.slides) : 1;
  const questions = Number.isInteger(body?.questions) ? Number(body.questions) : 3;

  if (!topic) {
    return NextResponse.json({ error: "topic required" }, { status: 400 });
  }
  if (questions < 1 || slides < 0) {
    return NextResponse.json({ error: "invalid slides/questions" }, { status: 400 });
  }

  const { sessionId } = startGeneration({ topic, slides, questions });
  return NextResponse.json({ sessionId, status: "processing" });
}
