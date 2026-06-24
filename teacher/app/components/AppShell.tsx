// ============================================================================
// AppShell — the authed layout: a fixed sidebar (brand, nav, Mr. Mic) + main.
// Shared by the chat (T01/T03) and the sessions gallery (T04). `active` marks
// the current nav tab. Mr. Mic is hardcoded (no real auth).
// ============================================================================
import Link from "next/link";
import { Sparkles, LayoutGrid } from "lucide-react";
import styles from "./appShell.module.css";

export default function AppShell({
  active,
  children,
}: {
  active: "chat" | "sessions";
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <div className={styles.mark}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="tuwon" className={styles.markImg} />
            </div>
            <span className={styles.wordmark}>tuwon</span>
          </div>
          <nav className={styles.nav}>
            <Link
              href="/chat"
              className={`${styles.tab} ${active === "chat" ? styles.tabActive : ""}`}
            >
              <Sparkles size={20} strokeWidth={2.5} />
              <span>AI Assistant</span>
            </Link>
            <Link
              href="/sessions"
              className={`${styles.tab} ${active === "sessions" ? styles.tabActive : ""}`}
            >
              <LayoutGrid size={20} strokeWidth={2.5} />
              <span>My Sessions</span>
            </Link>
          </nav>
        </div>
        <div className={styles.user}>
          <div className={styles.avatar}>M</div>
          <div className={styles.userText}>
            <span className={styles.userName}>Mr. Mic</span>
            <span className={styles.userRole}>Teacher</span>
          </div>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
