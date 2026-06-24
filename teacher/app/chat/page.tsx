// ============================================================================
// T01 / T03 — AI Chat
// ----------------------------------------------------------------------------
// Empty state (T01): hero + "What should we teach today?" + suggestion chips.
// Active state (T03): the message thread. The teacher describes a topic; the
// assistant replies (streaming typewriter feel) and offers "Build it", which
// fires POST /api/sessions/generate and routes to the sessions gallery where
// the new card appears as "processing" → "ready".
//
// NOTE: the assistant is a lightweight scripted guide (deterministic + demo-
// safe), not a general LLM — its job is to capture the topic, ask a quick
// AskUserQuestion-style config (T02, see AskQuestion.tsx), and trigger the real
// generation pipeline with the chosen #slides / #questions.
// ============================================================================
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Paperclip, ArrowUp, WandSparkles, Zap, BookOpen, Layers } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import AskQuestion, { type SizeOption } from "./AskQuestion";
import styles from "./chat.module.css";

type Msg = { role: "user" | "assistant"; text: string; cta?: boolean };

const SUGGESTIONS = [
  "Photosynthesis for grade 5",
  "Quiz on World War II",
  "Fractions, no slides",
];

// Preset session sizes for the AskUserQuestion config card (T02). Each maps to
// the pipeline's --slides / --questions. MVP is quiz-only, so size = how much.
const SIZE_OPTIONS: SizeOption[] = [
  { id: "quick", title: "Quick", sub: "1 slide · 3 questions", slides: 1, questions: 3, Icon: Zap },
  { id: "standard", title: "Standard", sub: "1 slide · 5 questions", slides: 1, questions: 5, Icon: BookOpen },
  { id: "indepth", title: "In-depth", sub: "2 slides · 7 questions", slides: 2, questions: 7, Icon: Layers },
  { id: "ai", title: "Let the AI decide", sub: "I'll choose a sensible size", slides: 1, questions: 4, Icon: Sparkles },
];

