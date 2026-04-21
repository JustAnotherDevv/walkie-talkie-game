import type { PuzzleDefinition } from '../types';
import { NarrativeBeat } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';
import type { ElevenLabsService } from './ElevenLabsService';

/**
 * Format a single PuzzleDefinition as an agent-context line.
 * Exported for testing.
 */
export function formatPartnerKnowledge(def: PuzzleDefinition): string {
  return `[PARTNER_KNOWLEDGE:${def.id}] ${def.partnerKnowledge}`;
}

/**
 * Inject the partnerKnowledge for every puzzle in the given beat into the
 * ConvAI agent's context. Exported for testing.
 */
export function injectBeatKnowledge(
  service: Pick<ElevenLabsService, 'injectAgentContext'>,
  beat: NarrativeBeat,
  defs: PuzzleDefinition[],
): number {
  const toInject = defs.filter((d) => d.narrativeBeat === beat);
  for (const def of toInject) {
    service.injectAgentContext(formatPartnerKnowledge(def));
  }
  return toInject.length;
}

/**
 * Subscribe the service to beat changes so every puzzle's partnerKnowledge is
 * injected into the agent context at the moment its narrative beat begins.
 * Also injects the *current* beat's knowledge immediately so the Opening
 * beat gets wired even though subscribeToBeatChange only fires on transition.
 *
 * Validates: Requirements 3.3, 5.1
 */
export function wireBeatKnowledgeInjection(
  service: Pick<ElevenLabsService, 'injectAgentContext'>,
  getDefs: () => PuzzleDefinition[],
): () => void {
  const store = useGameStateStore.getState();
  injectBeatKnowledge(service, store.currentBeat, getDefs());
  return store.subscribeToBeatChange((beat) => {
    injectBeatKnowledge(service, beat, getDefs());
  });
}
