"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { MR_POPPIN_OPENING } from "@/lib/knowledge";

const THREAD_STORAGE_KEY = "tpp_mr_poppin_thread";

type Source = {
  essayId: number;
  essaySlug: string;
  essayTitle: string;
  essayCategory: string;
  chunkId: number;
  chunkOrder: number;
  kind: string;
  heading: string | null;
  excerpt: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-4 grid gap-2">
      {sources.map(source => (
        <a
          key={`${source.chunkId}-${source.essaySlug}`}
          href={`/essays/${source.essaySlug}`}
          className="block p-3 rounded-xl border border-white/5 bg-white/[0.03] hover:border-accent/20 hover:bg-white/[0.05] transition-all"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-accent/70">{source.essayTitle}</p>
          <p className="text-sm text-tx-muted mt-1 line-clamp-2">
            {source.heading ? `${source.heading}: ` : ""}
            {source.excerpt}
          </p>
        </a>
      ))}
    </div>
  );
}

function renderAnswer(content: string) {
  const parts: Array<string | { href: string; label: string }> = [];
  const re = /\[([^\]]+)\]\((\/essays\/[a-z0-9-]+)\)/gi;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) parts.push(content.slice(last, match.index));
    parts.push({ label: match[1]!, href: match[2]! });
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));

  return (
    <p className="text-tx leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <span key={i}>{part}</span>
        ) : (
          <a key={i} href={part.href} className="text-accent underline underline-offset-2 hover:text-accent-light">
            {part.label}
          </a>
        ),
      )}
    </p>
  );
}

type Props = {
  starters: string[];
  configured: boolean;
};

