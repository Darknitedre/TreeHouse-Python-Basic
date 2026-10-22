# Social Action Vault

A mobile-first web app that helps you **save valuable social-media posts and turn
them into action.** Save a post by URL, pasted text, screenshot, transcript, or
note, and AI generates a summary, main points, a key takeaway, concrete action
items, and a full classification (category, tags, platform, sentiment, priority)
— all searchable and editable.

> Built for a single primary user first, but every table is owned by a `user_id`
> and isolated with Postgres row-level security, so multi-user accounts work
> without a rewrite.

## Stack

- **Next.js 14 (App Router) + TypeScript + React**
- **Tailwind CSS** — mobile-first, light/dark
- **Supabase** — Auth, Postgres (RLS), Storage, and **pgvector** for semantic search
- **Anthropic API** — summaries, extraction, classification, action items, weekly reports
- **Vercel** — deployment target

See [`docs/`](./docs) for the full PRD, architecture, database schema notes, and
implementation plan.

## Features

- **Save** by URL (public metadata only — never bypasses logins), pasted text,
  screenshot (AI vision OCR), transcript, or note.
- **AI processing** → quick summary, main points, key takeaway, 1–5 specific
  action items, and automatic classification. Every AI response is validated
  against a strict Zod schema before it touches the database, with graceful
  failure and a one-click reprocess.
- **Dashboard** with totals, weekly counts, open/overdue/completed tasks, top
  categories, recent + high-priority posts, and a **Turn Knowledge Into Action**
  panel.
- **Saved-post page** with full detail and every action: open original, edit,
  archive, delete, add action item, mark reviewed, reprocess, share, export.
- **Action-Item Manager** — filter by status/priority/due, sort by importance,
  edit due dates, change status.
- **Search** — full-text + semantic (pgvector) hybrid search.
- **Collections**, **Weekly Review** (with an AI knowledge-and-action report),
  **notification preferences**, **exports** (Markdown/CSV/JSON/text), account
  deletion, and a PWA share target.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys
```

### 1. Set up Supabase

1. Create a Supabase project.
2. Run the SQL in [`supabase/migrations`](./supabase/migrations) in order
   (`0001_init.sql`, then `0002_seed_and_storage.sql`) in the SQL editor, or with
   the Supabase CLI (`supabase db push`).
3. Enable Email auth in Authentication → Providers.
4. Copy the project URL, anon key, and service-role key into `.env.local`.

### 2. Add API keys

- `ANTHROPIC_API_KEY` for AI processing.
- `EMBEDDINGS_API_KEY` is optional — without it, semantic search uses a
  deterministic local fallback so everything still runs.

### 3. Run

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run test       # vitest unit tests
npm run build      # production build
```

## Security

- RLS on every table (`user_id = auth.uid()`); service-role key stays server-side.
- SSRF-safe URL validation; file-upload MIME + size validation.
- Per-user rate limiting on AI/upload endpoints.
- Account data export and full deletion.
- Only public third-party metadata is fetched — no scraping behind logins.

## Project layout

```
src/app            — App Router pages + /api route handlers
src/components     — UI (server + client components)
src/lib            — supabase clients, ai, ingest, db helpers, validation, utils
supabase/migrations— schema (RLS + pgvector + full-text)
docs/              — PRD, architecture, implementation plan
tests/             — Vitest unit tests
```
