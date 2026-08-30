# Social Action Vault — Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 (App Router) + TypeScript** | SSR + API route handlers in one deploy target |
| UI | **React + Tailwind CSS** | Mobile-first, fast, light/dark theming |
| Auth | **Supabase Auth** (email/password) | Sessions via cookies, RLS-aware |
| Database | **Supabase Postgres** | Relational model + row-level security |
| Vector search | **pgvector** in the same Postgres | Semantic search without a second datastore |
| File storage | **Supabase Storage** | Screenshots / thumbnails, per-user buckets |
| AI | **Anthropic Messages API** (structured JSON output) | Summaries, extraction, classification, action items, weekly reports |
| Deploy | **Vercel** | First-class Next.js host |

## System diagram

```
┌────────────────────────────────────────────────────────────┐
│                     Browser (mobile-first)                  │
│   React pages · Tailwind · light/dark · installable PWA     │
└───────────────┬───────────────────────────┬────────────────┘
                │ Supabase JS (auth cookies) │ fetch()
                ▼                             ▼
      ┌───────────────────┐        ┌──────────────────────────┐
      │  Supabase Auth    │        │  Next.js Route Handlers   │
      │  (session cookie) │        │  /api/*  (server-only)    │
      └───────────────────┘        └────────┬─────────────────┘
                                            │ service calls
             ┌──────────────────────────────┼───────────────────────┐
             ▼                              ▼                        ▼
   ┌──────────────────┐        ┌────────────────────┐    ┌────────────────────┐
   │ Supabase Postgres│        │  Anthropic API     │    │ Supabase Storage    │
   │ + RLS + pgvector │        │  (server-side key) │    │ (screenshots)       │
   └──────────────────┘        └────────────────────┘    └────────────────────┘
```

## Key decisions

- **Server-only secrets.** The Anthropic key and the Supabase _service-role_ key
  live only in server code (route handlers). The browser gets only the Supabase
  anon key + URL, which are safe with RLS.
- **Two Supabase clients.**
  - *Browser/SSR client* — uses the anon key and the user's cookie session; every
    query runs under RLS as that user.
  - *Server admin client* — service-role key, used only inside route handlers for
    privileged work (embeddings write-back, admin deletes) and always scoped by an
    explicit `user_id` we verify from the session first.
- **AI contract.** The model is asked to return JSON that matches a strict Zod
  schema (`PostAnalysisSchema`). Every response is validated before it touches
  the DB. Invalid JSON / missing fields degrade gracefully: the post is still
  saved with `processing_status = 'failed'` and can be reprocessed.
- **Processing pipeline.** Saving a post creates the row immediately
  (`processing_status = 'pending'`), then runs analysis. Analysis writes the
  summary, main points, action items, tags, category, and (Phase 3) an embedding
  for semantic search. This keeps the UI responsive and makes reprocessing a
  first-class operation.
- **Search.** Phase 2 uses Postgres full-text (`tsvector`) across content,
  summary, points, tags, notes, creators. Phase 3 adds pgvector cosine similarity
  and blends the two (hybrid search).

## Directory layout

```
src/
  app/
    (auth)/login, signup            — unauthenticated pages
    (app)/                          — authenticated shell (nav + pages)
      dashboard, save, library, library/[id],
      action-items, collections, weekly-review, settings
    api/                            — route handlers (server only)
      posts/ · posts/[id]/ · posts/[id]/reprocess
      action-items/ · action-items/[id]
      search/ · dashboard/ · collections/ · weekly-review/ · export/
    layout.tsx · globals.css
  components/                       — cards, nav, forms, primitives
  lib/
    supabase/ (browser, server, admin, middleware)
    ai/ (client, schema, prompts, process)
    ingest/ (url-metadata, image-ocr)
    validation/ (zod schemas)
    db/ (typed queries)
    types.ts · constants.ts · utils.ts
  middleware.ts                     — refreshes session, guards routes
supabase/migrations/                — SQL schema (RLS + pgvector)
docs/                               — this documentation
```

## Security posture

- Supabase RLS on every table (`user_id = auth.uid()`).
- Service-role key never shipped to the client.
- File-upload validation (MIME + size) before Storage writes.
- Safe URL validation (http/https only, block private/loopback hosts — SSRF).
- Basic per-user rate limiting on AI endpoints.
- Account data export + delete (GDPR-style) supported.
- Third-party content stored is public metadata only; original links preserved.
