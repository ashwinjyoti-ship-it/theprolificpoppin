import type { Essay } from "@/lib/data";

function stripEmojis(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/(?:[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\uFE0F|\u200D|\u20E3)/g, "").trim();
}

function renderContent(content: string) {
  return content.split("\n").map((line, i) => {
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return <hr key={i} />;
    if (line.startsWith("## ")) {
      return <h2 key={i}>{stripEmojis(line.replace("## ", ""))}</h2>;
    }
    if (line.startsWith("### ")) {
      return <h3 key={i}>{stripEmojis(line.replace("### ", ""))}</h3>;
    }
    if (line.trim() === "") return <br key={i} />;
    const cleaned = stripEmojis(line);
    const html = cleaned
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/"(.+?)"/g, "&ldquo;$1&rdquo;");
    return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

export default function EssayClient({
  essay,
  adjacent,
}: {
  essay: Essay;
  adjacent: { prev?: Essay; next?: Essay };
}) {
  return (
    <article className="fade-up">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
        <a href="/essays" className="text-tx-dim text-sm hover:text-accent transition-colors mb-4 sm:mb-6 inline-block">&larr; All Essays</a>
      </div>

      <div className="essay-paper max-w-3xl mx-auto sm:mx-6 md:mx-auto">
      <header className="px-5 sm:px-12 pt-8 sm:pt-12 pb-6 sm:pb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <span className="text-tx-dim text-xs font-mono">{essay.read_time || Math.max(1, Math.ceil(essay.content.split(/\s+/).length / 200))} min read</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">{stripEmojis(essay.title)}</h1>
      </header>

      <div className="px-5 sm:px-12 pb-10 sm:pb-14 essay-content">
        {renderContent(essay.content)}
      </div>
      </div>

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

