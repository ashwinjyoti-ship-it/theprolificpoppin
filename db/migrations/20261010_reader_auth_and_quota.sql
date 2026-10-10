-- Reader auth (Auth.js / NextAuth pg adapter) + Mr. Poppin daily quota.
-- Run manually against Neon after deploy (or via: DATABASE_URL=... node scripts/apply-migration.mjs db/migrations/20261010_reader_auth_and_quota.sql)
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

create extension if not exists pgcrypto;

-- Auth.js tables (https://authjs.dev/getting-started/adapters/pg)
create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text
);

create table if not exists accounts (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  unique (provider, "providerAccountId")
);

create index if not exists accounts_userId_idx on accounts ("userId");

create table if not exists sessions (
  id text primary key default gen_random_uuid()::text,
  "sessionToken" text not null unique,
  "userId" text not null references users(id) on delete cascade,
  expires timestamptz not null
);

create index if not exists sessions_userId_idx on sessions ("userId");

create table if not exists verification_tokens (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);

-- Durable daily quotas (IST calendar day as text YYYY-MM-DD).
-- subject_type: 'user' | 'anon' | 'ip'
create table if not exists ai_chat_usage (
  id uuid primary key default gen_random_uuid(),
  day_ist date not null,
  subject_type text not null check (subject_type in ('user', 'anon', 'ip')),
  subject_key text not null,
  question_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (day_ist, subject_type, subject_key)
);

create index if not exists ai_chat_usage_day_idx on ai_chat_usage (day_ist);
create index if not exists ai_chat_usage_subject_idx on ai_chat_usage (subject_type, subject_key);

-- Tie discussion threads to readers (Auth.js user id or anonymous cookie id).
alter table ai_discussion_threads
  add column if not exists user_id text references users(id) on delete set null;

alter table ai_discussion_threads
  add column if not exists anonymous_id uuid;

create index if not exists ai_discussion_threads_user_id_idx on ai_discussion_threads (user_id);
create index if not exists ai_discussion_threads_anonymous_id_idx on ai_discussion_threads (anonymous_id);
