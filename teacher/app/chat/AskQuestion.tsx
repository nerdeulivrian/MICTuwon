// ============================================================================
// AskQuestion (T02) — a docked option-picker card shown above the composer.
// ----------------------------------------------------------------------------
// The assistant asks one structured question and offers tap-to-pick options
// (each sets the generation config), plus a "Something else" hint with a Skip
// button. Modeled on the design's Ask Question Card.
// ============================================================================
"use client";
import { Sparkles, X, CornerDownLeft, Pencil, type LucideIcon } from "lucide-react";
import styles from "./chat.module.css";

export interface SizeOption {
  id: string;
  title: string;
  sub: string;
  slides: number;
  questions: number;
  Icon: LucideIcon;
}

export default function AskQuestion({
  question,
  options,
  onSelect,
  onSkip,
  onClose,
  onType,
}: {
  question: string;
  options: SizeOption[];
  onSelect: (o: SizeOption) => void;
  onSkip: () => void;
  onClose: () => void;
  onType: () => void;
}) {
  return (
    <div className={styles.askCard}>
      <div className={styles.askHead}>
        <div className={styles.askHeadLeft}>
          <Sparkles size={17} color="var(--primary)" strokeWidth={2.5} />
          <span className={styles.askQ}>{question}</span>
        </div>
        <button className={styles.askClose} onClick={onClose} aria-label="Dismiss">
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className={styles.askOptions}>
        {options.map((o, idx) => (
          <button
            key={o.id}
            className={`${styles.askOption} ${idx === 0 ? styles.askOptionFocus : ""}`}
            onClick={() => onSelect(o)}
          >
            <span className={styles.askBadge}>
              <o.Icon size={16} strokeWidth={2.5} />
            </span>
            <span className={styles.askText}>
              <span className={styles.askTitle}>{o.title}</span>
              <span className={styles.askSub}>{o.sub}</span>
            </span>
            <CornerDownLeft className={styles.askEnter} size={17} strokeWidth={2.5} />
          </button>
        ))}

        <div className={styles.askSomething}>
          <button className={styles.askSomethingMain} onClick={onType}>
            <span className={styles.askBadge}>
              <Pencil size={16} strokeWidth={2.5} />
            </span>
            <span className={styles.askSomethingLabel}>
              Something else — just type your reply
            </span>
          </button>
          <button className={styles.askSkip} onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
