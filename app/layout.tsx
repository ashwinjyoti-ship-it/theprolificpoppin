import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "theprolificpoppin — Essays on Consciousness",
  description: "Exploring awareness, identity, and the narratives we construct. Essays at the intersection of Vedic wisdom and modern understanding.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('tpp_theme');
              if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="min-h-screen bg-bg antialiased">
        <Nav />
        <main className="min-h-[calc(100vh-160px)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/80 border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <a href="/" className="font-serif text-lg sm:text-xl tracking-tight text-tx hover:text-accent transition-colors">
          theprolificpoppin
        </a>
        <div className="flex items-center gap-4 sm:gap-8 text-sm">
          <a href="/essays" className="text-tx-muted hover:text-tx transition-colors">Essays</a>
          <a href="/about" className="text-tx-muted hover:text-tx transition-colors">About</a>
          <a href="/author" className="text-tx-muted hover:text-tx transition-colors">Author</a>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

function ThemeToggle() {
  return (
    <button
      id="theme-toggle"
      aria-label="Toggle light/dark mode"
      className="w-8 h-8 flex items-center justify-center rounded-full text-tx-dim hover:text-accent transition-colors"
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var btn = document.getElementById('theme-toggle');
          if (!btn) return;
          function getTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
          function updateIcon() {
            var isDark = getTheme() !== 'light';
            btn.innerHTML = isDark
              ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
              : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
          }
          updateIcon();
          btn.addEventListener('click', function() {
            var newTheme = getTheme() === 'light' ? 'dark' : 'light';
            if (newTheme === 'light') {
              document.documentElement.setAttribute('data-theme', 'light');
            } else {
              document.documentElement.removeAttribute('data-theme');
            }
            try { localStorage.setItem('tpp_theme', newTheme); } catch(e) {}
            updateIcon();
          });
        })();
      `}} />
    </button>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col md:flex-row justify-between items-center gap-3">
        <p className="text-tx-dim text-sm">theprolificpoppin &copy; {new Date().getFullYear()}</p>
        <div className="flex gap-6 text-sm text-tx-dim">
          <a href="/essays" className="hover:text-tx-muted transition-colors">Essays</a>
          <a href="/about" className="hover:text-tx-muted transition-colors">About</a>
          <a href="/author" className="hover:text-tx-muted transition-colors">Author</a>
          <a href="/admin" className="hover:text-tx-muted transition-colors">Admin</a>
        </div>
      </div>
    </footer>
  );
}
