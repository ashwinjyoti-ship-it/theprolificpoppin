import { getPublishedEssays } from "@/lib/server-data";

function stripEmojis(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/(?:[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\uFE0F|\u200D|\u20E3)/g, "").trim();
}

export default async function EssaysPage() {
  const essays = await getPublishedEssays();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="mb-8 sm:mb-12 fade-up">
        <p className="text-accent text-sm font-mono tracking-widest uppercase mb-3">Archive</p>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Essays</h1>
        <p className="text-tx-muted mt-3">{essays.length} essay{essays.length === 1 ? "" : "s"}</p>
      </div>

      <div className="space-y-6 fade-up-delay">
        {essays.map(essay => (
          <a key={essay.id} href={`/essays/${essay.slug}`} className="group block p-5 sm:p-8 bg-bg-card border border-white/5 rounded-2xl hover:border-accent/20 hover:bg-bg-hover transition-all duration-300">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <span className="text-tx-dim text-xs font-mono">{essay.read_time} min read</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-semibold group-hover:text-accent transition-colors mb-2 sm:mb-3">{stripEmojis(essay.title)}</h2>
            <p className="text-tx-muted leading-relaxed max-w-3xl">{essay.excerpt}</p>
            <span className="inline-block mt-4 text-accent text-sm">Read essay &rarr;</span>
          </a>
        ))}
        {essays.length === 0 && <p className="text-tx-dim text-center py-16">No essays yet.</p>}
      </div>
    </div>
  );
}
