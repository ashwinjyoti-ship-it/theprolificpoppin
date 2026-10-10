# AI Knowledge Layer

Database + chat foundation for Talk to Mr. Poppin and future retrieval work.

## What the layer is for

- Store each essay as a canonical record in Postgres
- Split essays into searchable chunks for retrieval
- (Optional later) Attach embeddings for semantic search
- Keep discussion threads and messages tied to the essay knowledge base
- Capture training examples for future model tuning or evaluation

## Database tables

- `essays`
- `essay_chunks`
- `ai_discussion_threads`
- `ai_discussion_messages`
- `ai_training_examples`

No new Neon migration is required for the Mr. Poppin chat work — threads/messages already exist in `db/schema.sql`.

## Talk to Mr. Poppin

Route: `/talk-to-mr-poppin` · API: `/api/ai/query`

### Env vars (Vercel → `theprolificpoppin` project)

| Var | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Preferred | Primary provider |
| `ANTHROPIC_MODEL` | No | Default `claude-sonnet-5-5` |
| `OPENAI_API_KEY` | Fallback | Used only if Anthropic key is unset |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `DATABASE_URL` | Yes | Neon — stores questions/answers |

Keys are server-side only. Never expose them to the client.

### Behavior notes

- Retrieval skips greetings/small talk and never falls back to score-0 chunks.
- Per-IP rate limit: in-memory sliding window on the Vercel isolate (12 req / 60s). Free, no Redis; cold starts reset the map.
- Questions are stored in Neon (`ai_discussion_*`) to improve the archive; the page discloses this in one line.
- Thread id is persisted in `localStorage` and restored via `GET /api/ai/query?threadId=…`.

## How retrieval works today

1. Keyword tokenize the question (cheap, no embeddings)
2. Score published `essay_chunks` by term overlap with title/slug/content
3. Return only positive-score hits (or essay-scoped hits)
4. Feed passages + capped history to Anthropic (or OpenAI fallback)
5. Persist the exchange

Embeddings remain optional; the `essay_chunks.embedding` column is unused for now.
