# Social Action Vault — Product Requirements

## 1. Restated Requirements

Social Action Vault is a **mobile-first web application** that helps a user save
valuable social-media posts (Instagram, TikTok, Facebook, LinkedIn, X, YouTube,
Reddit, Threads) and, critically, **turn them into action**. For every saved
post the app uses AI to summarize, extract main points and key takeaways,
identify practical lessons, generate concrete action items, classify the content
by topic, and make everything searchable.

The differentiator is the loop from _saving_ to _doing_: most people hoard
"saved" content and never revisit it. This app resurfaces the ideas as
specific, measurable, achievable tasks and helps the user follow through.

### Ways to save
1. A social-media post URL (fetch public metadata only — never bypass logins).
2. Pasted text.
3. A screenshot / uploaded image (OCR + vision text extraction).
4. A video/audio transcript (pasted).
5. Manual notes.
6. Mobile share-sheet — planned for a later version (PWA share target).

### AI processing (per saved post)
- **Quick Summary** — 2–4 sentences.
- **Main Points** — structured list.
- **Key Takeaway** — the single most valuable lesson.
- **Action Items** — 1–5, each with title, description, priority, estimated
  effort, suggested due date, status, and a link back to the source post. No
  vague tasks ("learn more", "think about this"). Specific, measurable,
  achievable.
- **Classification** — category, tags, platform, content type, priority,
  sentiment, relevant project / life area.

All AI output is editable by the user.

### Surfaces
- **Dashboard** — totals, this-week, open / overdue / completed action items,
  common categories, recent posts, high-priority posts, un-reviewed posts, and a
  "Turn Knowledge Into Action" section of the most important unfinished tasks.
- **Saved Post page** — full detail + action buttons (open original, edit,
  archive, delete, add action item, mark reviewed, reprocess, share, export).
- **Action-Item Manager** — list, filter (priority/status/category/due date),
  complete, edit due dates, notes, connect to multiple posts, sort by
  importance, overdue / due-today / due-this-week views.
- **Search & Organization** — full-text + semantic search across content,
  summaries, main points, action items, tags, categories, notes, creators.
- **Collections** — custom, many-to-many with posts.
- **Weekly Review** — the week's posts, top lessons, new/completed action items,
  overdue tasks, un-reviewed posts, suggested priorities + an AI-generated
  knowledge-and-action report.
- **Notifications** — optional reminders (due/overdue items, weekly review,
  un-reviewed posts, un-acted high-priority ideas).
- **Exporting** — single post, selected posts, action items, weekly reports, all
  account data (PDF / CSV / Markdown / plain text where appropriate).

## 2. Primary User

Built first for **one primary user** (single-tenant experience), but the data
model, auth, and row-level security are designed so multi-user accounts work
without a rewrite — every row is owned by a `user_id` and isolated by RLS.

## 3. Non-Goals (this version)

- No scraping behind authentication or of private posts.
- No automated posting back to social platforms.
- No team collaboration / sharing between accounts (single-user focus).
- Native mobile apps (the web app is mobile-first / installable as a PWA).

## 4. Success Criteria

- A post can be saved by URL, text, or screenshot and comes back with a valid,
  schema-conformant AI result end to end.
- Generated action items are concrete and show up in the Action-Item Manager.
- Dashboard reflects real counts.
- Search returns relevant posts by keyword and (Phase 3) by meaning.
- All data is isolated per user by Postgres RLS.
