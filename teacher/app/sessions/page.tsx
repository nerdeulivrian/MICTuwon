// ============================================================================
// T04 — Sessions Gallery
// ----------------------------------------------------------------------------
// A bento of the teacher's sessions, polling GET /api/sessions every few
// seconds so a freshly generated session shows as "processing" and flips to
// "ready" live. Each card's badge glyph comes from the payload's `icon` (same
// resolver as the student app). Ready cards show the QR + shareable code the
// student scans/enters; failed cards offer "Try again".
// ============================================================================
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, ListFilter, CircleCheckBig, Loader, TriangleAlert, Link as LinkIcon,
  Copy, Check, RotateCcw, LayoutGrid,
} from "lucide-react";
import AppShell from "@/app/components/AppShell";
import { sessionIcon } from "@/app/components/sessionIcon";
import Qr from "@/app/components/Qr";
import ShareModal from "./ShareModal";
import styles from "./sessions.module.css";

interface GallerySession {
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

// The student scans/enters this; the scanner takes the last path segment, so a
// tuwon.app/s/<code> link resolves to the sessionId in the catalog.
const SHARE_HOST = "tuwon.app/s/";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<GallerySession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [shareSession, setShareSession] = useState<GallerySession | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/sessions", { cache: "no-store" });
        const d = await r.json();
        if (alive) {
          setSessions(d.sessions ?? []);
          setLoaded(true);
        }
      } catch {
        if (alive) setLoaded(true);
      }
    };
    load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const building = sessions.filter((s) => s.status === "processing").length;
  const colL = sessions.filter((_, i) => i % 2 === 0);
  const colR = sessions.filter((_, i) => i % 2 === 1);

  async function retry(s: GallerySession) {
    try {
      await fetch("/api/sessions/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: s.title, slides: 1, questions: 3 }),
      });
    } catch {
      /* the failed card stays; polling will pick up the new processing one */
    }
  }

  return (
    <AppShell active="sessions">
      <div className={styles.topbar}>
        <span className={styles.title}>My Sessions</span>
        <Link href="/chat" className={styles.newBtn}>
          <Plus size={18} strokeWidth={2.5} />
          New session
        </Link>
      </div>

      <div className={styles.gallery}>
        <div className={styles.subRow}>
          <span className={styles.count}>
            {loaded
              ? `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}${building ? ` · ${building} building` : ""}`
              : "Loading…"}
          </span>
          <span className={styles.filter}>
            <ListFilter size={15} strokeWidth={2.5} />
            All
          </span>
        </div>

        {loaded && sessions.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <LayoutGrid size={34} color="var(--primary)" strokeWidth={2.5} />
            </div>
            <h2 className={styles.emptyTitle}>No sessions yet</h2>
            <p className={styles.emptyBody}>
              Head to the AI Assistant and describe a topic — your generated
              sessions will show up here, ready to share.
            </p>
            <Link href="/chat" className={styles.newBtn}>
              <Plus size={18} strokeWidth={2.5} />
              Create one
            </Link>
          </div>
        ) : (
          <div className={styles.bento}>
            <div className={styles.col}>
              {colL.map((s) => (
                <Card key={s.sessionId} s={s} onRetry={retry} onShare={setShareSession} />
              ))}
            </div>
            <div className={styles.col}>
              {colR.map((s) => (
                <Card key={s.sessionId} s={s} onRetry={retry} onShare={setShareSession} />
              ))}
            </div>
          </div>
        )}
      </div>
      {shareSession && (
        <ShareModal session={shareSession} onClose={() => setShareSession(null)} />
      )}
    </AppShell>
  );
}

function Card({ s, onRetry, onShare }: { s: GallerySession; onRetry: (s: GallerySession) => void; onShare: (s: GallerySession) => void }) {
  const { Icon, tint, bg } = sessionIcon(s.icon);
  const link = `${SHARE_HOST}${s.sessionId}`;
  const fullLink = `https://${link}`;
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      ?.writeText(fullLink)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  const minutes = s.estimatedMinutes ?? Math.max(2, s.questionCount ?? 0);
  const info = `${s.questionCount ?? 0} questions · ${s.slideCount ?? 0} slides · ~${minutes} min`;

  return (
    <div
      className={`${styles.card} ${s.status === "ready" ? styles.cardClickable : ""}`}
      onClick={s.status === "ready" ? () => onShare(s) : undefined}
      role={s.status === "ready" ? "button" : undefined}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardIcon} style={{ background: bg, color: tint }}>
          <Icon size={26} strokeWidth={2.5} />
        </div>
        <div className={styles.meta}>
          <span className={styles.cardTitle}>{s.title}</span>
          {s.status === "ready" ? (
            <div className={styles.tags}>
              <span className={styles.quizTag}>QUIZ</span>
              <span className={styles.dot}>·</span>
              <span className={styles.info}>{info}</span>
            </div>
          ) : (
            <span className={styles.info}>
              {s.status === "failed"
                ? s.error || "Generation failed"
                : "Generating voice & image…"}
            </span>
          )}
        </div>
        <StatusPill status={s.status} />
      </div>

      {s.status === "ready" && (
        <div className={styles.shareRow}>
          <div className={styles.qr}>
            <Qr value={fullLink} size={72} />
          </div>
          <div className={styles.linkCol}>
            <span className={styles.linkLabel}>SHAREABLE LINK</span>
            <div className={styles.linkBox}>
              <LinkIcon size={15} strokeWidth={2.5} color="var(--text-secondary)" />
              <span className={styles.url}>{link}</span>
              <button
                className={styles.copy}
                onClick={(e) => {
                  e.stopPropagation();
                  copy();
                }}
              >
                {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} strokeWidth={2.5} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {s.status === "processing" && (
        <div className={styles.progress}>
          <div className={styles.track}>
            <div className={styles.fill} />
          </div>
          <span className={styles.note}>Generating voice &amp; image… about a minute</span>
        </div>
      )}

      {s.status === "failed" && (
        <button className={styles.retry} onClick={() => onRetry(s)}>
          <RotateCcw size={16} strokeWidth={2.5} />
          Try again
        </button>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: GallerySession["status"] }) {
  if (status === "ready")
    return (
      <span className={`${styles.status} ${styles.statusReady}`}>
        <CircleCheckBig size={15} strokeWidth={2.5} />
        Ready
      </span>
    );
  if (status === "failed")
    return (
      <span className={`${styles.status} ${styles.statusFailed}`}>
        <TriangleAlert size={15} strokeWidth={2.5} />
        Failed
      </span>
    );
  return (
    <span className={`${styles.status} ${styles.statusProcessing}`}>
      <Loader size={15} strokeWidth={2.5} className={styles.spin} />
      Processing
    </span>
  );
}
