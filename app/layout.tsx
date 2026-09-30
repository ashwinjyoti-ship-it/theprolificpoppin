import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "./components/SiteNav";

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
        <SiteNav />
        <main className="min-h-[calc(100vh-160px)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-tx-dim text-sm text-center md:text-left">theprolificpoppin &copy; {new Date().getFullYear()}</p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-tx-dim">
          <a href="/essays" className="hover:text-tx-muted transition-colors py-1">Essays</a>
          <a href="/talk-to-mr-poppin" className="hover:text-tx-muted transition-colors py-1">Talk to Mr. Poppin</a>
          <a href="/about" className="hover:text-tx-muted transition-colors py-1">About</a>
          <a href="/author" className="hover:text-tx-muted transition-colors py-1">Author</a>
          <a href="/admin" className="hover:text-tx-muted transition-colors py-1">Admin</a>
        </div>
      </div>
    </footer>
  );
}
