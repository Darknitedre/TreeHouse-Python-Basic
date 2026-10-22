# Social Action Vault — Implementation Plan

Built in phases. This repository implements **Phase 1 (planning)** and a working
**Phase 2 MVP**, plus several Phase 3 features (collections, weekly review,
export, semantic-search-ready schema). Each feature follows: explain → list
files → code → how to test → limitations.

## Phase 1 — Planning ✅ (in `docs/`)
- PRD, architecture, DB schema, folder structure, user flows, assumptions.

## Phase 2 — MVP ✅
1. **Project scaffold** — Next.js + TS + Tailwind, theming, config, env.
2. **Database + RLS** — `supabase/migrations/0001_init.sql` (all tables,
   policies, pgvector, full-text index, triggers).
3. **Auth** — Supabase email/password, session middleware, route guards.
4. **AI core** — Anthropic client, strict JSON schema, prompt, validated
   processing pipeline with graceful failure.
5. **Ingestion** — URL public-metadata fetch (SSRF-safe), screenshot OCR via
   vision, text/notes.
6. **Save Post** — form (URL / text / screenshot / notes) → create → process.
7. **Library** — list + filter, card grid.
8. **Saved Post page** — full detail + all actions (edit, archive, delete,
   reprocess, mark reviewed, add action item, export, share).
9. **Action-Item Manager** — list, filter, status, due dates, notes.
10. **Dashboard** — real counts + "Turn Knowledge Into Action".
11. **Search & filters** — full-text search endpoint + UI.

## Phase 3 — Enhancements (schema + several features implemented)
- Semantic search (pgvector embeddings written on process; hybrid query).
- Collections (many-to-many).
- Weekly review + AI weekly report.
- Data export (Markdown / CSV / JSON / plain text).
- Related-post recommendations (tag/category overlap; vector-ready).
- Notification preferences (stored; delivery is a follow-up).
- Mobile share target (PWA manifest scaffolded).

## Phase 4 — Testing
- Vitest unit tests: URL validation, AI-response validation, schema coercion,
  utility functions. API/integration tests are stubbed where they need a live
  Supabase/Anthropic and documented as such.

## User flows (Phase 1, item 5)

1. **Save by URL** → paste URL → server validates + fetches public metadata →
   create post (pending) → AI analyze → show result on post page.
2. **Save by screenshot** → upload image → Storage → vision OCR extracts text →
   AI analyze the extracted text → post page.
3. **Save by text/notes** → paste → AI analyze → post page.
4. **Act on it** → action items appear in Action-Item Manager and the dashboard
   "Turn Knowledge Into Action" list → user sets status/due date → completes.
5. **Find it later** → search by keyword/meaning; browse by category/tag/
   collection; weekly review resurfaces the week.

## Assumptions (Phase 1, item 6)

- Single primary user initially; multi-tenant-ready via RLS.
- Public metadata fetch is best-effort; many platforms block bots or require
  login — in that case we save the URL + whatever is available and let the user
  paste text. We never bypass auth.
- OCR uses the Anthropic vision model on the uploaded image (no third-party OCR).
- Embeddings: the schema stores a `vector(1536)`; the embedding provider is
  pluggable (default: a deterministic local fallback if no embeddings key is set,
  so the app runs without one; production uses a real embedding endpoint).
- Notifications are stored as preferences; actual push/email delivery is a
  deployment concern (cron + provider) noted but not wired to a live provider.
- Deployment on Vercel with Supabase; env vars supply all secrets.
