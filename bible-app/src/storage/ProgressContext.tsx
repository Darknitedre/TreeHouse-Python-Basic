import { createContext, ReactNode, useContext, useMemo } from 'react';
import { KEYS } from './storage';
import { usePersistedState } from './usePersistedState';

interface ProgressValue {
  completedStories: string[];
  isStoryComplete: (id: string) => boolean;
  toggleStoryComplete: (id: string) => void;
  resetStoryProgress: () => void;
}

const ProgressContext = createContext<ProgressValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [completedStories, setCompleted] = usePersistedState<string[]>(KEYS.completedStories, []);

  const value = useMemo<ProgressValue>(
    () => ({
      completedStories,
      isStoryComplete: (id) => completedStories.includes(id),
      toggleStoryComplete: (id) =>
        setCompleted((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
      resetStoryProgress: () => setCompleted([]),
    }),
    [completedStories, setCompleted],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}
