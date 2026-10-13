import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mp3Engine } from './engines/mp3Engine';
import { ttsEngine } from './engines/ttsEngine';
import { buildSegments, TextSegment } from './segments';
import { PlaybackEngine, PlayerSection } from './types';

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'finished';

export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

const KEEP_AWAKE_TAG = 'audio-player';

// Only one player can make sound at a time. When a new one starts,
// the previous one is told to show itself as paused.
let activeOwner: { id: number; preempt: () => void } | null = null;
let nextOwnerId = 1;

function engineFor(segment: TextSegment): PlaybackEngine {
  return segment.source ? mp3Engine : ttsEngine;
}

function stopEngines() {
  ttsEngine.stop();
  mp3Engine.stop();
}

/**
 * Plays a list of sections one after another, using text-to-speech or
 * recordings as each section requires. Used by every "Listen" screen.
 */
export function usePlayer(sections: PlayerSection[]) {
  const segments = useMemo(() => buildSegments(sections), [sections]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [rate, setRateState] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const ownerId = useRef(nextOwnerId++).current;
  const live = useRef({ index: 0, status: 'idle' as PlayerStatus, rate: 1, resumable: false });

  const update = useCallback((patch: Partial<typeof live.current>) => {
    Object.assign(live.current, patch);
    if (patch.index !== undefined) setIndex(patch.index);
    if (patch.status !== undefined) setStatus(patch.status);
  }, []);

  const releaseOwnership = useCallback(() => {
    if (activeOwner?.id === ownerId) activeOwner = null;
  }, [ownerId]);

  const startAt = useCallback(
    (i: number) => {
      stopEngines();
      if (i >= segments.length) {
        update({ index: Math.max(0, segments.length - 1), status: 'finished', resumable: false });
        releaseOwnership();
        return;
      }
      if (activeOwner && activeOwner.id !== ownerId) activeOwner.preempt();
      activeOwner = {
        id: ownerId,
        preempt: () => update({ status: 'paused', resumable: false }),
      };
      setError(null);
      update({ index: i, status: 'playing', resumable: false });
      const segment = segments[i];
      engineFor(segment).play(segment, {
        rate: live.current.rate,
        onDone: () => startAt(i + 1),
        onError: () => {
          setError('Sorry, this part could not be played. Tap play to try again.');
          update({ status: 'paused', resumable: false });
        },
      });
    },
    [segments, ownerId, update, releaseOwnership],
  );

  const pause = useCallback(() => {
    if (live.current.status !== 'playing') return;
    const segment = segments[live.current.index];
    const resumable = segment ? engineFor(segment).pause() : false;
    update({ status: 'paused', resumable });
  }, [segments, update]);

  const play = useCallback(() => {
    const { status: s, resumable, index: i } = live.current;
    if (s === 'playing') return;
    if (s === 'finished') return startAt(0);
    if (s === 'paused' && resumable && activeOwner?.id === ownerId) {
      engineFor(segments[i]).resume();
      update({ status: 'playing' });
      return;
    }
    startAt(i);
  }, [segments, ownerId, startAt, update]);

  const togglePlay = useCallback(() => {
    if (live.current.status === 'playing') pause();
    else play();
  }, [pause, play]);

  const firstSegmentOf = useCallback(
    (sectionIndex: number) => segments.findIndex((s) => s.sectionIndex === sectionIndex),
    [segments],
  );

  /** Jump to the start of a section. Keeps playing if it was playing. */
  const goToSection = useCallback(
    (sectionIndex: number) => {
      const target = firstSegmentOf(sectionIndex);
      if (target < 0) return;
      if (live.current.status === 'playing') startAt(target);
      else {
        stopEngines();
        update({ index: target, status: live.current.status === 'idle' ? 'idle' : 'paused', resumable: false });
      }
    },
    [firstSegmentOf, startAt, update],
  );

  const currentSection = segments[index]?.sectionIndex ?? 0;

  const nextSection = useCallback(() => {
    if (currentSection < sections.length - 1) goToSection(currentSection + 1);
  }, [currentSection, sections.length, goToSection]);

  /** Like a CD player: restart this section, or go back one if we're at its start. */
  const prevSection = useCallback(() => {
    const start = firstSegmentOf(currentSection);
    if (live.current.index > start + 1 || currentSection === 0) goToSection(currentSection);
    else goToSection(currentSection - 1);
  }, [currentSection, firstSegmentOf, goToSection]);

  const setRate = useCallback(
    (r: number) => {
      live.current.rate = r;
      setRateState(r);
      const segment = segments[live.current.index];
      if (!segment) return;
      const applied = engineFor(segment).setRate(r);
      // Speech can't change speed mid-sentence, so restart the sentence.
      if (!applied && live.current.status === 'playing') startAt(live.current.index);
    },
    [segments, startAt],
  );

  // Keep the screen on while playing so the phone doesn't lock mid-lesson.
  useEffect(() => {
    if (status === 'playing') activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    else deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, [status]);

  // Stop when the player goes away, or when the content changes.
  useEffect(() => {
    return () => {
      if (activeOwner?.id === ownerId) {
        stopEngines();
        activeOwner = null;
      }
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [ownerId, segments]);

  const totalWeight = useMemo(() => segments.reduce((sum, s) => sum + s.weight, 0), [segments]);
  const doneWeight = useMemo(
    () => segments.slice(0, index).reduce((sum, s) => sum + s.weight, 0) + (status === 'finished' ? segments[index]?.weight ?? 0 : 0),
    [segments, index, status],
  );

  return {
    segments,
    index,
    status,
    rate,
    error,
    currentSection,
    /** 0..1 */
    progress: totalWeight ? doneWeight / totalWeight : 0,
    doneWords: doneWeight,
    totalWords: totalWeight,
    play,
    pause,
    togglePlay,
    nextSection,
    prevSection,
    goToSection,
    setRate,
  };
}
