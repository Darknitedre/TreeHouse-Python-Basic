import { resolveAudio } from './localAudio';
import { PlayerSection, Segment } from './types';

/** Average speaking speed used for time estimates, in words per minute at 1x. */
export const WORDS_PER_MINUTE = 160;

export interface TextSegment extends Segment {
  /** True if this sentence ends a paragraph (used when drawing the text). */
  paragraphEnd: boolean;
  /** Paragraph number inside its section. */
  paragraph: number;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Splits a paragraph into sentences, keeping closing quotes with their sentence. */
export function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  let start = 0;
  const closers = '"”’)\']';
  for (let i = 0; i < paragraph.length; i++) {
    const ch = paragraph[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    let end = i + 1;
    while (end < paragraph.length && closers.includes(paragraph[end])) end++;
    if (end < paragraph.length && /\s/.test(paragraph[end])) {
      out.push(paragraph.slice(start, end).trim());
      start = end;
      i = end;
    }
  }
  const rest = paragraph.slice(start).trim();
  if (rest) out.push(rest);

  // Join very short pieces to the previous sentence so speech flows naturally.
  const merged: string[] = [];
  for (const s of out) {
    if (merged.length && s.length < 25) merged[merged.length - 1] += ' ' + s;
    else merged.push(s);
  }
  // A very short first sentence ("Welcome.") joins the next one.
  if (merged.length > 1 && merged[0].length < 25) merged.splice(0, 2, merged[0] + ' ' + merged[1]);
  return merged;
}

/** Turns sections into a flat list of playable segments. */
export function buildSegments(sections: PlayerSection[]): TextSegment[] {
  const segments: TextSegment[] = [];
  sections.forEach((section, sectionIndex) => {
    const source = resolveAudio(section.audio);
    const paragraphs = section.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (source) {
      // A recording plays the whole section as one piece.
      segments.push({
        sectionIndex,
        text: paragraphs.join('\n\n'),
        source,
        weight: countWords(section.text),
        paragraphEnd: true,
        paragraph: 0,
      });
      return;
    }
    paragraphs.forEach((p, paragraph) => {
      const sentences = splitSentences(p);
      sentences.forEach((text, i) => {
        segments.push({
          sectionIndex,
          text,
          weight: countWords(text),
          paragraphEnd: i === sentences.length - 1,
          paragraph,
        });
      });
    });
  });
  return segments;
}

/** Estimated listening time in seconds at the given speed. */
export function estimateSeconds(words: number, rate = 1): number {
  return (words / WORDS_PER_MINUTE / rate) * 60;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
