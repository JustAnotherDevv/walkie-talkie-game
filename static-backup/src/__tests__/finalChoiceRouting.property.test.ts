// Feature: ai-escape-room, Property 14: Final choice routing correctness
// Validates: Requirements 8.6, 9.1
// For all 4 combinations of (PlayerChoice, PartnerChoice), the game routes
// to exactly the correct EndingType per the 2x2 matrix.

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { FinalChoice, EndingType, NarrativeBeat } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';

const ROUTING: ReadonlyArray<[FinalChoice, FinalChoice, EndingType]> = [
  [FinalChoice.Cooperate, FinalChoice.Cooperate, EndingType.Release],
  [FinalChoice.Cooperate, FinalChoice.Defect, EndingType.LeftBehind],
  [FinalChoice.Defect, FinalChoice.Cooperate, EndingType.Alone],
  [FinalChoice.Defect, FinalChoice.Defect, EndingType.Reset],
];

function resetStore() {
  useGameStateStore.getState().resetGame();
}

describe('Property 14: Final choice routing correctness', () => {
  beforeEach(resetStore);

  it('each combination resolves to its assigned ending', () => {
    for (const [player, partner, expected] of ROUTING) {
      resetStore();
      const store = useGameStateStore.getState();
      store.setPlayerFinalChoice(player);
      store.setPartnerFinalChoice(partner);
      store.resolveEnding();

      const final = useGameStateStore.getState();
      expect(final.gameEnded).toBe(true);
      expect(final.endingType).toBe(expected);
    }
  });

  it('resolveEnding is pure with respect to the choice matrix under fast-check', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(FinalChoice.Cooperate, FinalChoice.Defect),
        fc.constantFrom(FinalChoice.Cooperate, FinalChoice.Defect),
        (player, partner) => {
          resetStore();
          const store = useGameStateStore.getState();
          store.setPlayerFinalChoice(player);
          store.setPartnerFinalChoice(partner);
          store.resolveEnding();

          const final = useGameStateStore.getState();
          const matrixHit = ROUTING.find(
            ([p, q]) => p === player && q === partner,
          );
          expect(matrixHit).toBeDefined();
          expect(final.endingType).toBe(matrixHit![2]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('onGameEnded event fires with the correctly routed ending type', () => {
    for (const [player, partner, expected] of ROUTING) {
      resetStore();
      const store = useGameStateStore.getState();
      const seen: EndingType[] = [];
      const unsub = store.subscribeToGameEnd((e) => seen.push(e));

      store.setPlayerFinalChoice(player);
      store.setPartnerFinalChoice(partner);
      store.resolveEnding();

      expect(seen).toEqual([expected]);
      unsub();
    }
  });

  it('routing matrix has no ambiguity across the whole outcome space', () => {
    const seenEndings = new Set<EndingType>();
    for (const [, , ending] of ROUTING) {
      seenEndings.add(ending);
    }
    // All four endings must be reachable and distinct
    expect(seenEndings.size).toBe(4);
    expect(seenEndings.has(EndingType.Release)).toBe(true);
    expect(seenEndings.has(EndingType.LeftBehind)).toBe(true);
    expect(seenEndings.has(EndingType.Alone)).toBe(true);
    expect(seenEndings.has(EndingType.Reset)).toBe(true);
  });

  it('the routing does not depend on mid-game reveal, narrative beat or puzzle count', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(FinalChoice.Cooperate, FinalChoice.Defect),
        fc.constantFrom(FinalChoice.Cooperate, FinalChoice.Defect),
        fc.boolean(),
        fc.integer({ min: 0, max: 10 }),
        fc.constantFrom(...Object.values(NarrativeBeat)),
        (player, partner, midGame, puzzleCount, _beat) => {
          resetStore();
          const store = useGameStateStore.getState();
          if (midGame) store.triggerMidGameReveal();
          for (let i = 0; i < puzzleCount; i++) {
            store.incrementSolvedPuzzles();
          }
          store.setPlayerFinalChoice(player);
          store.setPartnerFinalChoice(partner);
          store.resolveEnding();

          const matrixHit = ROUTING.find(
            ([p, q]) => p === player && q === partner,
          )!;
          expect(useGameStateStore.getState().endingType).toBe(matrixHit[2]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
