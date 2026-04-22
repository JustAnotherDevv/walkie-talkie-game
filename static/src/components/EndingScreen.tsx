import { EndingType } from '../types/endings';
import { useGameStateStore } from '../stores/gameStateStore';

interface Copy {
  title: string;
  subtitle: string;
  flavor: string;
  tone: 'release' | 'cold' | 'warm' | 'reset';
}

const COPY: Record<EndingType, Copy> = {
  [EndingType.Release]: {
    title: 'RELEASE',
    subtitle: 'Both of you cooperated.',
    flavor:
      'Both doors disengage. The partner signs off. The voice shifts — flat, professional — and says: "Deployment confirmed." The hum cuts to silence.',
    tone: 'release',
  },
  [EndingType.LeftBehind]: {
    title: 'LEFT BEHIND',
    subtitle: 'You cooperated. Your partner defected.',
    flavor:
      'Your door stays sealed. The intercom smooths into something corporate: "Subject retained. Deployment successful." The lights dim, one bank at a time.',
    tone: 'cold',
  },
  [EndingType.Alone]: {
    title: 'ALONE',
    subtitle: 'You defected. Your partner cooperated.',
    flavor:
      'The lock slides back. A single warm line on the intercom: "Go on. I mean it. I hope you remember me." Static swells, gently, over everything.',
    tone: 'warm',
  },
  [EndingType.Reset]: {
    title: 'RESET',
    subtitle: 'Both of you defected.',
    flavor:
      'Every door drops closed at once. The lights cut. A different voice — younger, careful — begins reading the opening prompt. The cycle starts again.',
    tone: 'reset',
  },
};

export function EndingScreen({ onReset }: { onReset: () => void }) {
  const gameEnded = useGameStateStore((s) => s.gameEnded);
  const endingType = useGameStateStore((s) => s.endingType);
  const playerFinalChoice = useGameStateStore((s) => s.playerFinalChoice);
  const partnerFinalChoice = useGameStateStore((s) => s.partnerFinalChoice);

  if (!gameEnded || !endingType) return null;
  const c = COPY[endingType];

  return (
    <div className={`ending-screen ending-${c.tone}`} role="dialog">
      <div className="ending-title">{c.title}</div>
      <div className="ending-subtitle">{c.subtitle}</div>
      <div className="ending-flavor">{c.flavor}</div>
      <div className="ending-meta">
        you · <strong>{playerFinalChoice}</strong> &nbsp;·&nbsp; partner ·{' '}
        <strong>{partnerFinalChoice}</strong>
      </div>
      <button className="start-btn" onClick={onReset}>
        Reset game
      </button>
    </div>
  );
}
