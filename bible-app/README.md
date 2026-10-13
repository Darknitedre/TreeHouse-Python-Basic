# Bible Study App

An iPhone and Android app, built with Expo (React Native) and TypeScript, for studying Bible stories, daily devotionals, listening to lessons, and playing Bible trivia.
All content is stored on the phone; there is no account and no server.

Scripture quotations are from the **King James Version** (public domain).

## Run it on your phone

1. Install **Expo Go** from the App Store (iPhone) or Google Play (Android).
2. On your computer (Node.js 20 or newer):
   ```bash
   cd bible-app
   npm install
   npx expo start --tunnel
   ```
   (`--tunnel` works even if your phone and computer are on different Wi-Fi networks. If both are on the same Wi-Fi, plain `npx expo start` is faster.)
3. Scan the QR code:
   - **iPhone:** open the normal Camera app and point it at the QR code, then tap the banner.
   - **Android:** open Expo Go and tap **Scan QR code**.

When you edit a file and save it, the app reloads on your phone automatically.

## Adding content

### A new Bible story
1. Copy any file in `src/data/stories/` (for example `jonah.json`) to a new name, like `ruth.json`.
2. Change the `id` (must be unique, e.g. `"ruth"`), `title`, `testament` (`"OT"` or `"NT"`), `order`, `icon`, and the text.
3. Open `src/data/stories/index.ts` and add one line: `require('./ruth.json'),`

Each story has the following fields (see `src/types/content.ts`):

| Field | What it is |
|---|---|
| `summary` | A paragraph retelling the story |
| `scriptures` | A list of `{ "ref": "Ruth 1:16", "text": "..." }` (KJV text) |
| `characters` | A list of `{ "name": "...", "description": "..." }` |
| `lesson` | What the story teaches |
| `reviewQuestions` | 3–5 items of `{ "question": "...", "answer": "..." }` |

## Project layout
```
src/
  data/         JSON content (stories, and later devotionals, quiz questions)
  types/        Shapes of the JSON content
  theme/        Colors, light/dark mode, text size
  storage/      Things saved on the phone (settings, progress)
  navigation/   Bottom tabs and screen stacks
  components/   Reusable pieces (buttons, cards, progress bar...)
  screens/      One folder per tab
```

## Checks
```bash
npm run typecheck
```
