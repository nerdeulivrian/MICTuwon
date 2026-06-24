// ============================================================================
// Catalog — the live "ready" sessions from the read API (student catalog).
// ----------------------------------------------------------------------------
// Ready sessions (those with a published payload) come from the same Lambda the
// student app reads. The gallery merges these with the in-flight job registry.
// ============================================================================
import { API_BASE } from "./config";

export interface CatalogSession {
  sessionId: string;
  title: string;
  createdBy: string;
  estimatedMinutes: number;
  questionCount: number;
  slideCount: number;
  icon?: string;
  status?: string;
}

export async function fetchCatalog(): Promise<CatalogSession[]> {
  const res = await fetch(new URL("sessions", API_BASE), { cache: "no-store" });
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
  const data = (await res.json()) as { sessions?: CatalogSession[] };
  return data.sessions ?? [];
}
