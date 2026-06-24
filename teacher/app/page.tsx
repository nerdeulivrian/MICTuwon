// ============================================================================
// T00 — Fake Teacher Login
// ----------------------------------------------------------------------------
// No real auth (per the MVP plan): the teacher is hardcoded as "Mr. Mic"
// (the pipeline already stamps that as `createdBy` server-side). "Continue with
// Google" is for-show — it just navigates to the chat. Left: orange brand
// panel; right: the login card.
// ============================================================================
import Link from "next/link";
import styles from "./page.module.css";

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.screen}>
      <aside className={styles.brand}>
        <div className={styles.brandTop}>
          <div className={styles.mark}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="tuwon" className={styles.markImg} />
          </div>
          <span className={styles.wordmark}>tuwon</span>
        </div>
        <div className={styles.hero}>
          <h1 className={styles.headline}>Turn any topic into a gamified lesson.</h1>
          <p className={styles.subhead}>
            Describe what you want to teach and let the AI build a voiced,
            interactive session your students can play anywhere.
          </p>
        </div>
        <p className={styles.footer}>For Mindanao Innovation Cup</p>
      </aside>

      <main className={styles.panel}>
        <div className={styles.card}>
          <div className={styles.heading}>
            <h2 className={styles.title}>Welcome, Teacher</h2>
            <p className={styles.sub}>Sign in to create and share your sessions</p>
          </div>
          <Link href="/chat" className={styles.google}>
            <GoogleG />
            <span>Continue with Google</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
