# SaveVault

Stop losing the reels, posts, and screenshots you saved and never opened again.

SaveVault is a React Native (Expo) app that lets you share anything from Instagram, TikTok,
Facebook, or the browser straight into one Pinterest-style grid — organized with folders and
tags, fully searchable, and backed by reminders that actually resurface what you forgot.

This is the **MVP** described in the product brief: share-sheet saving, folders/tags, search,
and basic reminders. AI categorization (v1 here is a keyword heuristic) and a true
background-scheduled weekly digest are scoped for v2 — see [Roadmap](#v2-roadmap) below.

## Tech stack

- **Expo (managed workflow) + React Native + TypeScript**
- **expo-sqlite** — local-first storage, including an FTS5 full-text index for search
- **expo-share-intent** — receives the OS share sheet on iOS and Android via a config plugin
  (generates the native share extension/intent filter at `expo prebuild` time — no manual
  Xcode/Android Studio native code to maintain)
- **expo-notifications** — local notifications for per-item reminders, the weekly digest nudge,
  and "Still want this?" resurfacing, with actionable notification buttons (Keep/Snooze/Delete)
- **zustand** — thin UI state layer over the SQLite repositories
- **React Navigation** — bottom tabs (Home/Search/Folders/Settings) + a root stack for
  detail/add/digest screens

## Project layout

```
App.tsx                     — app root: providers, DB init, notification listeners, share intent
src/
  db/                        — SQLite schema, migrations, and repositories (items, folders, settings)
  services/                  — platform detection, categorization, notifications, share intent,
                                "ask my saves" search, weekly/stale background checks
  store/                     — zustand store wiring the UI to the repositories
  navigation/                — React Navigation stacks/tabs and route types
  screens/                   — one file per screen
  components/                — SaveCard, Grid, TagInput, FolderPicker, ReminderSheet, etc.
  theme/                     — dark/light palettes + ThemeProvider (persisted in SQLite settings)
  types/                     — shared TypeScript types
  utils/                     — id generation, URL normalization/hashing for duplicate detection
```

## Getting started

```bash
npm install
npx expo start
```

Open in Expo Go for fast iteration on everything except the share extension (share sheets
require a native build — see below). Requires Node 18+.

### Building with the share extension

`expo-share-intent`'s config plugin needs a native project to attach to. Generate one with:

```bash
npx expo prebuild
npx expo run:ios      # or: npx expo run:android
```

(`ios/` and `android/` are intentionally gitignored — they're generated, not source of truth.
Re-run `expo prebuild` after pulling changes to `app.json`'s `plugins` config.)

For a real device/TestFlight/Play build, use [EAS Build](https://docs.expo.dev/build/introduction/)
instead of `expo run:*`.

### Permissions you'll be asked for

- **Notifications** — for reminders and the weekly digest (Settings → "Enable reminders & weekly digest")
- **Photo library** — only when manually attaching a screenshot from AddManual

## How the core features map to code

| Feature | Where |
|---|---|
| Share-sheet saving | `src/services/shareIntent.ts` + `App.tsx` (routes into `AddManualScreen` prefilled) |
| Manual screenshot upload | `AddManualScreen` via `expo-image-picker` |
| Auto-organize (category) | `src/services/categorize.ts` (v1 keyword heuristic — see roadmap) |
| Tags / folders / notes | `TagInput`, `FolderPicker`, `ItemDetailScreen` / `AddManualScreen` |
| Duplicate detection | `src/utils/url.ts` (normalizes + hashes URLs) + `itemsRepo.findByUrlHash` |
| Full-text search | SQLite FTS5 virtual table (`items_fts`) via `itemsRepo.searchItems` |
| "Ask my saves" | `src/services/askMySaves.ts` (v1 keyword extraction over FTS — see roadmap) |
| Reminders (tonight/weekend/custom) | `ReminderSheet` + `src/services/notifications.ts` |
| Weekly digest | `notifications.ensureWeeklyDigestScheduled` (standing Sunday 6pm local notification) + `DigestScreen` (computes the real top-5 client-side when opened) |
| "Still want this?" resurfacing | `itemsRepo.getStaleUnopened` + `backgroundChecks.runBackgroundChecks`, run on app foreground; Keep/Snooze/Delete are notification action buttons handled in `App.tsx` |
| Dark mode | `src/theme/` — defaults to dark, toggle in Settings, persisted locally |
| Local-first storage | Everything lives in `expo-sqlite`; no network calls anywhere in this build |

## What's a deliberate MVP simplification

- **Thumbnails**: only shown for manually-attached screenshots. Fetching real preview images
  from Instagram/TikTok/Facebook links would mean scraping their pages, which the brief
  explicitly says to avoid ("store links + user screenshots, not scraped/downloaded copyrighted
  content"). v1.1 could add oEmbed-based previews where each platform's oEmbed endpoint
  explicitly allows it.
- **Weekly digest timing**: Expo's managed workflow can't reliably fire a background task at an
  exact time (e.g. "Sunday 6pm") without a dev/prod build running `expo-background-fetch`/
  `expo-task-manager`, which only gets OS-scheduled opportunistic wake-ups anyway. The MVP
  compromises with a standing local notification at that time (a teaser) plus a real check
  every time the app is foregrounded (`runBackgroundChecks`, wired to `AppState`).
- **Category confidence**: the on-device keyword categorizer is intentionally simple and
  transparent rather than a black box, so v2's AI swap-in is a single function replacement
  (see `categorize.ts`'s doc comment).

## v2 roadmap

1. **Real AI categorization** — replace `services/categorize.ts` with a call to an LLM (title +
   note + optionally a vision description of the thumbnail) returning category, confidence, and
   a generated description that also feeds search. Same function signature, so `itemsRepo.createItem`
   doesn't change.
2. **"Ask my saves" v2** — replace `services/askMySaves.ts`'s keyword stripping with an LLM call
   that can rank/filter candidates and answer follow-ups, not just extract keywords.
3. **True background-scheduled weekly digest** — move off "checked on foreground" to
   `expo-background-fetch` + `expo-task-manager` in a standalone dev/EAS build, or a small
   server-side scheduler pushing a remote notification with the real digest content baked in
   (requires opting into cloud sync first).
4. **Optional cloud backup** — sync the SQLite data (or a subset) to a backend so saves survive
   a device loss; keep local-first as the default, cloud as opt-in, per the brief.
5. **Context-aware reminders** — e.g. "remind me of saved workout videos on gym days" needs a
   calendar/location signal; v2 could hook into `expo-calendar` or a simple day-of-week rule
   the user sets per folder/category.
6. **Real oEmbed thumbnails** where platform terms allow it, plus a "detected possible duplicate"
   review flow (currently duplicates are saved and flagged, not blocked).
