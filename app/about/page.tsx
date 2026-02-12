"use client";
import { useEffect, useState } from "react";
import { getPage } from "@/lib/data";

export default function AboutPage() {
  const [content, setContent] = useState("");

  useEffect(() => {
    const page = getPage("about");
    setContent(page?.content || "");
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 fade-up">
      <p className="text-accent text-sm font-mono tracking-widest uppercase mb-4">About</p>
      <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-8 sm:mb-10">theprolificpoppin</h1>
      <div className="space-y-6">
        {content.split("\n\n").map((para, i) => (
          <p key={i} className="text-tx-muted text-lg leading-relaxed">{para}</p>
        ))}
      </div>
    </div>
  );
}
