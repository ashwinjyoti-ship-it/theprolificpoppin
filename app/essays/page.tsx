import { getPublishedEssays, getCategoryInfo } from "@/lib/server-data";
import { categories } from "@/lib/data";

type EssaysPageProps = {
  searchParams?: { cat?: string };
};

function stripEmojis(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/(?:[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\uFE0F|\u200D|\u20E3)/g, "").trim();
}

export default async function EssaysPage({ searchParams }: EssaysPageProps) {
  const params = searchParams || {};
  const catFilter = params.cat || null;
  const all = await getPublishedEssays();
  const essays = catFilter ? all.filter(essay => essay.category === catFilter) : all;
  const activeCatInfo = catFilter ? getCategoryInfo(catFilter) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="mb-8 sm:mb-12 fade-up">
        <p className="text-accent text-sm font-mono tracking-widest uppercase mb-3">Archive</p>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Essays</h1>
        <p className="text-tx-muted mt-3">{essays.length} essays across the inner journey</p>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8 fade-up-delay">
        <a href="/essays" className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm border transition-all ${!catFilter ? "bg-accent/15 border-accent/30 text-accent" : "border-white/10 text-tx-muted hover:border-white/20"}`}>
          All
        </a>
        {categories.map(cat => (
          <a
            key={cat.key}
            href={`/essays?cat=${cat.key}`}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm border transition-all ${catFilter === cat.key ? "bg-accent/15 border-accent/30 text-accent" : "border-white/10 text-tx-muted hover:border-white/20"}`}
          >
            {cat.label}
          </a>
        ))}
      </div>

      {activeCatInfo && (
        <div className="mb-10 p-6 bg-bg-card border border-white/5 rounded-2xl fade-up-delay">
          <p className="text-tx-muted italic text-lg">&ldquo;{activeCatInfo.tagline}&rdquo;</p>
          <p className="text-tx-dim text-sm mt-2">{activeCatInfo.desc}</p>
        </div>
      )}

      <div className="space-y-6 fade-up-delay2">
        {essays.map(essay => {
          const cat = categories.find(c => c.key === essay.category);
          return (
            <a key={essay.id} href={`/essays/${essay.slug}`} className="group block p-5 sm:p-8 bg-bg-card border border-white/5 rounded-2xl hover:border-accent/20 hover:bg-bg-hover transition-all duration-300">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <span className="text-accent/60 text-xs font-mono uppercase tracking-wider">{cat?.label || essay.category}</span>
                <span className="text-tx-dim text-xs">&middot;</span>
                <span className="text-tx-dim text-xs font-mono">{essay.read_time} min read</span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-semibold group-hover:text-accent transition-colors mb-2 sm:mb-3">{stripEmojis(essay.title)}</h2>
              <p className="text-tx-muted leading-relaxed max-w-3xl">{essay.excerpt}</p>
              <span className="inline-block mt-4 text-accent text-sm">Read essay &rarr;</span>
            </a>
          );
        })}
        {essays.length === 0 && <p className="text-tx-dim text-center py-16">No essays in this category yet.</p>}
      </div>
    </div>
  );
}
