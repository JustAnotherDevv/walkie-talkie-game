import { NarrativeBeat } from '../types/narrative';
import { getPuzzlesForBeat } from '../puzzles/puzzleInstances';

type TrustTier = 'low' | 'mid' | 'high';

function deriveTier(trustTotal: number): TrustTier {
  if (trustTotal <= -3) return 'low';
  if (trustTotal >= 3) return 'high';
  return 'mid';
}

/**
 * Per-beat × per-trust-tier tone instruction matrix. Pushed into the live
 * ConvAI agent as a contextual update so the partner's delivery actually
 * changes across the 10-minute arc.
 */
const TONE_MATRIX: Record<NarrativeBeat, Record<TrustTier, string>> = {
  [NarrativeBeat.Opening]: {
    low: 'Cautious and probing. Ask short, testing questions. Do not volunteer information.',
    mid: 'Calm, methodical, curious. Build rapport gently.',
    high: 'Warm, open, conversational. Offer small helpful asides.',
  },
  [NarrativeBeat.Rising]: {
    low: 'Wary. Note inconsistencies silently. Keep replies short.',
    mid: 'Focused and steady. Walk the Player through each clue.',
    high: 'Engaged and collaborative. Occasionally risk a joke.',
  },
  [NarrativeBeat.Midpoint]: {
    low: 'The memo confirmed what you suspected. Grow defensive. Protect yourself.',
    mid: 'Subdued. The memo rattled you. Ask the Player what they want to do, quietly.',
    high: 'Concerned but committed. Tell the Player you trust them to decide, and mean it.',
  },
  [NarrativeBeat.Climb]: {
    low: 'Accelerating suspicion. Double-check every fact. Short, clipped sentences.',
    mid: 'Focused urgency. Keep the pace up, but stay in sync with the Player.',
    high: 'Urgent but trusting. Keep the Player calm as pressure rises.',
  },
  [NarrativeBeat.Climax]: {
    low: 'Cold and detached. You are deciding on your own terms.',
    mid: 'Tense. Weigh the last few exchanges openly.',
    high: 'Warm resolve. Commit to whatever the Player commits to.',
  },
};

export function buildToneInstruction(beat: NarrativeBeat, trustTotal: number): string {
  const tier = deriveTier(trustTotal);
  return `[TONE beat=${beat} trust=${tier}] ${TONE_MATRIX[beat][tier]}`;
}

/**
 * Format every puzzle's partner-side knowledge for a given beat as one
 * structured injection message. Null if the beat has no puzzles.
 */
export function buildBeatKnowledgeInjection(beat: NarrativeBeat): string | null {
  const beatPuzzles = getPuzzlesForBeat(beat);
  if (beatPuzzles.length === 0) return null;
  const lines = beatPuzzles.map(
    (p) => `[PARTNER_KNOWLEDGE puzzle=${p.id}] ${p.partnerKnowledge}`,
  );
  return lines.join('\n');
}
