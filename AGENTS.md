# Agent instructions: publishing content

This file tells an AI agent (not a packaged "skill") how to create, edit,
or delete essays and page content on theprolificpoppin.com on Ash's behalf.

## How auth works

- All writes go through the Next.js API routes in `app/api/`.
- Every request must include the header `x-api-key: <ADMIN_API_KEY>`.
- `ADMIN_API_KEY` is a secret, set as an environment variable on Vercel.
  It is never committed to this repo. Read it from a local `.env` file
  (gitignored) when running scripts, or from wherever Ash's assistant
  stores its secrets.
- This key is separate from Ash's human admin password (used to log into
  `/admin` in the browser). The agent never needs the human password.

## Endpoints

Base URL: `https://theprolificpoppin.com` (or `SITE_URL` if testing a
preview deployment).

| Action | Method | Path |
|---|---|---|
| List essays (incl. drafts) | GET | `/api/essays` |
| Create essay | POST | `/api/essays` |
| Get one essay | GET | `/api/essays/:id` |
| Update essay | PUT | `/api/essays/:id` |
| Delete essay | DELETE | `/api/essays/:id` |
| List page content | GET | `/api/pages` |
| Update a page (about / about_author) | PUT | `/api/pages` |
| Get featured essays | GET | `/api/featured` |
| Set featured essays (exactly 4 ids) | PUT | `/api/featured` |

Every request above needs the `x-api-key` header. All bodies are JSON.

### Essay object

```json
{
  "title": "string, required",
  "content": "string, required — use \"## \" for headings",
  "category": "the-ache | the-unraveling | the-experiment | the-opening",
  "excerpt": "string, optional — auto-generated from content if omitted",
  "slug": "string, optional — auto-generated from title if omitted",
  "published": true,
  "featured": false
}
```

`category` must be one of the four keys defined in `lib/data.ts`
(`categories`). Include `id` in the body of a PUT to update an existing
essay.

## Doing the work

Use `scripts/publish-essay.mjs` rather than hand-rolling fetch calls:

```bash
SITE_URL=https://theprolificpoppin.com \
ADMIN_API_KEY=<the secret> \
node scripts/publish-essay.mjs path/to/essay.json
```

- Write the essay content to a local JSON file matching the shape above.
- Omit `id` to create a new essay, include it to update one.
- The script prints the saved essay (with its assigned `id` and `slug`)
  on success, or the error on failure.
- To delete an essay, call the DELETE endpoint directly (no script needed
  yet — ask Ash before deleting, deletion is permanent):

```bash
curl -X DELETE "$SITE_URL/api/essays/$ID" -H "x-api-key: $ADMIN_API_KEY"
```

## Rules for the agent

- Default new essays to `"published": false` (draft) unless Ash explicitly
  says to publish immediately, so he can review on the site first.
- Never guess at `category` — ask Ash if it isn't obvious from the essay's
  content and the four category descriptions in `lib/data.ts`.
- Never delete an essay without Ash confirming first.
- Never print or log the value of `ADMIN_API_KEY` back to Ash in a shared
  or persisted place beyond where he already keeps it.
