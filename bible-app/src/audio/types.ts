import { AudioSource } from 'expo-audio';

/**
 * One section of something that can be listened to (a lecture, a devotional...).
 * If `audio` is set, that recording is played; otherwise `text` is read aloud.
 */
export interface PlayerSection {
  id: string;
  title: string;
  text: string;
  /**
   * Optional recording for this section: an https:// URL to an MP3,
   * or a name registered in src/audio/localAudio.ts.
   */
  audio?: string;
}

/** The smallest piece the player plays: one sentence (speech) or one whole file (MP3). */
export interface Segment {
  sectionIndex: number;
  text: string;
  /** Present when this segment is a recording rather than text-to-speech. */
  source?: AudioSource;
  /** Relative length, used for the progress bar and time estimates. */
  weight: number;
}

export interface PlayCallbacks {
  rate: number;
  onDone: () => void;
  onError: (error: unknown) => void;
}

/**
 * A way of turning a segment into sound. Text-to-speech and MP3 playback
 * both implement this, so the player doesn't care which one it is using.
 */
export interface PlaybackEngine {
  play(segment: Segment, options: PlayCallbacks): void;
  /** Returns true if the engine can later resume from the same spot. */
  pause(): boolean;
  resume(): void;
  stop(): void;
  /** Returns true if the new speed took effect immediately. */
  setRate(rate: number): boolean;
}
