"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Essay, getEssayBySlug, getPublishedEssays, categories } from "@/lib/data";

// Strip emojis and special unicode symbols from text
function stripEmojis(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/(?:[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\uFE0F|\u200D|\u20E3)/g, "").trim();
}

function renderContent(content: string) {
  return content.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return <h2 key={i}>{stripEmojis(line.replace("## ", ""))}</h2>;
    }
    if (line.startsWith("### ")) {
      return <h3 key={i}>{stripEmojis(line.replace("### ", ""))}</h3>;
    }
    if (line.trim() === "") return <br key={i} />;
    // Handle inline formatting
    let cleaned = stripEmojis(line);
    let html = cleaned
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/"(.+?)"/g, "&ldquo;$1&rdquo;");
    return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

export default function EssayReader() {
  const params = useParams();
  const [essay, setEssay] = useState<Essay | null>(null);
  const [adjacent, setAdjacent] = useState<{ prev?: Essay; next?: Essay }>({});

  useEffect(() => {
    const slug = params.slug as string;
    const found = getEssayBySlug(slug);
    setEssay(found || null);
    if (found) {
      const all = getPublishedEssays();
      const idx = all.findIndex(e => e.id === found.id);
      setAdjacent({
        prev: idx > 0 ? all[idx - 1] : undefined,
        next: idx < all.length - 1 ? all[idx + 1] : undefined,
      });
    }
  }, [params.slug]);

  if (!essay) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-3xl mb-4">Essay not found</h1>
        <a href="/essays" className="text-accent hover:underline">Back to essays</a>
      </div>
    );
  }

  const catInfo = categories.find(c => c.key === essay.category);

  return (
    <article className="fade-up">
      {/* Header — no excerpt, straight to content */}
      <header className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 sm:pb-10 border-b border-white/5">
        <a href="/essays" className="text-tx-dim text-sm hover:text-accent transition-colors mb-4 sm:mb-6 inline-block">&larr; All Essays</a>
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <a href={`/essays?cat=${essay.category}`} className="text-accent text-xs font-mono uppercase tracking-wider hover:underline">{catInfo?.label || essay.category}</a>
          <span className="text-tx-dim text-xs">&middot;</span>
          <span className="text-tx-dim text-xs font-mono">{essay.read_time || Math.max(1, Math.ceil(essay.content.split(/\s+/).length / 200))} min read</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">{stripEmojis(essay.title)}</h1>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 essay-content">
        {renderContent(essay.content)}
      </div>

      {/* Navigation */}
      <nav className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 border-t border-white/5">
        <div className="flex justify-between items-start gap-4 sm:gap-6">
          {adjacent.prev ? (
            <a href={`/essays/${adjacent.prev.slug}`} className="group flex-1 min-w-0">
              <span className="text-tx-dim text-xs font-mono">&larr; Previous</span>
              <p className="font-serif text-base sm:text-lg mt-1 group-hover:text-accent transition-colors truncate">{stripEmojis(adjacent.prev.title)}</p>
            </a>
          ) : <div className="flex-1" />}
          {adjacent.next ? (
            <a href={`/essays/${adjacent.next.slug}`} className="group flex-1 text-right min-w-0">
              <span className="text-tx-dim text-xs font-mono">Next &rarr;</span>
              <p className="font-serif text-base sm:text-lg mt-1 group-hover:text-accent transition-colors truncate">{stripEmojis(adjacent.next.title)}</p>
            </a>
          ) : <div className="flex-1" />}
        </div>
      </nav>
    </article>
  );
}
