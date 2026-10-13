import * as Speech from 'expo-speech';
import { PlaybackEngine } from '../types';

// Each new utterance gets a number; callbacks from older (stopped) utterances are ignored.
let currentToken = 0;
let speaking = false;
let preferredVoice: string | undefined;
let voiceLookupStarted = false;

/** Use the phone's best-quality English voice if one is installed. */
function pickVoice() {
  if (voiceLookupStarted) return;
  voiceLookupStarted = true;
  Speech.getAvailableVoicesAsync()
    .then((voices) => {
      const english = voices.filter((v) => v.language?.toLowerCase().startsWith('en-us'));
      const enhanced = english.find((v) => v.quality === Speech.VoiceQuality.Enhanced);
      preferredVoice = enhanced?.identifier;
    })
    .catch(() => {});
}

function stopSpeaking() {
  currentToken++;
  if (speaking) {
    speaking = false;
    Speech.stop();
  }
}

/** Reads text aloud with the phone's built-in text-to-speech voice. */
export const ttsEngine: PlaybackEngine = {
  play(segment, { rate, onDone, onError }) {
    pickVoice();
    stopSpeaking();
    const token = currentToken;
    speaking = true;
    Speech.speak(segment.text, {
      language: 'en-US',
      voice: preferredVoice,
      rate,
      onDone: () => {
        if (token !== currentToken) return;
        speaking = false;
        onDone();
      },
      onError: (e) => {
        if (token !== currentToken) return;
        speaking = false;
        onError(e);
      },
    });
  },
  // Pausing speech isn't supported on Android, so we stop and later
  // restart the current sentence instead. That works the same everywhere.
  pause() {
    stopSpeaking();
    return false;
  },
  resume() {},
  stop() {
    stopSpeaking();
  },
  setRate() {
    return false;
  },
};
