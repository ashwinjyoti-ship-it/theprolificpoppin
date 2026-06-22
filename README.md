# The Prolific Poppin

Next.js site for essays, curated featured writing, and the Mr. Poppin chat
experience.

## Stack

- Next.js 14 + React 18 + Tailwind
- Neon Postgres via `postgres`
- Node.js API routes for essays, pages, featured curation, and AI chat
- Optional OpenAI integration for generated chat answers

## Local setup

```bash
npm install
printf 'DATABASE_URL=postgres://...\n' > .env.local
npm run db:bootstrap
npm run db:seed
npm run dev
```

Required `.env.local` values:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon Postgres connection string; `lib/db.ts` requires it at import time |
| `OPENAI_API_KEY` | No | Enables model-generated Mr. Poppin answers |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini` |

Without `OPENAI_API_KEY`, `/api/ai/query` still returns cited fallback answers
from retrieved essay passages.

## Database workflow

| Command | Effect |
|---------|--------|
| `npm run db:bootstrap` | Applies `db/schema.sql` to the configured Neon database |
| `npm run db:seed` | Truncates and reloads essays, chunks, pages, and featured rows from `lib/data.ts` |

Canonical runtime content lives in Postgres. The old `public/essays/*.json`
files are legacy static-export artifacts and are not read by the app.

## Key codepaths

| Area | Files |
|------|-------|
| Database client | `lib/db.ts` |
| Schema | `db/schema.sql` |
| Content CRUD | `lib/server-data.ts`, `app/api/essays`, `app/api/pages`, `app/api/featured` |
| Knowledge chunking | `lib/knowledge.ts` |
| Retrieval and chat persistence | `lib/essay-ai.ts`, `app/api/ai/query/route.ts` |
| Chat UI | `app/talk-to-mr-poppin/*` |
| Admin UI | `app/admin/page.tsx` |

## Content and admin notes

- Admin essay saves call `saveEssay()`, which updates the essay row and refreshes
  its `essay_chunks` rows.
- The homepage featured list is stored in `featured_essays` and managed by the
  Admin Featured tab. It is separate from the per-essay `essays.featured` flag.
- The Featured tab requires exactly four selected essays before saving.
- Current admin gating is client-side, and API routes do not enforce server-side
  auth. Do not treat the admin/API surface as hardened for untrusted exposure.

## AI knowledge layer

See [docs/ai-knowledge-layer.md](docs/ai-knowledge-layer.md) for the retrieval
model, `/api/ai/query` contract, source citation shape, and current vector-search
limitations.
