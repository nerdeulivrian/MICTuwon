// ============================================================================
// T05 — Share Modal
// ----------------------------------------------------------------------------
// Opened from a ready gallery card. Shows a big QR (encodes the scannable
// tuwon.app/s/<code> link) and the bare session CODE for manual entry — the
// two ways a student adds the session in the Android app, then downloads it for
// offline use.
// ============================================================================
"use client";
import { useEffect, useState } from "react";
import { CircleCheckBig, X, Link as LinkIcon, Copy, Check } from "lucide-react";
import Qr from "@/app/components/Qr";
import styles from "./sessions.module.css";

export interface ShareSession {
  sessionId: string;
  title: string;
  questionCount?: number;
  slideCount?: number;
  estimatedMinutes?: number;
}

export default function ShareModal({
  session,
  onClose,
}: {
  session: ShareSession;
  onClose: () => void;
}) {
  const code = session.sessionId;
  const fullLink = `https://tuwon.app/s/${code}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copy() {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  const minutes = session.estimatedMinutes ?? Math.max(2, session.questionCount ?? 0);
  const sub = `Quiz · ${session.questionCount ?? 0} questions · ${session.slideCount ?? 0} slides · ~${minutes} min`;

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <div className={styles.modalBadge}>
              <CircleCheckBig size={19} color="var(--correct-text)" strokeWidth={2.5} />
            </div>
            <span className={styles.modalTitle}>Session ready to share</span>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.titleWrap}>
            <span className={styles.modalName}>{session.title}</span>
            <span className={styles.modalSub}>{sub}</span>
          </div>

          <div className={styles.qrBig}>
            <Qr value={fullLink} size={150} />
          </div>
          <p className={styles.scanHint}>
            Students scan this in the tuwon app to download the session for
            offline use.
          </p>

          <div className={styles.linkWrap}>
            <span className={styles.linkWrapLabel}>OR SHARE THIS CODE</span>
            <div className={styles.linkRow}>
              <LinkIcon size={16} strokeWidth={2.5} color="var(--text-secondary)" />
              <span className={styles.code}>{code}</span>
              <button className={styles.modalCopy} onClick={copy}>
                {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.5} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <button className={styles.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
