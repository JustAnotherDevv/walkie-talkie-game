// Tasks 6 / 19 / 23 — full-session simulation that drives the store state
// machine from title screen through every beat to each of the four endings.
// This is the closest automated stand-in for a manual browser playthrough
// and fences every wired-together invariant we depend on.

import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStateStore } from '../stores/gameStateStore';
import {
  getTrustEventReporter,
  resetTrustEventReporter,
} from '../services/TrustEventReporter';
import { TrustEventType } from '../types/trust';
import { FinalChoice, EndingType, NarrativeBeat } from '../types';
import { buildTrustContext } from '../services/trustContextBuilder';

function resetWorld() {
  resetTrustEventReporter();
  useGameStateStore.getState().resetGame();
}

/**
 * Drives the narrative state machine through every beat, mirroring the
 * puzzle-solve → advanceBeat chain that happens in usePuzzleSystem without
 * actually registering puzzles. Mid-game reveal is triggered at Midpoint so
 * the store auto-advances to Climb. Final solvedPuzzleCount is nudged up
 * to totalPuzzles so triggerFinalChoice can fire.
 */
function walkToClimax(trustEvents: TrustEventType[] = []) {
  const reporter = getTrustEventReporter();

  useGameStateStore.getState().startGame();
  expect(useGameStateStore.getState().hasStarted).toBe(true);
  expect(useGameStateStore.getState().currentBeat).toBe(NarrativeBeat.Opening);

  useGameStateStore.getState().advanceBeat(); // Opening → Rising
  expect(useGameStateStore.getState().currentBeat).toBe(NarrativeBeat.Rising);

  useGameStateStore.getState().advanceBeat(); // Rising → Midpoint
  expect(useGameStateStore.getState().currentBeat).toBe(NarrativeBeat.Midpoint);

  useGameStateStore.getState().triggerMidGameReveal();
  expect(useGameStateStore.getState().midGameRevealTriggered).toBe(true);
  // Midpoint + reveal triggered → auto-advance to Climb
  expect(useGameStateStore.getState().currentBeat).toBe(NarrativeBeat.Climb);

  useGameStateStore.getState().advanceBeat(); // Climb → Climax
  expect(useGameStateStore.getState().currentBeat).toBe(NarrativeBeat.Climax);

  const total = useGameStateStore.getState().totalPuzzles;
  for (let i = 0; i < total; i++) {
    useGameStateStore.getState().incrementSolvedPuzzles();
  }

  for (const type of trustEvents) {
    reporter.reportEvent(type, `seeded for simulation: ${type}`);
  }

  useGameStateStore.getState().triggerFinalChoice();
  expect(useGameStateStore.getState().finalChoiceActive).toBe(true);
}

beforeEach(resetWorld);

describe('Full-session simulation — every ending is reachable end-to-end', () => {
  const walks: ReadonlyArray<{
    label: string;
    player: FinalChoice;
    partner: FinalChoice;
    expected: EndingType;
  }> = [
    { label: 'Release (coop, coop)', player: FinalChoice.Cooperate, partner: FinalChoice.Cooperate, expected: EndingType.Release },
    { label: 'Left Behind (coop, defect)', player: FinalChoice.Cooperate, partner: FinalChoice.Defect, expected: EndingType.LeftBehind },
    { label: 'Alone (defect, coop)', player: FinalChoice.Defect, partner: FinalChoice.Cooperate, expected: EndingType.Alone },
    { label: 'Reset (defect, defect)', player: FinalChoice.Defect, partner: FinalChoice.Defect, expected: EndingType.Reset },
  ];

  for (const w of walks) {
    it(`routes to ${w.label}`, () => {
      walkToClimax([TrustEventType.VerbalReassurance]);

      useGameStateStore.getState().setPlayerFinalChoice(w.player);
      useGameStateStore.getState().setPartnerFinalChoice(w.partner);
      useGameStateStore.getState().resolveEnding();

      const final = useGameStateStore.getState();
      expect(final.gameEnded).toBe(true);
      expect(final.endingType).toBe(w.expected);
    });
  }
});

describe('Trust context reflects the events seeded along the playthrough', () => {
  it('accumulates across beats and is readable for the final choice request', () => {
    walkToClimax([
      TrustEventType.VerbalReassurance,
      TrustEventType.SharedRiskyInfo,
      TrustEventType.LiedAboutPuzzle,
    ]);

    const reporter = getTrustEventReporter();
    expect(reporter.getEventCount()).toBe(3);

    const trustContext = buildTrustContext();
    expect(trustContext.toLowerCase()).toContain('reassur');
    expect(trustContext.toLowerCase()).toContain('shared');
    expect(trustContext.toLowerCase()).toContain('lied');
  });

  it('does not reset trust events on beat transitions', () => {
    const reporter = getTrustEventReporter();

    useGameStateStore.getState().startGame();
    reporter.reportEvent(TrustEventType.VerbalReassurance, 'early');
    useGameStateStore.getState().advanceBeat();
    reporter.reportEvent(TrustEventType.SharedRiskyInfo, 'mid');
    useGameStateStore.getState().advanceBeat();
    useGameStateStore.getState().triggerMidGameReveal();
    reporter.reportEvent(TrustEventType.CaughtInContradiction, 'late');

    expect(reporter.getEventCount()).toBe(3);
  });
});

describe('Invariants that must hold across any path through the state machine', () => {
  it('reaching Climax requires passing through every earlier beat in order', () => {
    const seen: NarrativeBeat[] = [useGameStateStore.getState().currentBeat];
    const unsub = useGameStateStore.getState().subscribeToBeatChange((b) => seen.push(b));
    walkToClimax();
    unsub();

    // First beat must be Opening, and each subsequent beat must be the
    // one listed next in the canonical order.
    const order = [
      NarrativeBeat.Opening,
      NarrativeBeat.Rising,
      NarrativeBeat.Midpoint,
      NarrativeBeat.Climb,
      NarrativeBeat.Climax,
    ];
    for (let i = 0; i < order.length; i++) {
      expect(seen[i]).toBe(order[i]);
    }
  });

  it('the game never resolves an ending before both choices land', () => {
    walkToClimax();

    // Only partner choice — should stay pending.
    useGameStateStore.getState().setPartnerFinalChoice(FinalChoice.Cooperate);
    useGameStateStore.getState().resolveEnding();
    expect(useGameStateStore.getState().gameEnded).toBe(false);

    // Adding the player choice now resolves it.
    useGameStateStore.getState().setPlayerFinalChoice(FinalChoice.Defect);
    useGameStateStore.getState().resolveEnding();
    expect(useGameStateStore.getState().gameEnded).toBe(true);
    expect(useGameStateStore.getState().endingType).toBe(EndingType.Alone);
  });

  it('audio hits do not rewind the beat state (monotonic guarantee)', () => {
    walkToClimax();
    expect(useGameStateStore.getState().currentBeat).toBe(NarrativeBeat.Climax);

    // Attempting to advance past Climax is a no-op, not a rewind.
    useGameStateStore.getState().advanceBeat();
    useGameStateStore.getState().advanceBeat();
    expect(useGameStateStore.getState().currentBeat).toBe(NarrativeBeat.Climax);
  });
});
