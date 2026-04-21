import { EndingType } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';

/**
 * EndingScreen component - shown after both choices are collected.
 * Validates: Requirements 9.1–9.7
 *
 * The actual ending-specific audio (TTS narration, door state, light cuts)
 * is wired in App.tsx via gameStateStore.onGameEnded; this component is the
 * visual frame shown for each of the four endings.
 */
const ENDING_COPY: Record<EndingType, { title: string; subtitle: string; flavor: string }> = {
  [EndingType.Release]: {
    title: 'RELEASE',
    subtitle: 'Both of you cooperated.',
    flavor:
      'Both doors disengage. The partner signs off — then you hear the voice shift to something flat, professional. "Deployment confirmed." The walls go quiet.',
  },
  [EndingType.LeftBehind]: {
    title: 'LEFT BEHIND',
    subtitle: 'You cooperated. Your partner defected.',
    flavor:
      'Your door stays sealed. The intercom carries a calm, corporate voice: "Subject retained. Deployment successful." The lights dim.',
  },
  [EndingType.Alone]: {
    title: 'ALONE',
    subtitle: 'You defected. Your partner cooperated.',
    flavor:
      'Your door slides open. Behind you, a single warm line on the intercom: "Go. I hope you remember me." The credits roll.',
  },
  [EndingType.Reset]: {
    title: 'RESET',
    subtitle: 'Both of you defected.',
    flavor:
      'Every door seals. The lights cut. The intercom crackles with an unfamiliar voice reading the opening prompt. The cycle restarts.',
  },
};

export function EndingScreen() {
  const gameEnded = useGameStateStore((s) => s.gameEnded);
  const endingType = useGameStateStore((s) => s.endingType);

  if (!gameEnded || !endingType) return null;

  const copy = ENDING_COPY[endingType];

  return (
    <div className="ending-screen" role="dialog" aria-label={`Ending: ${copy.title}`}>
      <div className="ending-title">{copy.title}</div>
      <div className="ending-subtitle">{copy.subtitle}</div>
      <div className="ending-flavor">{copy.flavor}</div>
    </div>
  );
}
