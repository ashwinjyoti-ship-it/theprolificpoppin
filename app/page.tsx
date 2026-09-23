import { getFeaturedEssays, getPublishedEssays } from "@/lib/server-data";

export default async function Home() {
  const [featured, published] = await Promise.all([
    getFeaturedEssays(),
    getPublishedEssays(),
  ]);

  const featuredIds = new Set(featured.map(essay => essay.id));
  const recent = published
    .filter(essay => !featuredIds.has(essay.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-8 sm:pb-12 fade-up">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-12">
          {/* Left: Text */}
          <div className="flex-1">
            <p className="text-accent text-xs sm:text-sm font-mono tracking-widest uppercase mb-3">Essays on Consciousness</p>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.15] tracking-tight mb-4">
              The space between<br /><span className="text-accent">thought and silence</span>
            </h1>
            <p className="text-tx-muted text-sm sm:text-base max-w-xl leading-relaxed mb-6">
              Exploring awareness, identity, and the narratives we construct about ourselves.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="/essays" className="inline-flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 px-6 py-2.5 rounded-full text-sm font-medium hover:bg-accent/20 transition-all">
                Look Within <span className="text-base">&rarr;</span>
              </a>
              <a href="/talk-to-mr-poppin" className="inline-flex items-center gap-2 bg-white/[0.03] text-tx border border-white/10 px-6 py-2.5 rounded-full text-sm font-medium hover:border-accent/20 hover:text-accent transition-all">
                Talk to Mr. Poppin <span className="text-base">&rarr;</span>
              </a>
            </div>
          </div>
          {/* Right: Logo */}
          <div className="hidden lg:flex items-center justify-center shrink-0">
            <img
              src="/logo.png"
              alt="theprolificpoppin — consciousness and technology"
              className="w-56 h-56 xl:w-64 xl:h-64 opacity-90 hover:opacity-100 transition-opacity duration-500"
            />
          </div>
        </div>
      </section>

      {/* Essays shelf: featured + recent */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16 space-y-10 sm:space-y-12">
        {featured.length > 0 && (
          <div className="fade-up-delay">
            <h2 className="text-tx-dim text-xs font-mono tracking-widest uppercase mb-4">Featured</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {featured.map(essay => (
                <a key={essay.id} href={`/essays/${essay.slug}`}
                  className="group block p-5 bg-bg-card border border-white/5 rounded-lg hover:border-accent/20 hover:bg-bg-hover transition-all duration-300">
                  <h3 className="font-serif text-base font-semibold mb-1.5 group-hover:text-accent transition-colors leading-snug line-clamp-2">{essay.title}</h3>
                  <p className="text-tx-muted text-xs leading-relaxed line-clamp-2">{essay.excerpt}</p>
                  <span className="text-tx-dim text-[10px] font-mono mt-3 block">{essay.read_time}m read</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="fade-up-delay2">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h2 className="text-tx-dim text-xs font-mono tracking-widest uppercase">
                {featured.length > 0 ? "More Essays" : "Essays"}
              </h2>
              <a href="/essays" className="text-accent text-xs font-mono hover:underline">
                View all &rarr;
              </a>
            </div>
            <div className="space-y-4">
              {recent.map(essay => (
                <a key={essay.id} href={`/essays/${essay.slug}`}
                  className="group block p-5 bg-bg-card border border-white/5 rounded-lg hover:border-accent/20 hover:bg-bg-hover transition-all duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                    <h3 className="font-serif text-base sm:text-lg font-semibold group-hover:text-accent transition-colors leading-snug">
                      {essay.title}
                    </h3>
                    <span className="text-tx-dim text-[10px] font-mono shrink-0">{essay.read_time}m read</span>
                  </div>
                  <p className="text-tx-muted text-xs sm:text-sm leading-relaxed mt-1.5 line-clamp-2">{essay.excerpt}</p>
                </a>
              ))}
            </div>
          </div>
        )}

        {featured.length === 0 && recent.length === 0 && (
          <p className="text-tx-dim text-center py-8 fade-up-delay">Essays coming soon.</p>
        )}
      </section>
    </div>
  );
}
