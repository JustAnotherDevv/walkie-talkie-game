import { NarrativeBeat } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';
import type { ElevenLabsService } from './ElevenLabsService';

/**
 * Trust tier derived from the cumulative trust impact. Thresholds match
 * TRUST_SCORE_INSTRUCTIONS in agentConfig.ts.
 * Validates: Requirement 6.8
 */
export type TrustTier = 'low' | 'mid' | 'high';

export function deriveTrustTier(trustTotal: number): TrustTier {
  if (trustTotal <= -3) return 'low';
  if (trustTotal >= 3) return 'high';
  return 'mid';
}

/**
 * Per-beat × per-trust-tier tone instruction matrix.
 * Validates: Requirement 6.8 (wariness at low trust, escalating urgency
 * at Climb/Climax).
 */
const TONE_MATRIX: Record<NarrativeBeat, Record<TrustTier, string>> = {
  [NarrativeBeat.Opening]: {
    low:
      'Cautious and probing. Ask short, testing questions. Do not volunteer information.',
    mid: 'Calm, methodical, curious. Build rapport gently.',
    high: 'Warm, open, conversational. Offer small helpful asides.',
  },
  [NarrativeBeat.Rising]: {
    low: 'Wary. Note inconsistencies silently. Keep replies short.',
    mid: 'Focused and steady. Walk the Player through each clue.',
    high: 'Engaged and collaborative. Occasionally risk a joke.',
  },
  [NarrativeBeat.Midpoint]: {
    low:
      'The memo confirmed what you suspected. Grow defensive. Protect yourself.',
    mid:
      'Subdued. The memo rattled you. Ask the Player what they want to do, quietly.',
    high:
      'Concerned but committed. Tell the Player you trust them to decide, and mean it.',
  },
  [NarrativeBeat.Climb]: {
    low:
      'Accelerating suspicion. Double-check every fact. Short, clipped sentences.',
    mid: 'Focused urgency. Keep the pace up, but stay in sync with the Player.',
    high: 'Urgent but trusting. Keep the Player calm as pressure rises.',
  },
  [NarrativeBeat.Climax]: {
    low: 'Cold and detached. You are deciding on your own terms.',
    mid: 'Tense. Weigh the last few exchanges openly.',
    high: 'Warm resolve. Commit to whatever the Player commits to.',
  },
};

/**
 * Format the tone instruction that will be injected into ConvAI when beat
 * transitions happen or when trust moves the Partner's tier.
 */
export function deriveToneInstruction(
  beat: NarrativeBeat,
  trustTotal: number,
): string {
  const tier = deriveTrustTier(trustTotal);
  const body = TONE_MATRIX[beat][tier];
  return `[TONE beat=${beat} trust=${tier}] ${body}`;
}

/**
 * Subscribe ConvAI context updates to beat changes. Each time a new beat
 * begins, inject a tone instruction computed from the current trust total.
 * Also injects once on wire-up so the first beat is covered.
 * Validates: Requirement 6.8
 */
export function wireBeatToneInjection(
  service: Pick<ElevenLabsService, 'injectAgentContext'>,
  getTrustTotal: () => number,
): () => void {
  const store = useGameStateStore.getState();
  service.injectAgentContext(
    deriveToneInstruction(store.currentBeat, getTrustTotal()),
  );
  return store.subscribeToBeatChange((beat) => {
    service.injectAgentContext(deriveToneInstruction(beat, getTrustTotal()));
  });
}
