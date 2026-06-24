// ============================================================================
// PAYLOAD LOADER
// ----------------------------------------------------------------------------
// The single seam the player reads sessions through. It serves the live AWS
// payload API when one is configured, and the hand-written mocks otherwise —
// the player never changes, only this module knows where a session comes from.
//
//   EXPO_PUBLIC_API_URL set   → fetch by sessionId from the API (tuwon-api),
//                               fall back to the bundled mocks on ANY failure.
//   EXPO_PUBLIC_API_URL unset → mocks only (identical to before this seam).
//
// OFFLINE is sacred (Phase 4: download = ownership). A downloaded session must
// load with no network. The two demo sessions are bundled as mocks, so the
// fallback IS the offline path — and the fetch is wrapped in a short timeout so
// an offline device fails fast to mocks instead of hanging on a dead socket.
// (Once the download manager persists fetched payloads to disk, that local copy
// becomes the offline source for non-mock sessions too; see downloadManager.ts.)
//
// Everything is async on purpose so the call sites already handle loading /
// error states that real network fetches need.
// ============================================================================
import type { Payload } from "../types/payload";
import { photosynthesisQuiz } from "../mocks/photosynthesisQuiz";
import { waterCycleQuiz } from "../mocks/waterCycleQuiz";
import { isSlide } from "../types/payload";
import { readPayload } from "./offline";

const MOCKS: Payload[] = [photosynthesisQuiz, waterCycleQuiz];

// Live payload API base URL. Must be a STATIC `process.env.EXPO_PUBLIC_*`
// reference — Expo SDK 56 only inlines that form (bracket access / destructure
// stay undefined). Trailing slashes trimmed so we can join paths cleanly.
const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";

// Keep the offline path snappy: bail on a stalled request so the mock fallback
// kicks in fast instead of waiting out the platform's default socket timeout.
const FETCH_TIMEOUT_MS = 6000;

/** GET `path` off the payload API as JSON, with a fail-fast timeout. */
async function apiGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`tuwon-api ${path} → ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Lightweight card data for the Library, without loading full payloads. */
export interface SessionSummary {
  sessionId: string;
  title: string;
  createdBy: string;
  estimatedMinutes: number;
  questionCount: number;
  slideCount: number;
  /** Lucide glyph name for the card badge (from the payload's `icon`). */
  icon?: string;
}

export function summarize(p: Payload): SessionSummary {
  let questionCount = 0;
  let slideCount = 0;
  for (const b of p.blocks) {
    if (isSlide(b)) slideCount++;
    else questionCount++;
  }
  return {
    sessionId: p.sessionId,
    title: p.title,
    createdBy: p.createdBy,
    estimatedMinutes: p.estimatedMinutes,
    questionCount,
    slideCount,
    icon: p.icon,
  };
}

export async function listSessions(): Promise<SessionSummary[]> {
  if (!API_BASE) return MOCKS.map(summarize);
  try {
    const { sessions } = await apiGet<{ sessions: SessionSummary[] }>("/sessions");
    return sessions;
  } catch (e) {
    // Catalog is best-effort: offline or API down → show the bundled sessions
    // (which are exactly what's downloadable for offline use anyway).
    console.warn("loader: /sessions failed, using mocks", e);
    return MOCKS.map(summarize);
  }
}

export async function loadPayload(sessionId: string): Promise<Payload> {
  // OFFLINE FIRST: a downloaded session keeps its full payload on disk, so it
  // opens with no network — including non-mock sessions the API would otherwise
  // be the only source for. This is what makes "download = ownership" real.
  const offline = readPayload(sessionId);
  if (offline) return offline;

  if (API_BASE) {
    try {
      return await apiGet<Payload>(`/sessions/${encodeURIComponent(sessionId)}`);
    } catch (e) {
      // Fall through to mocks: graceful degrade if the API is unreachable and the
      // session isn't downloaded (e.g. browsing a demo session before download).
      console.warn(`loader: /sessions/${sessionId} failed, trying mocks`, e);
    }
  }
  const found = MOCKS.find((p) => p.sessionId === sessionId);
  if (!found) {
    throw new Error(`Unknown session: ${sessionId}`);
  }
  return found;
}

