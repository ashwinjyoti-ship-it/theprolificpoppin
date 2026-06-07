"use client";

import { FormEvent, useMemo, useState } from "react";

type Source = {
  essayId: number;
  essaySlug: string;
  essayTitle: string;
  essayCategory: string;
  chunkId: number;
  chunkOrder: number;
  kind: string;
  heading: string | null;
  score: number;
  excerpt: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  configured?: boolean;
  model?: string | null;
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-mono uppercase tracking-widest text-accent/70">{source.essayTitle}</p>
              <p className="text-sm text-tx-muted mt-1 line-clamp-2">
                {source.heading ? `${source.heading}: ` : ""}
                {source.excerpt}
              </p>
            </div>
            <span className="text-[10px] font-mono text-tx-dim shrink-0">score {source.score}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function TalkToMrPoppinClient({ starters }: { starters: string[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask me about any essay, theme, or idea in the archive. I’ll answer using the writing first and then turn it into a conversation.",
      configured: true,
      model: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const quickPrompts = useMemo(() => starters.slice(0, 3), [starters]);

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError("");
    setLoading(true);
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: trimmed }]);

    try {
      const response = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, threadId: threadId || undefined }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Could not generate a reply.");
      }

      setThreadId(payload.threadId || null);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: payload.answer,
          sources: payload.sources || [],
          configured: payload.configured,
          model: payload.model || null,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(input);
  }

  function resetConversation() {
    setMessages([
      {
        role: "assistant",
        content: "Ask me about any essay, theme, or idea in the archive. I’ll answer using the writing first and then turn it into a conversation.",
        configured: true,
        model: null,
      },
    ]);
    setThreadId(null);
    setInput("");
    setError("");
  }

  return (
    <section className="fade-up-delay">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-bg-card shadow-2xl shadow-black/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,180,0,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.04),transparent_30%)] pointer-events-none" />
        <div className="relative p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <p className="text-tx-dim text-xs font-mono tracking-widest uppercase">Conversation</p>
              <p className="text-sm text-tx-muted mt-1">
                {threadId ? `Thread ${threadId.slice(0, 8)}…` : "New thread"}
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

          <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl border p-4 sm:p-5 ${
                  message.role === "user"
                    ? "ml-6 sm:ml-16 bg-white/[0.03] border-white/5"
                    : "mr-6 sm:mr-16 bg-black/15 border-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-tx-dim">
                    {message.role === "user" ? "You" : "Mr. Poppin"}
                  </span>
                  {message.role === "assistant" && message.model && (
                    <span className="text-[10px] font-mono text-tx-dim">{message.configured ? message.model : "offline"}</span>
                  )}
                </div>
                <p className="text-tx leading-relaxed whitespace-pre-wrap">{message.content}</p>
                {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                  <SourceList sources={message.sources} />
                )}
              </div>
            ))}
            {loading && (
              <div className="rounded-2xl border border-white/5 bg-black/15 p-4 sm:p-5 mr-6 sm:mr-16">
                <p className="text-tx-dim text-sm">Mr. Poppin is thinking through the archive...</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={4}
              placeholder="Ask about an essay, a theme, or how two pieces connect..."
              className="w-full rounded-2xl border border-white/10 bg-bg px-4 py-3 text-tx placeholder:text-tx-dim focus:outline-none focus:border-accent/40 resize-none"
            />

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className={`px-5 py-3 rounded-xl font-medium transition-all ${
                  loading || !input.trim()
                    ? "bg-white/5 text-tx-dim cursor-not-allowed"
                    : "bg-accent text-bg hover:bg-accent-light"
                }`}
              >
                {loading ? "Listening..." : "Ask Mr. Poppin"}
              </button>
              <p className="text-tx-dim text-sm">
                Grounded in the essay archive first, then expanded with the model if configured.
              </p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </form>

          <div className="mt-5 flex flex-wrap gap-2">
            {quickPrompts.map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setInput(prompt);
                  void submitQuestion(prompt);
                }}
                className="px-3 py-2 rounded-full border border-white/10 bg-white/[0.03] text-tx-muted text-sm hover:border-accent/20 hover:text-accent transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
