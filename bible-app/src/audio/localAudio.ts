import { AudioSource } from 'expo-audio';

/**
 * Recordings bundled inside the app.
 *
 * To use your own MP3 for a section:
 *   1. Put the file in assets/audio/, e.g. assets/audio/creation-intro.mp3
 *   2. Add a line here:  'creation-intro': require('../../assets/audio/creation-intro.mp3'),
 *   3. In the lecture JSON, add  "audio": "creation-intro"  to that section.
 *
 * You can also skip this file and put a full https:// link to an MP3 in "audio".
 */
export const localAudio: Record<string, AudioSource> = {
  // 'creation-intro': require('../../assets/audio/creation-intro.mp3'),
};

export function resolveAudio(audio: string | undefined): AudioSource | undefined {
  if (!audio) return undefined;
  if (/^https?:\/\//.test(audio)) return { uri: audio };
  return localAudio[audio];
}
