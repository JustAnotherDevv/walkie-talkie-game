// Feature: ai-escape-room, Property 15: Both choices collected before reveal
// Validates: Requirements 8.3, 8.5
// The ending screen is never displayed until both the player's choice and the
// partner's choice have been received.

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { FinalChoice } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';

function resetStore() {
  useGameStateStore.getState().resetGame();
}

const realChoiceArb = fc.constantFrom(FinalChoice.Cooperate, FinalChoice.Defect);

describe('Property 15: Both choices collected before reveal', () => {
  beforeEach(resetStore);

  it('resolveEnding is a no-op while either side is Pending', () => {
    fc.assert(
      fc.property(
        fc.oneof(realChoiceArb, fc.constant(FinalChoice.Pending)),
        fc.oneof(realChoiceArb, fc.constant(FinalChoice.Pending)),
        (player, partner) => {
          resetStore();
          const store = useGameStateStore.getState();
          store.setPlayerFinalChoice(player);
          store.setPartnerFinalChoice(partner);
          store.resolveEnding();

          const post = useGameStateStore.getState();
          const bothDecided =
            player !== FinalChoice.Pending && partner !== FinalChoice.Pending;

          if (bothDecided) {
            expect(post.gameEnded).toBe(true);
            expect(post.endingType).not.toBeNull();
          } else {
            expect(post.gameEnded).toBe(false);
            expect(post.endingType).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('onGameEnded does not fire until both choices are decided', () => {
    fc.assert(
      fc.property(
        fc.oneof(realChoiceArb, fc.constant(FinalChoice.Pending)),
        fc.oneof(realChoiceArb, fc.constant(FinalChoice.Pending)),
        (player, partner) => {
          resetStore();
          const store = useGameStateStore.getState();
          const seen: unknown[] = [];
          const unsub = store.subscribeToGameEnd((e) => seen.push(e));

          store.setPlayerFinalChoice(player);
          store.setPartnerFinalChoice(partner);
          store.resolveEnding();

          const bothDecided =
            player !== FinalChoice.Pending && partner !== FinalChoice.Pending;
          expect(seen.length).toBe(bothDecided ? 1 : 0);
          unsub();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('whenever endingType is set, both choice fields are non-Pending', () => {
    fc.assert(
      fc.property(
        fc.oneof(realChoiceArb, fc.constant(FinalChoice.Pending)),
        fc.oneof(realChoiceArb, fc.constant(FinalChoice.Pending)),
        (player, partner) => {
          resetStore();
          const store = useGameStateStore.getState();
          store.setPlayerFinalChoice(player);
          store.setPartnerFinalChoice(partner);
          store.resolveEnding();

          const post = useGameStateStore.getState();
          if (post.endingType !== null) {
            expect(post.playerFinalChoice).not.toBe(FinalChoice.Pending);
            expect(post.partnerFinalChoice).not.toBe(FinalChoice.Pending);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sequential choice entry only reveals after the second choice lands', () => {
    resetStore();
    const store = useGameStateStore.getState();

    const seen: string[] = [];
    const unsub = store.subscribeToGameEnd((e) => seen.push(e));

    // Player picks first — nothing should resolve yet
    store.setPlayerFinalChoice(FinalChoice.Cooperate);
    store.resolveEnding();
    expect(seen.length).toBe(0);
    expect(useGameStateStore.getState().gameEnded).toBe(false);

    // Partner lands after — ending resolves exactly once
    store.setPartnerFinalChoice(FinalChoice.Defect);
    store.resolveEnding();
    expect(seen.length).toBe(1);
    expect(useGameStateStore.getState().gameEnded).toBe(true);
    unsub();
  });
});