export default function TalkToMrPoppinClient({ starters, configured }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: MR_POPPIN_OPENING },
  ]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Bumped on send/reset so in-flight restore or replies never clobber the live UI.
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    const restoreGeneration = generationRef.current;

    async function restore() {
      try {
        const saved = localStorage.getItem(THREAD_STORAGE_KEY);
        if (!saved || !/^[0-9a-f-]{36}$/i.test(saved)) return;

        const response = await fetch(`/api/ai/query?threadId=${encodeURIComponent(saved)}`);
        if (!response.ok) {
          localStorage.removeItem(THREAD_STORAGE_KEY);
          return;
        }

        const payload = await response.json();
        // Skip if unmounted, user started a new chat, or a live send already began.
        if (cancelled || generationRef.current !== restoreGeneration) return;

        const restored: ChatMessage[] = Array.isArray(payload.messages)
          ? payload.messages
              .filter(
                (m: { role?: string; content?: string }) =>
                  (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
              )
              .map((m: { role: "user" | "assistant"; content: string }) => ({
                role: m.role,
                content: m.content,
              }))
          : [];

        if (restored.length > 0) {
          setThreadId(payload.threadId || saved);
          setMessages([{ role: "assistant", content: MR_POPPIN_OPENING }, ...restored]);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  function persistThread(id: string | null) {
    setThreadId(id);
    try {
      if (id) localStorage.setItem(THREAD_STORAGE_KEY, id);
      else localStorage.removeItem(THREAD_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    // Block while restoring so a live send can't race the old-thread hydrate.
    if (!trimmed || loading || restoring) return;

    const requestGeneration = ++generationRef.current;
    const stillCurrent = () => generationRef.current === requestGeneration;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError("");
    setLoading(true);
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          threadId: threadId || undefined,
          stream: configured,
        }),
        signal: controller.signal,
      });

      if (!stillCurrent()) return;

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/x-ndjson") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sources: Source[] = [];
        let answer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!stillCurrent()) {
            await reader.cancel().catch(() => undefined);
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: {
              type?: string;
              text?: string;
              threadId?: string;
              answer?: string;
              error?: string;
              sources?: Source[];
            };
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }

            if (!stillCurrent()) return;

            if (event.type === "meta" && Array.isArray(event.sources)) {
              sources = event.sources;
            } else if (event.type === "delta" && typeof event.text === "string") {
              answer += event.text;
              const snapshot = answer;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, content: snapshot, sources };
                }
                return next;
              });
            } else if (event.type === "replace" && typeof event.text === "string") {
              // Server repaired a truncated mid-link reply.
              answer = event.text;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, content: answer, sources };
                }
                return next;
              });
            } else if (event.type === "done") {
              if (event.threadId) persistThread(event.threadId);
              if (typeof event.answer === "string") answer = event.answer;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { role: "assistant", content: answer, sources };
                }
                return next;
              });
            } else if (event.type === "error") {
              throw new Error(event.error || "Could not generate a reply.");
            }
          }
        }

        if (!stillCurrent()) return;
        if (!answer.trim()) throw new Error("Could not generate a reply.");
      } else {
        const payload = await response.json();
        if (!stillCurrent()) return;
        if (!response.ok) throw new Error(payload?.error || "Could not generate a reply.");

        if (payload.threadId) persistThread(payload.threadId);
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              role: "assistant",
              content: payload.answer,
              sources: payload.sources || [],
            };
          }
          return next;
        });
      }
    } catch (err) {
      if (!stillCurrent()) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content.trim()) {
          next[next.length - 1] = { role: "assistant", content: message };
        } else {
          next.push({ role: "assistant", content: message });
        }
        return next;
      });
    } finally {
      if (stillCurrent()) {
        setLoading(false);
        inputRef.current?.focus();
      }
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitQuestion(input);
    }
  }

  function resetConversation() {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setMessages([{ role: "assistant", content: MR_POPPIN_OPENING }]);
    persistThread(null);
    setInput("");
    setError("");
  }

  const intro = configured
    ? "A quiet companion who has read the essays closely. Ask about something you've noticed in yourself — he'll show you where the writing looks at it."
    : "Browse the archive through conversation. Ask about a theme or essay; replies are drawn from the writing on this site.";

  return (
    <div className="grid lg:grid-cols-[1fr_1.15fr] gap-6 lg:gap-10 items-start">
      {/* On mobile, chat first so the input is reachable without scrolling past the intro. */}
      <section className="order-2 lg:order-1 space-y-5 hidden lg:block">
        <p className="text-accent text-sm font-mono tracking-widest uppercase">Talk to Mr. Poppin</p>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
          Ask about something you&apos;ve noticed.
        </h1>
        <p className="text-tx-muted text-base sm:text-lg leading-relaxed max-w-xl">{intro}</p>

        <div className="p-5 sm:p-6 bg-bg-card border border-white/5 rounded-2xl">
          <p className="text-tx-dim text-xs font-mono tracking-widest uppercase mb-4">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {starters.map(prompt => (
              <button
                key={prompt}
                type="button"
                disabled={loading || restoring}
                onClick={() => void submitQuestion(prompt)}
                className="px-3 py-2 rounded-full bg-white/[0.03] border border-white/5 text-tx-muted text-sm leading-snug hover:border-accent/20 hover:text-accent transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="order-1 lg:order-2 lg:sticky lg:top-24">
        <div className="lg:hidden mb-3 space-y-1.5">
          <p className="text-accent text-xs font-mono tracking-widest uppercase">Talk to Mr. Poppin</p>
          <h1 className="font-serif text-xl font-bold tracking-tight leading-tight">
            Ask about something you&apos;ve noticed.
          </h1>
        </div>

        <div className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] border border-white/5 bg-bg-card shadow-2xl shadow-black/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,180,0,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.04),transparent_30%)] pointer-events-none" />
          <div className="relative p-3 sm:p-6 lg:p-8 flex flex-col h-[min(78dvh,620px)] sm:h-[min(72vh,640px)]">
            <div className="flex items-center justify-between gap-4 mb-3 sm:mb-4 shrink-0">
              <div>
                <p className="text-tx-dim text-xs font-mono tracking-widest uppercase">Conversation</p>
                <p className="text-sm text-tx-muted mt-1">
                  {restoring ? "Restoring…" : threadId ? "Continuing thread" : "New thread"}
                </p>
              </div>
              <button
                type="button"
                onClick={resetConversation}
                className="px-3 py-2 rounded-lg border border-white/10 text-tx-muted text-sm hover:border-accent/20 hover:text-accent transition-colors"
              >
                New chat
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-2xl border p-3 sm:p-5 ${
                    message.role === "user"
                      ? "ml-3 sm:ml-12 bg-white/[0.03] border-white/5"
                      : "mr-3 sm:mr-12 bg-black/15 border-white/5"
                  }`}
                >
                  <div className="mb-2">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-tx-dim">
                      {message.role === "user" ? "You" : "Mr. Poppin"}
                    </span>
                  </div>
                  {message.role === "assistant" ? (
                    renderAnswer(message.content || (loading ? "…" : ""))
                  ) : (
                    <p className="text-tx leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )}
                  {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                    <SourceList sources={message.sources} />
                  )}
                </div>
              ))}
              {loading &&
                messages[messages.length - 1]?.role === "assistant" &&
                !messages[messages.length - 1]?.content && (
                  <p className="text-tx-dim text-sm px-1">Mr. Poppin is looking through the archive…</p>
                )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 shrink-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                maxLength={2000}
                disabled={restoring}
                placeholder="Something you've noticed in yourself…"
                className="w-full rounded-2xl border border-white/10 bg-bg px-3 sm:px-4 py-2.5 sm:py-3 text-tx placeholder:text-tx-dim focus:outline-none focus:border-accent/40 resize-none disabled:opacity-60"
              />

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <button
                  type="submit"
                  disabled={loading || restoring || !input.trim()}
                  className={`px-5 py-2.5 sm:py-3 rounded-xl font-medium transition-all ${
                    loading || restoring || !input.trim()
                      ? "bg-white/5 text-tx-dim cursor-not-allowed"
                      : "bg-accent text-bg hover:bg-accent-light"
                  }`}
                >
                  {loading ? "Listening…" : "Ask Mr. Poppin"}
                </button>
                <p className="text-tx-dim text-xs leading-snug">
                  Enter to send · Shift+Enter for a new line. Questions are stored to improve the archive.
                </p>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </form>
          </div>
        </div>

        <div className="mt-4 lg:hidden">
          <p className="text-tx-dim text-xs font-mono tracking-widest uppercase mb-3">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {starters.map(prompt => (
              <button
                key={prompt}
                type="button"
                disabled={loading || restoring}
                onClick={() => void submitQuestion(prompt)}
                className="px-3 py-2 rounded-full border border-white/10 bg-white/[0.03] text-tx-muted text-sm hover:border-accent/20 hover:text-accent transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
