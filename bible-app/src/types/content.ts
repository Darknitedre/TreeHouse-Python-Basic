// Shapes of the content stored in src/data/*.json.
// To add content, copy an existing JSON file and follow these shapes.

export type Testament = 'OT' | 'NT';

export interface Scripture {
  /** e.g. "Genesis 1:1" or "John 3:16-17" */
  ref: string;
  /** King James Version text (public domain) */
  text: string;
}

export interface Character {
  name: string;
  description: string;
}

export interface ReviewQuestion {
  question: string;
  answer: string;
}

export interface Story {
  id: string;
  title: string;
  testament: Testament;
  /** Sort order inside its testament (1, 2, 3...) */
  order: number;
  /** A single emoji shown next to the title */
  icon: string;
  /** Where the story is found, e.g. "Genesis 1–2" */
  passage: string;
  summary: string;
  scriptures: Scripture[];
  characters: Character[];
  lesson: string;
  reviewQuestions: ReviewQuestion[];
}
