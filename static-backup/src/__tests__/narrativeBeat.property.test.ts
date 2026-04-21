// Feature: ai-escape-room, Property 16: Narrative beat advances monotonically
// Validates: Requirements 11.1, 11.2
// For any sequence of puzzle completion events, currentBeat only advances forward;
// never regresses; always a valid NarrativeBeat

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { NarrativeBeat } from '../types/narrative';
import { useGameStateStore } from '../stores/gameStateStore';

/**
 * Helper to reset the game state store to initial state
 */
function resetGameState() {
  const store = useGameStateStore.getState();
  store.resetGame();
}

/**
 * Helper to get the numeric index of a narrative beat
 */
function getBeatIndex(beat: NarrativeBeat): number {
  const order = [
    NarrativeBeat.Opening,
    NarrativeBeat.Rising,
    NarrativeBeat.Midpoint,
    NarrativeBeat.Climb,
    NarrativeBeat.Climax,
  ];
  return order.indexOf(beat);
}

/**
 * Helper to check if a beat is valid
 */
function isValidBeat(beat: NarrativeBeat): boolean {
  return Object.values(NarrativeBeat).includes(beat);
}

/**
 * Generator for sequences of advance operations
 * Each element represents whether to advance the beat
 */
const advanceSequenceGenerator = fc.array(fc.boolean(), { minLength: 0, maxLength: 20 });

