# Reader auth + free taste (Talk to Mr. Poppin)

## Why Auth.js + Resend + Neon Postgres adapter

- **Auth.js (NextAuth v5)** is the standard for Next.js App Router: Google OAuth and email magic links are first-class providers.
- **`@auth/pg-adapter` + `pg`** stores users/sessions in the existing Neon `DATABASE_URL` (no separate auth database).
- **Resend** sends magic-link email with minimal setup and a verified sender domain.
- Mounted at **`/api/reader-auth`** so **`/api/auth/login`** and **`/api/auth/logout`** (admin `ADMIN_PASSWORD` / `ADMIN_API_KEY`) stay untouched.

## Neon migration (required, manual)

Apply once on the production Neon database:

```bash
DATABASE_URL='…' node scripts/apply-migration.mjs db/migrations/20261010_reader_auth_and_quota.sql
```

Or paste `db/migrations/20261010_reader_auth_and_quota.sql` into the Neon SQL editor.

**Must be run manually** before reader sign-in / durable quotas work. Safe to re-run (`IF NOT EXISTS`).

Creates Auth.js tables (`users`, `accounts`, `sessions`, `verification_token`), `ai_chat_usage`, and `user_id` / `anonymous_id` on `ai_discussion_threads`.

## Quotas

| Who | Cap | Day boundary | Storage |
|---|---|---|---|
| Anonymous | 5 / day | IST (`Asia/Kolkata`) | Neon `ai_chat_usage` for **both** signed anon cookie and IP hash (clearing cookies alone does not reset) |
| Signed-in | 50 / day | IST | Neon by Auth.js user id |

Per-minute in-memory IP limit still applies.

## Env vars / external setup (Vercel project `theprolificpoppin`)

### 1. `AUTH_SECRET`

```bash
openssl rand -base64 32
```

Set in Vercel → Environment Variables for Production (and Preview if you want auth there).

### 2. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create OAuth client ID (Web application).
2. Authorized JavaScript origins:
   - `https://www.theprolificpoppin.com`
   - `https://theprolificpoppin.com` (if used)
   - Preview: `https://*.vercel.app` is not always accepted; add specific preview URLs as needed.
3. Authorized redirect URIs (exact):
   - `https://www.theprolificpoppin.com/api/reader-auth/callback/google`
   - `https://theprolificpoppin.com/api/reader-auth/callback/google` (if apex is used)
   - For each Vercel preview you care about: `https://<preview-host>/api/reader-auth/callback/google`
   - Local: `http://localhost:3000/api/reader-auth/callback/google`
4. Copy Client ID → `AUTH_GOOGLE_ID`, Client secret → `AUTH_GOOGLE_SECRET`.

### 3. Resend (magic link email)

1. Create a [Resend](https://resend.com) account and API key → `AUTH_RESEND_KEY`.
2. Verify your sending domain (e.g. `theprolificpoppin.com`) and add the DNS records Resend shows (SPF/DKIM).
3. Set `AUTH_EMAIL_FROM` to something like `Mr. Poppin <hello@theprolificpoppin.com>` on that domain.
4. Until DNS is ready, you can test with Resend’s `onboarding@resend.dev` (limited to your own email).

### 4. Optional

- `AUTH_URL=https://www.theprolificpoppin.com` (helps Auth.js build absolute callback URLs)
- Keep existing `ANTHROPIC_API_KEY`, `DATABASE_URL`, admin vars as they are.

## Privacy copy

The chat panel discloses that questions are stored to improve the archive, and that sign-in email is used only for this chat.
