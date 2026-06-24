// ============================================================================
// DOWNLOADED-SESSIONS STORE
// ----------------------------------------------------------------------------
// The single source of truth for "which sessions are downloaded on THIS
// device." The Library renders straight from it; the Intro reads it to decide
// whether to show DOWNLOAD or LET'S GO + Delete.
//
// It stores the full SessionSummary captured AT DOWNLOAD TIME, not just the id.
// That's what makes the shelf self-sufficient: the Library can render every
// downloaded card with NO catalog fetch and NO network — exactly the "download
// = ownership, available offline" promise. (Keying the shelf off the live
// catalog was the bug: the catalog is fetched once and falls back to mocks
// offline, so a freshly-downloaded or non-mock session would vanish from the
// shelf.)
//
// Persisted as a tiny JSON index in app-private storage (Paths.document, which
// "survives" relaunch — see expo-file-system v56 docs) so the shelf is the same
// next launch. The map lives in memory and is mirrored to disk on every change;
// screens subscribe via useSyncExternalStore so a download/delete on one screen
// updates the other with no manual refresh.
//
// This only tracks WHAT is downloaded. The act of downloading (fetching the
// payload + asset bytes to disk) lives in `downloadManager.ts` / `offline.ts`.
// ============================================================================
import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";
import type { SessionSummary } from "./loader";
import { rehydrateResolver } from "./offline";

const FILE_NAME = "downloads.json";

interface DownloadsState {
  /** True once the persisted index has been read off disk (or confirmed absent). */
  ready: boolean;
  /** Downloaded sessions on this device, keyed by sessionId (summary captured at download time). */
  sessions: ReadonlyMap<string, SessionSummary>;
}

let state: DownloadsState = { ready: false, sessions: new Map() };
let loadStarted = false;
const listeners = new Set<() => void>();

function indexFile(): File {
  return new File(Paths.document, FILE_NAME);
}

function notify(): void {
  for (const listener of listeners) listener();
}

// Replace state immutably (useSyncExternalStore needs a stable snapshot that
// only changes by reference when the data actually changes) and notify.
function setState(next: DownloadsState): void {
  state = next;
  notify();
}

// Mirror the current shelf to disk. Best-effort: a write failure leaves the
// in-memory shelf correct for this session, it just won't survive relaunch.
function persist(): void {
  try {
    const file = indexFile();
    file.create({ overwrite: true });
    file.write(JSON.stringify({ sessions: [...state.sessions.values()] }));
  } catch (e) {
    console.warn("downloads: failed to persist index", e);
  }
}

/** Read the persisted index into memory. Idempotent — only does work once. */
export async function loadDownloads(): Promise<void> {
  if (loadStarted) return;
  loadStarted = true;
  const sessions = new Map<string, SessionSummary>();
  try {
    const file = indexFile();
    if (file.exists) {
      // Format: { sessions: SessionSummary[] }. A file from an unexpected/older
      // shape just yields an empty shelf (re-download repopulates it) rather
      // than throwing — the feature is unreleased, so there's no legacy data to
      // migrate, only this one device's working file.
      const parsed = JSON.parse(await file.text()) as { sessions?: SessionSummary[] };
      for (const s of parsed.sessions ?? []) sessions.set(s.sessionId, s);
    }
  } catch (e) {
    console.warn("downloads: failed to read index, starting empty", e);
  } finally {
    setState({ ready: true, sessions });
    // Point the asset resolver at the local files for everything on the shelf,
    // so a cold launch (incl. offline) plays downloaded sessions from disk.
    rehydrateResolver([...sessions.keys()]);
  }
}

/** Mark a session downloaded with its summary (replaces any prior entry). Persists + notifies. */
export function markDownloaded(summary: SessionSummary): void {
  const existing = state.sessions.get(summary.sessionId);
  // Skip the write if nothing actually changed (cheap shallow compare on the
  // fields the shelf renders) so re-downloads don't churn disk + re-render.
  if (existing && shallowEqualSummary(existing, summary)) return;
  const sessions = new Map(state.sessions);
  sessions.set(summary.sessionId, summary);
  setState({ ready: true, sessions });
  persist();
}

/** Current downloaded sessionIds (non-reactive snapshot). Used by the download
 *  manager / launch bootstrap to rehydrate the offline resolver from disk. */
export function downloadedSessionIds(): string[] {
  return [...state.sessions.keys()];
}

/** Remove a session from the shelf (no-op if absent). Persists + notifies. */
export function unmarkDownloaded(sessionId: string): void {
  if (!state.sessions.has(sessionId)) return;
  const sessions = new Map(state.sessions);
  sessions.delete(sessionId);
  setState({ ready: true, sessions });
  persist();
}

function shallowEqualSummary(a: SessionSummary, b: SessionSummary): boolean {
  return (
    a.sessionId === b.sessionId &&
    a.icon === b.icon &&
    a.title === b.title &&
    a.createdBy === b.createdBy &&
    a.estimatedMinutes === b.estimatedMinutes &&
    a.questionCount === b.questionCount &&
    a.slideCount === b.slideCount
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): DownloadsState {
  return state;
}

/**
 * Reactive view of the downloads shelf. Kicks off the one-time load on first
 * use and re-renders the caller whenever a session is downloaded or deleted.
 */
export function useDownloads(): DownloadsState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  // Fire-and-forget; guarded so concurrent callers don't double-load.
  if (!loadStarted) void loadDownloads();
  return snapshot;
}

/** Convenience: is this one session downloaded? (`ready` ignored — absent = false.) */
export function useIsDownloaded(sessionId: string): { downloaded: boolean; ready: boolean } {
  const { sessions, ready } = useDownloads();
  return { downloaded: sessions.has(sessionId), ready };
}