describe('Property 16: Narrative beat advances monotonically', () => {
  beforeEach(() => {
    resetGameState();
  });

  it('should always have a valid NarrativeBeat value after any sequence of advances', () => {
    fc.assert(
      fc.property(
        advanceSequenceGenerator,
        (advanceSequence) => {
          resetGameState();
          const store = useGameStateStore.getState();

          // Apply the sequence of advances
          for (const shouldAdvance of advanceSequence) {
            if (shouldAdvance) {
              store.advanceBeat();
            }
          }

          // Property: currentBeat must always be a valid NarrativeBeat
          const currentBeat = useGameStateStore.getState().currentBeat;
          expect(isValidBeat(currentBeat)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never regress to a previous beat', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (advanceCount) => {
          resetGameState();
          const store = useGameStateStore.getState();

          // Track the maximum beat index reached
          let maxBeatIndex = 0;
          const beatHistory: NarrativeBeat[] = [];

          // Advance the beat multiple times
          for (let i = 0; i < advanceCount; i++) {
            const beforeBeat = useGameStateStore.getState().currentBeat;
            const beforeIndex = getBeatIndex(beforeBeat);

            store.advanceBeat();

            const afterBeat = useGameStateStore.getState().currentBeat;
            const afterIndex = getBeatIndex(afterBeat);

            beatHistory.push(afterBeat);

            // Property: beat index should never decrease
            expect(afterIndex).toBeGreaterThanOrEqual(beforeIndex);
            expect(afterIndex).toBeGreaterThanOrEqual(maxBeatIndex);

            maxBeatIndex = Math.max(maxBeatIndex, afterIndex);
          }

          // Final check: all beats in history should be >= the first beat
          const firstBeatIndex = getBeatIndex(NarrativeBeat.Opening);
          for (const beat of beatHistory) {
            expect(getBeatIndex(beat)).toBeGreaterThanOrEqual(firstBeatIndex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only advance forward through the beat sequence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        (advanceCount) => {
          resetGameState();
          const store = useGameStateStore.getState();

          const expectedBeats = [
            NarrativeBeat.Opening,
            NarrativeBeat.Rising,
            NarrativeBeat.Midpoint,
            NarrativeBeat.Climb,
            NarrativeBeat.Climax,
          ];

          // Advance the beat the specified number of times
          for (let i = 0; i < advanceCount; i++) {
            store.advanceBeat();
          }

          // Property: currentBeat should be at the expected position
          const currentBeat = useGameStateStore.getState().currentBeat;
          expect(currentBeat).toBe(expectedBeats[advanceCount]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should stay at Climax after reaching it regardless of further advances', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 20 }),
        (advanceCount) => {
          resetGameState();
          const store = useGameStateStore.getState();

          // Advance the beat multiple times (more than needed to reach Climax)
          for (let i = 0; i < advanceCount; i++) {
            store.advanceBeat();
          }

          // Property: currentBeat should stay at Climax
          const currentBeat = useGameStateStore.getState().currentBeat;
          expect(currentBeat).toBe(NarrativeBeat.Climax);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fire onBeatChanged event when beat advances', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        (advanceCount) => {
          resetGameState();
          const store = useGameStateStore.getState();

          const beatChanges: NarrativeBeat[] = [];

          // Subscribe to beat changes
          const unsubscribe = store.subscribeToBeatChange((beat) => {
            beatChanges.push(beat);
          });

          // Advance the beat
          for (let i = 0; i < advanceCount; i++) {
            store.advanceBeat();
          }

          unsubscribe();

          // Property: should have fired exactly advanceCount events
          expect(beatChanges.length).toBe(advanceCount);

          // Property: each event should contain a valid beat
          for (const beat of beatChanges) {
            expect(isValidBeat(beat)).toBe(true);
          }

          // Property: beats should advance monotonically in the event history
          for (let i = 1; i < beatChanges.length; i++) {
            const prevIndex = getBeatIndex(beatChanges[i - 1]);
            const currIndex = getBeatIndex(beatChanges[i]);
            expect(currIndex).toBeGreaterThan(prevIndex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not fire onBeatChanged when already at Climax and advanceBeat is called', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (extraAdvances) => {
          resetGameState();
          const store = useGameStateStore.getState();

          // Advance to Climax (4 advances needed)
          for (let i = 0; i < 4; i++) {
            store.advanceBeat();
          }

          const beatChanges: NarrativeBeat[] = [];

          // Subscribe to beat changes
          const unsubscribe = store.subscribeToBeatChange((beat) => {
            beatChanges.push(beat);
          });

          // Try to advance further
          for (let i = 0; i < extraAdvances; i++) {
            store.advanceBeat();
          }

          unsubscribe();

          // Property: no events should fire when already at Climax
          expect(beatChanges.length).toBe(0);

          // Property: beat should still be Climax
          expect(useGameStateStore.getState().currentBeat).toBe(NarrativeBeat.Climax);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain monotonic advancement across multiple reset and advance cycles', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 5 }),
        (cycles) => {
          for (const advanceCount of cycles) {
            resetGameState();
            const store = useGameStateStore.getState();

            // Verify starting at Opening
            expect(store.currentBeat).toBe(NarrativeBeat.Opening);

            // Advance the beat
            for (let i = 0; i < advanceCount; i++) {
              store.advanceBeat();
            }

            // Property: beat should be valid and at expected position
            const currentBeat = useGameStateStore.getState().currentBeat;
            expect(isValidBeat(currentBeat)).toBe(true);

            const expectedBeats = [
              NarrativeBeat.Opening,
              NarrativeBeat.Rising,
              NarrativeBeat.Midpoint,
              NarrativeBeat.Climb,
              NarrativeBeat.Climax,
            ];
            expect(currentBeat).toBe(expectedBeats[advanceCount]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly track beat progression for any sequence of puzzle completions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            advanceBeat: fc.boolean(),
            incrementPuzzle: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (actions) => {
          resetGameState();
          const store = useGameStateStore.getState();

          let previousBeatIndex = 0;

          for (const action of actions) {
            if (action.advanceBeat) {
              store.advanceBeat();
            }
            if (action.incrementPuzzle) {
              store.incrementSolvedPuzzles();
            }

            const currentBeat = useGameStateStore.getState().currentBeat;
            const currentBeatIndex = getBeatIndex(currentBeat);

            // Property: beat index should never decrease
            expect(currentBeatIndex).toBeGreaterThanOrEqual(previousBeatIndex);
            previousBeatIndex = currentBeatIndex;

            // Property: beat should always be valid
            expect(isValidBeat(currentBeat)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
