"use client";
import { useEffect, useState } from "react";
import { getPage } from "@/lib/data";

export default function AuthorPage() {
  const [content, setContent] = useState("");

  useEffect(() => {
    const page = getPage("about_author");
    setContent(page?.content || "");
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 fade-up">
      <p className="text-accent text-sm font-mono tracking-widest uppercase mb-4">Author</p>
      <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-8 sm:mb-10">Ash</h1>
      <div className="space-y-6">
        {content.split("\n\n").map((para, i) => (
          <p key={i} className="text-tx-muted text-lg leading-relaxed">{para}</p>
        ))}
      </div>
      <div className="mt-12 p-6 bg-bg-card border border-white/5 rounded-xl">
        <p className="text-tx-dim text-sm font-mono mb-1">Get in touch</p>
        <a href="mailto:ashwinjyoti@gmail.com" className="text-accent hover:text-accent-light transition-colors">ashwinjyoti@gmail.com</a>
      </div>
    </div>
  );
}
