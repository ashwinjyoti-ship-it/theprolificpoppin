"use client";

import { useEffect, useId, useState } from "react";

const links = [
  { href: "/essays", label: "Essays" },
  { href: "/talk-to-mr-poppin", label: "Talk to Mr. Poppin" },
  { href: "/about", label: "About" },
  { href: "/author", label: "Author" },
] as const;

function getTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  function toggle() {
    const next = getTheme() === "light" ? "dark" : "light";
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 420);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("tpp_theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  }

  const isDark = theme !== "light";
  // Label the destination so the control invites a try
  const label = isDark ? "Light" : "Dark";
  const aria = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      aria-label={aria}
      title={aria}
      onClick={toggle}
      className={`theme-toggle-pill inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-accent/35 bg-accent/10 px-2.5 sm:px-3 h-9 sm:h-10 text-accent hover:bg-accent/20 hover:border-accent/50 transition-colors ${className}`}
    >
      <span
        className={`theme-toggle-icon inline-flex items-center justify-center ${spinning ? "is-spinning" : ""}`}
        aria-hidden="true"
      >
        {isDark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
      <span className="text-[11px] sm:text-xs font-mono tracking-widest uppercase leading-none">{label}</span>
    </button>
  );
}

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    function onResize() {
      if (window.matchMedia("(min-width: 768px)").matches) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/80 border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        <a
          href="/"
          className="font-serif text-lg sm:text-xl tracking-tight text-tx hover:text-accent transition-colors shrink-0"
          onClick={() => setOpen(false)}
        >
          theprolificpoppin
        </a>

        {/* Desktop / tablet landscape: same treatment as before */}
        <div className="hidden md:flex items-center gap-8 text-sm">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-tx-muted hover:text-tx transition-colors whitespace-nowrap"
            >
              {link.label}
            </a>
          ))}
          <ThemeToggle />
        </div>

        {/* Phone: theme pill stays visible outside the menu */}
        <div className="flex md:hidden items-center gap-1.5">
          <ThemeToggle />
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center rounded-full text-tx-muted hover:text-tx border border-white/10 transition-colors"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div
        id={menuId}
        hidden={!open}
        className="md:!hidden border-t border-white/5 bg-bg/95 backdrop-blur-md"
      >
        <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="py-3.5 text-base text-tx-muted hover:text-tx transition-colors border-b border-white/5 last:border-b-0"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
