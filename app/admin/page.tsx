"use client";
import { useEffect, useState, useRef, FormEvent, ChangeEvent } from "react";
import mammoth from "mammoth";
import {
  Essay, PageContent, getEssays, saveEssay, deleteEssay,
  getPages, savePage, isLoggedIn, login, logout, categories,
  getFeaturedIds, saveFeaturedIds, getPublishedEssays
} from "@/lib/data";

type Tab = "essays" | "new" | "edit" | "pages" | "featured";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [tab, setTab] = useState<Tab>("essays");
  const [essays, setEssays] = useState<Essay[]>([]);
  const [pages, setPages] = useState<PageContent[]>([]);
  const [editId, setEditId] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("the-ache");
  const [published, setPublished] = useState(true);
  const [featured, setFeatured] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Featured state
  const [featuredIds, setFeaturedIds] = useState<number[]>([]);
  const [featuredSaved, setFeaturedSaved] = useState(false);

  // Page edit state
  const [pageKey, setPageKey] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageContent, setPageContent] = useState("");

  useEffect(() => { setAuthed(isLoggedIn()); }, []);
  useEffect(() => { if (authed) { refresh(); } }, [authed]);

  function refresh() {
    setEssays(getEssays());
    setPages(getPages());
    setFeaturedIds(getFeaturedIds());
  }

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (login(pw)) { setAuthed(true); setPwErr(false); }
    else { setPwErr(true); }
  }

  function handleLogout() { logout(); setAuthed(false); }

  function resetForm() {
    setTitle(""); setSlug(""); setExcerpt(""); setContent("");
    setCategory("the-ache"); setPublished(true); setFeatured(false); setEditId(null);
  }

  function startEdit(essay: Essay) {
    setEditId(essay.id);
    setTitle(essay.title);
    setSlug(essay.slug);
    setExcerpt(essay.excerpt);
    setContent(essay.content);
    setCategory(essay.category);
    setPublished(essay.published);
    setFeatured(essay.featured);
    setTab("edit");
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    saveEssay({
      id: editId || undefined,
      title, slug: slug || undefined, excerpt, content, category, published, featured,
    });
    resetForm();
    setTab("essays");
    refresh();
  }

  function handleDelete(id: number) {
    if (confirm("Delete this essay permanently?")) {
      deleteEssay(id);
      refresh();
    }
  }

  function startPageEdit(page: PageContent) {
    setPageKey(page.page_key);
    setPageTitle(page.title);
    setPageContent(page.content);
  }

  function handlePageSave(e: FormEvent) {
    e.preventDefault();
    savePage({ page_key: pageKey, title: pageTitle, content: pageContent });
    setPageKey("");
    setPageTitle("");
    setPageContent("");
    refresh();
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let extractedText = "";
      let extractedTitle = "";

      if (ext === "txt" || ext === "md") {
        extractedText = await file.text();
      } else if (ext === "docx") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (ext === "doc") {
        setUploadError("Old .doc format not supported. Please save as .docx and re-upload.");
        setUploading(false);
        return;
      } else if (ext === "pdf") {
        setUploadError("PDF parsing coming soon. For now, copy-paste the text or upload as .docx or .txt.");
        setUploading(false);
        return;
      } else {
        setUploadError(`Unsupported format: .${ext}. Use .docx, .txt, or .md`);
        setUploading(false);
        return;
      }

      // Extract title from first line
      const lines = extractedText.split("\n").filter(l => l.trim());
      if (lines.length > 0) {
        extractedTitle = lines[0].replace(/^#+\s*/, "").trim();
        // Remove title from content
        const titleIdx = extractedText.indexOf(lines[0]);
        if (titleIdx >= 0) {
          extractedText = extractedText.substring(titleIdx + lines[0].length).trim();
        }
      }

      // Auto-generate excerpt from first ~150 chars
      const excerptText = extractedText.substring(0, 200).split("\n").join(" ").trim();

      setTitle(extractedTitle);
      setContent(extractedText);
      setExcerpt(excerptText.length > 150 ? excerptText.substring(0, 150) + "..." : excerptText);
      setSlug("");
      setPublished(false); // Default to draft so they can review

      // Switch to the form
      setTab("new");
    } catch (err) {
      setUploadError("Failed to parse file. Try a different format.");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Login screen
  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-6 py-24">
        <div className="p-8 bg-bg-card border border-white/5 rounded-2xl">
          <h1 className="font-serif text-2xl font-bold mb-2">Admin</h1>
          <p className="text-tx-dim text-sm mb-6">Enter password to continue</p>
          <form onSubmit={handleLogin}>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3 text-tx focus:outline-none focus:border-accent/50 mb-3"
              placeholder="Password" autoFocus />
            {pwErr && <p className="text-red-400 text-sm mb-3">Incorrect password</p>}
            <button type="submit"
              className="w-full bg-accent text-bg font-medium py-3 rounded-lg hover:bg-accent-light transition-colors">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold">Admin Panel</h1>
          <p className="text-tx-dim text-xs sm:text-sm mt-1">Manage essays and content</p>
        </div>
        <button onClick={handleLogout} className="text-tx-dim text-sm hover:text-red-400 transition-colors">Logout</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 sm:mb-8 bg-bg-card rounded-xl p-1 border border-white/5 overflow-x-auto">
        {[
          { key: "essays" as Tab, label: "Essays" },
          { key: "new" as Tab, label: "+ New" },
          { key: "featured" as Tab, label: "Featured" },
          { key: "pages" as Tab, label: "Pages" },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === "new") resetForm(); }}
            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${tab === t.key || (tab === "edit" && t.key === "essays") ? "bg-accent/15 text-accent" : "text-tx-muted hover:text-tx"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Essays List */}
      {tab === "essays" && (
        <div className="space-y-3">
          {essays.map(essay => (
            <div key={essay.id} className="p-4 sm:p-5 bg-bg-card border border-white/5 rounded-xl hover:border-white/10 transition-all">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-serif text-base sm:text-lg font-medium truncate max-w-[70vw] sm:max-w-none">{essay.title}</h3>
                    {!essay.published && <span className="text-[10px] sm:text-xs bg-yellow-500/20 text-yellow-400 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">Draft</span>}
                    {essay.featured && <span className="text-[10px] sm:text-xs bg-accent/20 text-accent px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">Featured</span>}
                  </div>
                  <p className="text-tx-dim text-xs font-mono">{categories.find(c => c.key === essay.category)?.label || essay.category} &middot; {essay.created_at}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 sm:mt-2">
                <button onClick={() => startEdit(essay)}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm border border-white/10 rounded-lg text-tx-muted hover:border-accent/30 hover:text-accent transition-all">
                  Edit
                </button>
                <button onClick={() => handleDelete(essay.id)}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm border border-white/10 rounded-lg text-tx-muted hover:border-red-500/30 hover:text-red-400 transition-all">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {essays.length === 0 && <p className="text-tx-dim text-center py-12">No essays yet. Create your first one.</p>}
        </div>
      )}

      {/* New / Edit Essay Form */}
      {(tab === "new" || tab === "edit") && (
        <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
          <h2 className="font-serif text-xl font-semibold">{editId ? "Edit Essay" : "New Essay"}</h2>

          {/* Upload Zone - only show for new essays */}
          {!editId && (
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.txt,.md,.pdf,.doc"
                onChange={handleFileUpload}
                className="hidden"
                id="essay-upload"
              />
              <label
                htmlFor="essay-upload"
                className={`flex flex-col items-center justify-center p-5 sm:p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  uploading ? "border-accent/50 bg-accent/5" : "border-white/10 hover:border-accent/30 hover:bg-white/[0.02]"
                }`}>
                {uploading ? (
                  <p className="text-accent text-sm">Extracting text...</p>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-tx-dim mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-tx-muted text-sm font-medium">Upload an essay</p>
                    <p className="text-tx-dim text-xs mt-1">.docx, .txt, .md supported</p>
                  </>
                )}
              </label>
              {uploadError && <p className="text-red-400 text-sm mt-2">{uploadError}</p>}
              <p className="text-tx-dim text-xs mt-2 text-center">Or write directly below</p>
            </div>
          )}

          <div>
            <label className="block text-tx-dim text-sm mb-2">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3 text-tx focus:outline-none focus:border-accent/50"
              placeholder="Essay title" />
          </div>

          <div>
            <label className="block text-tx-dim text-sm mb-2">Slug (auto-generated if empty)</label>
            <input value={slug} onChange={e => setSlug(e.target.value)}
              className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3 text-tx font-mono text-sm focus:outline-none focus:border-accent/50"
              placeholder="the-essay-slug" />
          </div>

          <div>
            <label className="block text-tx-dim text-sm mb-2">Excerpt</label>
            <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} rows={2}
              className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3 text-tx focus:outline-none focus:border-accent/50 resize-none"
              placeholder="A brief summary..." />
          </div>

          <div>
            <label className="block text-tx-dim text-sm mb-2">Content (use ## for headings)</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={18} required
              className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3 text-tx font-mono text-sm leading-relaxed focus:outline-none focus:border-accent/50 resize-y"
              placeholder="Your essay content..." />
          </div>

          <div className="space-y-4 sm:space-y-0 sm:flex sm:gap-6 sm:flex-wrap sm:items-end">
            <div className="w-full sm:w-auto">
              <label className="block text-tx-dim text-sm mb-2">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full sm:w-auto bg-bg border border-white/10 rounded-lg px-4 py-3 text-tx focus:outline-none focus:border-accent/50">
                {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)}
                  className="w-4 h-4 accent-amber-600" />
                <span className="text-tx-muted text-sm">Published</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)}
                  className="w-4 h-4 accent-amber-600" />
                <span className="text-tx-muted text-sm">Featured</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit"
              className="flex-1 sm:flex-none bg-accent text-bg font-medium px-6 sm:px-8 py-3 rounded-lg hover:bg-accent-light transition-colors">
              {editId ? "Update Essay" : "Create Essay"}
            </button>
            <button type="button" onClick={() => { resetForm(); setTab("essays"); }}
              className="flex-1 sm:flex-none px-6 py-3 border border-white/10 rounded-lg text-tx-muted hover:text-tx transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Featured Picker */}
      {tab === "featured" && (
        <div className="space-y-6 max-w-3xl">
          <div>
            <h2 className="font-serif text-xl font-semibold">Featured Essays</h2>
            <p className="text-tx-dim text-sm mt-1">Select exactly 4 essays to display on the homepage. Click to add or remove.</p>
          </div>

          {/* Current selections */}
          <div className="space-y-3">
            <h3 className="text-tx-dim text-xs font-mono tracking-widest uppercase">Selected ({featuredIds.length}/4)</h3>
            {featuredIds.length === 0 && (
              <p className="text-tx-dim text-sm py-4">No essays selected. Pick 4 from the list below.</p>
            )}
            {featuredIds.map((id, idx) => {
              const essay = essays.find(e => e.id === id);
              if (!essay) return null;
              const cat = categories.find(c => c.key === essay.category);
              return (
                <div key={id} className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-4 bg-accent/5 border border-accent/20 rounded-xl">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <span className="text-accent font-mono text-lg font-bold w-6 sm:w-8 shrink-0">{idx + 1}</span>
                    <div className="min-w-0">
                      <h4 className="font-serif font-medium text-sm sm:text-base truncate">{essay.title}</h4>
                      <p className="text-tx-dim text-xs font-mono">{cat?.label || essay.category}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setFeaturedIds(prev => prev.filter(i => i !== id)); setFeaturedSaved(false); }}
                    className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          {/* Save button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <button
              onClick={() => { saveFeaturedIds(featuredIds); setFeaturedSaved(true); setTimeout(() => setFeaturedSaved(false), 2000); }}
              disabled={featuredIds.length !== 4}
              className={`w-full sm:w-auto px-6 sm:px-8 py-3 rounded-lg font-medium transition-all ${featuredIds.length === 4 ? "bg-accent text-bg hover:bg-accent-light" : "bg-white/5 text-tx-dim cursor-not-allowed"}`}>
              Save Featured
            </button>
            {featuredSaved && <span className="text-green-400 text-sm">Saved!</span>}
            {featuredIds.length !== 4 && featuredIds.length > 0 && (
              <span className="text-tx-dim text-sm">Select {4 - featuredIds.length} more</span>
            )}
          </div>

          {/* All essays to pick from */}
          <div className="space-y-2 pt-4 border-t border-white/5">
            <h3 className="text-tx-dim text-xs font-mono tracking-widest uppercase mb-3">All Published Essays</h3>
            {getPublishedEssays().map(essay => {
              const isSelected = featuredIds.includes(essay.id);
              const cat = categories.find(c => c.key === essay.category);
              return (
                <button
                  key={essay.id}
                  onClick={() => {
                    if (isSelected) {
                      setFeaturedIds(prev => prev.filter(i => i !== essay.id));
                    } else if (featuredIds.length < 4) {
                      setFeaturedIds(prev => [...prev, essay.id]);
                    }
                    setFeaturedSaved(false);
                  }}
                  disabled={!isSelected && featuredIds.length >= 4}
                  className={`w-full text-left flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-accent/10 border-accent/30 text-accent"
                      : featuredIds.length >= 4
                        ? "bg-bg-card border-white/5 opacity-40 cursor-not-allowed"
                        : "bg-bg-card border-white/5 hover:border-white/15"
                  }`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-all ${isSelected ? "border-accent bg-accent" : "border-white/20"}`}>
                      {isSelected && <span className="text-bg text-xs font-bold">&check;</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-serif font-medium text-sm truncate">{essay.title}</h4>
                      <p className="text-tx-dim text-xs font-mono">{cat?.label} &middot; {essay.read_time}m read</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Page Content Editor */}
      {tab === "pages" && (
        <div className="space-y-6">
          <h2 className="font-serif text-xl font-semibold">Page Content</h2>
          <p className="text-tx-dim text-sm">Edit the About and Author page content.</p>

          {pages.map(page => (
            <div key={page.page_key} className="p-4 sm:p-6 bg-bg-card border border-white/5 rounded-xl">
              <div className="flex items-start sm:items-center justify-between gap-3 mb-3 sm:mb-4">
                <h3 className="font-serif text-base sm:text-lg font-medium">{page.title}</h3>
                <button onClick={() => startPageEdit(page)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-white/10 rounded-lg text-tx-muted hover:border-accent/30 hover:text-accent transition-all shrink-0">
                  Edit
                </button>
              </div>
              <p className="text-tx-dim text-sm line-clamp-3">{page.content.substring(0, 200)}...</p>
            </div>
          ))}

          {/* Page edit form */}
          {pageKey && (
            <form onSubmit={handlePageSave} className="max-w-3xl space-y-4 p-4 sm:p-6 bg-bg-card border border-accent/20 rounded-xl mt-6">
              <h3 className="font-serif text-base sm:text-lg font-medium">Editing: {pageTitle}</h3>
              <div>
                <label className="block text-tx-dim text-sm mb-2">Title</label>
                <input value={pageTitle} onChange={e => setPageTitle(e.target.value)}
                  className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3 text-tx focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="block text-tx-dim text-sm mb-2">Content (separate paragraphs with blank lines)</label>
                <textarea value={pageContent} onChange={e => setPageContent(e.target.value)} rows={12}
                  className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3 text-tx leading-relaxed focus:outline-none focus:border-accent/50 resize-y" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 sm:flex-none bg-accent text-bg font-medium px-6 py-3 rounded-lg hover:bg-accent-light transition-colors">
                  Save Changes
                </button>
                <button type="button" onClick={() => { setPageKey(""); setPageTitle(""); setPageContent(""); }}
                  className="flex-1 sm:flex-none px-6 py-3 border border-white/10 rounded-lg text-tx-muted hover:text-tx transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
