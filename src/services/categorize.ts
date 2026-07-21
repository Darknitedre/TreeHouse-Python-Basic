import { DEFAULT_CATEGORIES } from '@/types';

/**
 * v1 keyword-based categorizer. Runs entirely on-device against title/note/tags text —
 * no network call, no AI model. It exists so the "auto-categorize" UX is real in the MVP.
 *
 * v2 plan: replace the body of this function with a call to `services/ai/categorize.ts`,
 * which will send title + note + (optionally) a vision description of the thumbnail to an
 * LLM and return a category + confidence + a short generated description for search. Keep
 * this function's signature so the swap is a one-line change in itemsRepo.createItem.
 */
const KEYWORD_MAP: Record<string, (typeof DEFAULT_CATEGORIES)[number]> = {
  recipe: 'Recipes',
  cook: 'Recipes',
  bake: 'Recipes',
  ingredient: 'Recipes',
  meal: 'Recipes',
  chicken: 'Recipes',
  workout: 'Fitness',
  gym: 'Fitness',
  fitness: 'Fitness',
  exercise: 'Fitness',
  marketing: 'Business/Marketing',
  business: 'Business/Marketing',
  startup: 'Business/Marketing',
  sales: 'Business/Marketing',
  faith: 'Faith',
  bible: 'Faith',
  church: 'Faith',
  prayer: 'Faith',
  car: 'Cars',
  engine: 'Cars',
  garage: 'Cars',
  travel: 'Travel',
  flight: 'Travel',
  vacation: 'Travel',
  trip: 'Travel',
  funny: 'Funny',
  meme: 'Funny',
  lol: 'Funny',
  comedy: 'Funny',
};

export function categorize(text: string): (typeof DEFAULT_CATEGORIES)[number] {
  const lower = text.toLowerCase();
  for (const [keyword, category] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return 'Uncategorized';
}
