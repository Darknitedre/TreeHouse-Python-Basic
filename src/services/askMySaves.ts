const STOP_WORDS = new Set([
  'the', 'a', 'an', 'that', 'this', 'my', 'i', 'saved', 'save', 'from', 'last', 'about',
  'find', 'show', 'me', 'was', 'is', 'to', 'of', 'in', 'on', 'for', 'week', 'month', 'ago',
]);

/**
 * v1 "Ask my saves": strips filler words from a natural-language question and runs the
 * remaining keywords through full-text search — no model call.
 *
 * v2 plan: send the question + candidate items' titles/notes/AI descriptions to an LLM and
 * let it pick/rank matches (and answer follow-ups like "which one was shorter?"). Swap the
 * body here for that call; callers (SearchScreen) don't need to change.
 */
export function extractSearchKeywords(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .join(' ');
}
