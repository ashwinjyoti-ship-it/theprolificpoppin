"use client";
import { useEffect, useState } from "react";
import { Essay, getFeaturedEssays, categories } from "@/lib/data";

export default function Home() {
  const [featured, setFeatured] = useState<Essay[]>([]);

  useEffect(() => {
    setFeatured(getFeaturedEssays());
  }, []);

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
            <a href="/essays" className="inline-flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 px-6 py-2.5 rounded-full text-sm font-medium hover:bg-accent/20 transition-all">
              Read Essays <span className="text-base">&rarr;</span>
            </a>
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

      {/* Two-column: Categories sidebar + Featured */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

          {/* Left: Category Navigation */}
          <div className="lg:w-52 shrink-0 fade-up-delay">
            <h2 className="text-tx-dim text-xs font-mono tracking-widest uppercase mb-4">The Stages</h2>

            {/* Mobile: horizontal scroll with arrow indicator */}
            <div className="relative lg:hidden">
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                {categories.map((cat, i) => (
                  <a key={cat.key} href={`/essays?cat=${cat.key}`}
                    className="group shrink-0 p-3.5 w-40 bg-bg-card border border-white/5 rounded-lg hover:border-accent/20 transition-all duration-300">
                    <span className="text-accent/40 text-[10px] font-mono">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="font-serif text-sm font-semibold mt-1 group-hover:text-accent transition-colors leading-tight">{cat.label}</h3>
                    <p className="text-tx-muted text-[10px] mt-1 italic leading-snug">&ldquo;{cat.tagline}&rdquo;</p>
                  </a>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-2 w-10 flex items-center justify-end pointer-events-none bg-gradient-to-l from-bg via-bg/80 to-transparent">
                <svg className="w-4 h-4 text-tx-dim animate-pulse mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Desktop: vertical stack */}
            <div className="hidden lg:flex flex-col gap-3">
              {categories.map((cat, i) => (
                <a key={cat.key} href={`/essays?cat=${cat.key}`}
                  className="group px-4 py-3 bg-bg-card border border-white/5 rounded-lg hover:border-accent/20 transition-all duration-300">
                  <div className="flex items-baseline gap-2">
                    <span className="text-accent/40 text-[10px] font-mono">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="font-serif text-sm font-semibold group-hover:text-accent transition-colors">{cat.label}</h3>
                  </div>
                  <p className="text-tx-muted text-[10px] italic leading-snug mt-1">&ldquo;{cat.tagline}&rdquo;</p>
                </a>
              ))}
            </div>
          </div>

          {/* Right: Featured Essays */}
          {featured.length > 0 && (
            <div className="flex-1 fade-up-delay2">
              <h2 className="text-tx-dim text-xs font-mono tracking-widest uppercase mb-4">Featured</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                {featured.map(essay => {
                  const cat = categories.find(c => c.key === essay.category);
                  return (
                    <a key={essay.id} href={`/essays/${essay.slug}`}
                      className="group block p-5 bg-bg-card border border-white/5 rounded-lg hover:border-accent/20 hover:bg-bg-hover transition-all duration-300">
                      <span className="text-accent/60 text-[10px] font-mono uppercase tracking-wider">{cat?.label || essay.category}</span>
                      <h3 className="font-serif text-base font-semibold mt-2 mb-1.5 group-hover:text-accent transition-colors leading-snug line-clamp-2">{essay.title}</h3>
                      <p className="text-tx-muted text-xs leading-relaxed line-clamp-2">{essay.excerpt}</p>
                      <span className="text-tx-dim text-[10px] font-mono mt-3 block">{essay.read_time}m read</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </section>
    </div>
  );
}