// Best-effort parse of a free-form "Something else" reply into a size. Picks up
// counts like "2 slides" / "6 questions"; falls back to a sensible default.
function parseSize(text: string): { slides: number; questions: number } {
  const s = text.match(/(\d+)\s*slides?/i);
  const q = text.match(/(\d+)\s*questions?/i);
  const slides = s ? Math.max(0, Math.min(5, parseInt(s[1], 10))) : 1;
  const questions = q ? Math.max(1, Math.min(12, parseInt(q[1], 10))) : 3;
  return { slides, questions };
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const convRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = messages.length > 0;

  useEffect(() => {
    convRef.current?.scrollTo({ top: convRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, showConfig]);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  // Reveal an assistant message with a typewriter effect; fire onDone when fully
  // revealed, and optionally pin a "Build it" CTA to it.
  function streamAssistant(text: string, opts?: { cta?: boolean; onDone?: () => void }) {
    setBusy(true);
    setMessages((m) => [...m, { role: "assistant", text: "" }]);
    let i = 0;
    timer.current = setInterval(() => {
      i += 2;
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", text: text.slice(0, i) };
        return copy;
      });
      if (i >= text.length) {
        if (timer.current) clearInterval(timer.current);
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", text, cta: opts?.cta };
          return copy;
        });
        setBusy(false);
        opts?.onDone?.();
      }
    }, 16);
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: t }]);
    if (!topic) {
      setTopic(t);
      window.setTimeout(
        () =>
          streamAssistant(
            `Great choice! I'll build a voiced, interactive session on "${t}". One quick thing first — how big should it be?`,
            { onDone: () => setShowConfig(true) }
          ),
        250
      );
    } else if (showConfig) {
      // Free-form "Something else" reply — parse any slide/question counts the
      // teacher typed, then build (sensible defaults if none were given).
      setShowConfig(false);
      const { slides, questions } = parseSize(t);
      startBuild(slides, questions);
    } else {
      window.setTimeout(
        () =>
          streamAssistant(
            `Got it — I'll keep that in mind. Pick a size below, or hit "Build it" and I'll use a sensible default.`,
            { cta: true }
          ),
        250
      );
    }
  }

  // The teacher picked a preset size → echo it and start the real generation.
  function chooseSize(o: SizeOption) {
    setShowConfig(false);
    setMessages((m) => [...m, { role: "user", text: `${o.title} — ${o.sub}` }]);
    startBuild(o.slides, o.questions);
  }

  function skipConfig() {
    setShowConfig(false);
    setMessages((m) => [...m, { role: "user", text: "Use a sensible default" }]);
    startBuild(1, 3);
  }

  // Dismiss without choosing; pin a "Build it" fallback on the last assistant
  // message so the teacher can still generate (or just type a reply).
  function dismissConfig() {
    setShowConfig(false);
    setMessages((m) => {
      const copy = [...m];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant") {
          copy[i] = { ...copy[i], cta: true };
          break;
        }
      }
      return copy;
    });
  }

  function startBuild(slides: number, questions: number) {
    if (!topic) return;
    setMessages((m) => m.map((msg) => ({ ...msg, cta: false })));
    streamAssistant(
      `Building "${topic}" now — about a minute. I'll take you to My Sessions where it'll appear and turn ready when it's done.`
    );
    void generate(slides, questions);
  }

  async function generate(slides: number, questions: number) {
    try {
      const res = await fetch("/api/sessions/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, slides, questions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "generation failed");
      window.setTimeout(() => router.push("/sessions"), 1400);
    } catch {
      window.setTimeout(
        () => streamAssistant("Sorry — I couldn't start that generation. Please try again."),
        300
      );
    }
  }

  function newChat() {
    if (timer.current) clearInterval(timer.current);
    setMessages([]);
    setTopic(null);
    setInput("");
    setBusy(false);
    setShowConfig(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <AppShell active="chat">
      <div className={styles.topbar}>
        <span className={styles.topTitle}>{topic ?? "New session"}</span>
        <button className={styles.newChat} onClick={newChat}>
          <Plus size={16} strokeWidth={2.5} />
          New chat
        </button>
      </div>

      {!active ? (
        <div className={styles.center}>
          <div className={styles.headline}>
            <h1 className={styles.h1}>What should we teach today?</h1>
            <p className={styles.sub}>
              Describe a topic or upload your material. I&apos;ll build a complete,
              voiced learning session and give you a link to share with students.
            </p>
          </div>
          <div className={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <button key={s} className={styles.chip} onClick={() => send(s)}>
                <WandSparkles size={15} strokeWidth={2.5} />
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.conversation} ref={convRef}>
          <div className={styles.thread}>
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className={styles.userMsg}>
                  <div className={styles.userBubble}>{m.text}</div>
                </div>
              ) : (
                <div key={i} className={styles.aiMsg}>
                  <div className={styles.aiAvatar}>
                    <Sparkles size={18} color="#fff" strokeWidth={2.5} />
                  </div>
                  <div className={styles.aiBubble}>
                    <span>
                      {m.text}
                      {busy && i === messages.length - 1 && (
                        <span className={styles.caret}>▍</span>
                      )}
                    </span>
                    {m.cta && (
                      <button
                        className={styles.buildCta}
                        onClick={() => startBuild(1, 3)}
                        disabled={busy}
                      >
                        <WandSparkles size={16} strokeWidth={2.5} />
                        Build it
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className={styles.inputWrap}>
        {showConfig && (
          <AskQuestion
            question="How big should this session be?"
            options={SIZE_OPTIONS}
            onSelect={chooseSize}
            onSkip={skipConfig}
            onClose={dismissConfig}
            onType={() => textareaRef.current?.focus()}
          />
        )}
        <div className={styles.composer}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={1}
            value={input}
            placeholder={
              showConfig
                ? "Type your reply… e.g. 2 slides, 6 questions"
                : active
                  ? "Reply to the assistant…"
                  : "Make me a session about the water cycle…"
            }
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className={styles.composerRow}>
            <button
              className={styles.upload}
              title="Uploads coming soon"
              type="button"
            >
              <Paperclip size={16} strokeWidth={2.5} />
              Upload
            </button>
            <button
              className={styles.send}
              onClick={() => send(input)}
              disabled={!input.trim() || busy}
              aria-label="Send"
            >
              <ArrowUp size={22} color="#fff" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
