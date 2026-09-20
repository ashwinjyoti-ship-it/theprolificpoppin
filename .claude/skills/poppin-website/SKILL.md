---
name: poppin-website
description: Operate theprolificpoppin.com (Ash's personal essay blog on consciousness, non-duality, and Vedanta) on his behalf — publishing, editing, or deleting essays, editing the About/Author pages, changing the 4 featured homepage essays, and diagnosing or fixing bugs in the site's Next.js/Postgres/Vercel codebase. Trigger this whenever Ash mentions "theprolificpoppin", "the poppin site/website", "Mr. Poppin", publishing or editing an essay for his blog, his admin panel, or asks you to write/post/take down a consciousness or Vedanta essay for his site — even if he doesn't name the domain or repo explicitly.
---

# Operating theprolificpoppin.com

theprolificpoppin.com is Ash's personal essay blog exploring consciousness, non-duality, and Vedic philosophy. It's a Next.js 14 App Router site (Postgres/Neon for storage) deployed on Vercel, backed by the repo `ashwinjyoti-ship-it/theprolificpoppin`.

**Two Vercel projects exist under this account — don't mix them up:**
- `theprolificpoppin` (project id `prj_S7WmrHS4gxEDNlFAWs3og4NUPu2c`) — this is the live one, bound to theprolificpoppin.com.
- `theprolificpoppin-site` — a decoy/leftover project. It is *not* the live site. If you ever need to touch Vercel env vars or deployments directly, double-check you're looking at the first one.

## Two kinds of task — pick the lighter one

Most requests are **content changes**: publish an essay, edit one, delete one, update the About/Author text, or change which 4 essays are featured on the homepage. For these, don't touch the codebase at all — call the live API directly. It's faster, there's nothing to review, and it's exactly what the site's own admin panel does under the hood.

Only clone the repo and write code when the request is actually about the site's *behavior* — a bug, a new feature, a design change, a broken page.

## Content changes: call the API directly

Every write to essays, pages, or featured picks goes through `https://theprolificpoppin.com/api/...`, authenticated with a secret key — no need to log into `/admin` or touch a browser. Get the key:

- It's the `ADMIN_API_KEY` Vercel environment variable on the `theprolificpoppin` project. If you don't already have it in this session, ask Ash rather than guessing — it's a secret and it does rotate occasionally.

Send it as a request header, e.g.:

```bash
curl -X POST https://theprolificpoppin.com/api/essays \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"title": "...", "content": "...", "category": "the-ache", "published": false}'
```

The exact endpoints, methods, and the essay/page JSON shape are documented in the repo's own root **`AGENTS.md`** — read that file fresh each time rather than trusting a copy here, since routes can change as the site evolves. As of this skill's writing, the shape is: essays have `title`, `content` (use `## ` for headings), `category` (one of four fixed keys — see below), `excerpt` and `slug` (both auto-generated if omitted), `published`, and `featured`; pages are keyed `about` / `about_author`; featured is a list of exactly 4 essay ids.

The four essay categories are fixed and meaningful (they're stages of an inner journey, defined in `lib/data.ts`): `the-ache`, `the-unraveling`, `the-experiment`, `the-opening`. **Never guess which one an essay belongs in** — if it's not obvious from the content and Ash hasn't said, ask him.

**Defaults that matter:**
- Create new essays as `"published": false` (draft) unless Ash explicitly says to publish it live now. He wants to review before it's public.
- Never delete an essay without Ash confirming first, in this conversation, that he means it — deletion is permanent (a real `DELETE FROM essays` against the shared Postgres database, visible to everyone immediately).
- Content changes take effect on the live site immediately after the API call — the site revalidates its cached pages on every write, so there's no redeploy to wait for.

If Ash wants this scripted rather than one-off (e.g. publishing from a local file), the repo already has `scripts/publish-essay.mjs` for exactly this — it takes `SITE_URL` and `ADMIN_API_KEY` as env vars and a local JSON file.

## Code changes: clone, branch, verify, PR

When the task is actually about how the site behaves — not just its content — work in the repo like any other codebase change:

1. Attach the repo with push access (`add_repo` with `access: "push"` if you're not already working in a clone of it), and read the current `AGENTS.md` and relevant `lib/`/`app/api/` files fresh — this skill deliberately doesn't duplicate route/schema details that can drift out of date.
2. Branch off `main`. Never commit `ADMIN_API_KEY`, `ADMIN_PASSWORD`, or `DATABASE_URL` — they live only in Vercel's env vars or a local gitignored `.env`.
3. Sanity-check before pushing: `npx tsc --noEmit`, then `npm run build`. Note that `next build` needs a *real* `DATABASE_URL` to fully succeed, because pages with `generateStaticParams` query Postgres at build time — running it with a fake or missing `DATABASE_URL` fails with `ECONNREFUSED` during static generation. That's expected in a sandbox without real DB access, not a sign your change broke something; `tsc --noEmit` plus a clean compile ("Compiled successfully" before the DB error) is enough to know the code itself is sound.
4. Push, open a **draft** PR, and subscribe to its activity so review comments and CI results come back to you.

## Known-fixed issues worth knowing about (so you don't "rediscover" and re-fix them)

- **Content used to look device-restricted.** Before the Postgres database was wired in, admin actions (including delete) weren't persisted anywhere shared — a delete only updated whatever was in memory in one browser, so it looked reverted on any other device. This is fixed: every write goes through the API to the shared database now.
- **Pages used to go stale after a content change.** The homepage, essay list, individual essay pages, and About/Author pages are statically rendered; without cache invalidation, an admin edit wouldn't show up live until the next deploy. This is fixed too — every content route calls Next's `revalidatePath()` after writing, so changes are live immediately.

If you ever find yourself about to "fix" either of the above from scratch, stop and check `git log` / the current code first — you're probably looking at a regression, not a first-time gap, and it's worth figuring out what reintroduced it rather than just re-patching.
