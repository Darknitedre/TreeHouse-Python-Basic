import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { PlaybackEngine } from '../types';

let player: AudioPlayer | null = null;
let subscription: { remove: () => void } | null = null;

function release() {
  subscription?.remove();
  subscription = null;
  if (player) {
    player.pause();
    player.remove();
    player = null;
  }
}

/** Plays recorded audio files (MP3 etc.) for sections that have an `audio` field. */
export const mp3Engine: PlaybackEngine = {
  play(segment, { rate, onDone, onError }) {
    release();
    if (segment.source == null) {
      onError(new Error('No audio source'));
      return;
    }
    try {
      const p = createAudioPlayer(segment.source);
      player = p;
      p.setPlaybackRate(rate);
      subscription = p.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish && player === p) {
          release();
          onDone();
        }
      });
      p.play();
    } catch (e) {
      release();
      onError(e);
    }
  },
  pause() {
    player?.pause();
    return true;
  },
  resume() {
    player?.play();
  },
  stop() {
    release();
  },
  setRate(rate) {
    player?.setPlaybackRate(rate);
    return true;
  },
};
