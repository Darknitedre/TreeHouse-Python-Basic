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

### A new lecture (Listen tab)
1. Copy a file in `src/data/lectures/` (for example `jonah.json`) and set `"storyId"` to the story's `id`.
2. Edit the `sections`. Each section has an `id`, a `title`, and the `text` to read aloud.
   Separate paragraphs with a blank line (`\n\n` inside the JSON string).
   Write Bible references the way they should be spoken, e.g. "Genesis chapter one, verse one".
3. Add one line to `src/data/lectures/index.ts`: `require('./ruth.json'),`

About 160 words make one minute of listening at normal speed.

### Using recorded MP3s instead of the computer voice
Any section can play a recording instead of text-to-speech. Just add an `"audio"` field to that section:

- **A file inside the app:** put `my-file.mp3` in `assets/audio/`, register it in
  `src/audio/localAudio.ts` (instructions are in that file), then use `"audio": "my-file"`.
- **A file on the internet:** `"audio": "https://example.com/my-file.mp3"`.

Sections without `"audio"` keep using text-to-speech, so you can switch over one section at a time.
The on-screen text is still shown, but while a recording plays, the whole section is highlighted rather than each sentence.

The player itself is `src/audio/AudioPlayer.tsx`. Give it any list of sections and it works on any screen.

## Project layout
```
src/
  data/         JSON content: stories/, lectures/ (and later devotionals, quiz questions)
  audio/        Reusable audio player (text-to-speech + MP3 engines)
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
