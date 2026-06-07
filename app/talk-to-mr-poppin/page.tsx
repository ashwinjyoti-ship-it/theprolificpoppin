import { categories } from "@/lib/data";
import TalkToMrPoppinClient from "./TalkToMrPoppinClient";

const starters = [
  "What is the main argument in the essay about self-worth and AI?",
  "How do the essays connect awareness with behavior?",
  "Which essay best explains identity and ego?",
  "What themes repeat across the archive?",
];

export default function TalkToMrPoppinPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="grid lg:grid-cols-[1.1fr_1.2fr] gap-8 lg:gap-10 items-start">
        <section className="space-y-6 fade-up">
          <p className="text-accent text-sm font-mono tracking-widest uppercase">Talk to Mr. Poppin</p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Ask the archive a question,
            <span className="text-accent"> and let the essays answer.</span>
          </h1>
          <p className="text-tx-muted text-base sm:text-lg leading-relaxed max-w-xl">
            This space is grounded in the essay library. It searches the writing first, then uses the model to turn those passages into a conversation.
          </p>

          <div className="p-5 sm:p-6 bg-bg-card border border-white/5 rounded-2xl">
            <p className="text-tx-dim text-xs font-mono tracking-widest uppercase mb-4">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {starters.map(prompt => (
                <span
                  key={prompt}
                  className="px-3 py-2 rounded-full bg-white/[0.03] border border-white/5 text-tx-muted text-sm leading-snug"
                >
                  {prompt}
                </span>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {categories.slice(0, 4).map(cat => (
              <div key={cat.key} className="p-4 bg-bg-card border border-white/5 rounded-xl">
                <p className="text-accent/70 text-[10px] font-mono uppercase tracking-widest mb-1">{cat.label}</p>
                <p className="text-tx-muted text-sm italic">&ldquo;{cat.tagline}&rdquo;</p>
              </div>
            ))}
          </div>
        </section>

        <TalkToMrPoppinClient starters={starters} />
      </div>
    </div>
  );
}
