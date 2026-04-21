// Task 18.2 unit tests
// Validates: Requirements 3.3, 5.1
// Per-puzzle partnerKnowledge is injected into the agent context at the
// start of each puzzle's narrative beat.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatPartnerKnowledge,
  injectBeatKnowledge,
  wireBeatKnowledgeInjection,
} from '../services/agentContextInjection';
import { NarrativeBeat, PuzzleArchetype } from '../types';
import type { PuzzleDefinition } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';

function makeDef(id: string, beat: NarrativeBeat, knowledge: string): PuzzleDefinition {
  return {
    id,
    archetype: PuzzleArchetype.SymbolCorrelation,
    isDefectionOpportunity: false,
    playerSideProps: [],
    partnerKnowledge: knowledge,
    correctSolution: 'hash',
    roomId: 'room_1',
    narrativeBeat: beat,
  };
}

function makeServiceSpy() {
  const injected: string[] = [];
  return {
    spy: {
      injectAgentContext(message: string) {
        injected.push(message);
      },
    },
    injected,
  };
}

beforeEach(() => {
  useGameStateStore.getState().resetGame();
});

describe('formatPartnerKnowledge', () => {
  it('tags each message with the puzzle id', () => {
    const def = makeDef('puzzle_X', NarrativeBeat.Opening, 'Hello partner');
    expect(formatPartnerKnowledge(def)).toContain('[PARTNER_KNOWLEDGE:puzzle_X]');
    expect(formatPartnerKnowledge(def)).toContain('Hello partner');
  });
});

describe('injectBeatKnowledge', () => {
  it('only injects puzzles whose narrativeBeat matches', () => {
    const { spy, injected } = makeServiceSpy();
    const defs = [
      makeDef('opening_a', NarrativeBeat.Opening, 'opening-A'),
      makeDef('rising_b', NarrativeBeat.Rising, 'rising-B'),
      makeDef('opening_c', NarrativeBeat.Opening, 'opening-C'),
    ];

    const count = injectBeatKnowledge(spy, NarrativeBeat.Opening, defs);
    expect(count).toBe(2);
    expect(injected.length).toBe(2);
    expect(injected[0]).toContain('opening_a');
    expect(injected[0]).toContain('opening-A');
    expect(injected[1]).toContain('opening_c');
  });

  it('injects nothing when the beat has no matching puzzles', () => {
    const { spy, injected } = makeServiceSpy();
    const defs = [makeDef('opening_a', NarrativeBeat.Opening, 'k')];
    const count = injectBeatKnowledge(spy, NarrativeBeat.Midpoint, defs);
    expect(count).toBe(0);
    expect(injected.length).toBe(0);
  });
});

describe('wireBeatKnowledgeInjection', () => {
  it('injects the current beat immediately on wire-up', () => {
    const { spy, injected } = makeServiceSpy();
    const defs = [
      makeDef('opening_a', NarrativeBeat.Opening, 'opening-A'),
      makeDef('rising_b', NarrativeBeat.Rising, 'rising-B'),
    ];
    const unsub = wireBeatKnowledgeInjection(spy, () => defs);
    expect(injected.length).toBe(1);
    expect(injected[0]).toContain('opening_a');
    unsub();
  });

  it('fires on every beat transition and injects that beat\'s puzzles', () => {
    const { spy, injected } = makeServiceSpy();
    const defs = [
      makeDef('opening_a', NarrativeBeat.Opening, 'opening-A'),
      makeDef('rising_b', NarrativeBeat.Rising, 'rising-B'),
      makeDef('rising_c', NarrativeBeat.Rising, 'rising-C'),
      makeDef('climb_d', NarrativeBeat.Climb, 'climb-D'),
    ];
    const store = useGameStateStore.getState();
    const unsub = wireBeatKnowledgeInjection(spy, () => defs);

    // Inject on wire-up for current beat (Opening): 1
    expect(injected.length).toBe(1);

    // Advance Opening → Rising: 2 puzzles in Rising
    store.advanceBeat();
    expect(injected.length).toBe(3);
    expect(injected.some((m) => m.includes('rising_b'))).toBe(true);
    expect(injected.some((m) => m.includes('rising_c'))).toBe(true);

    // Advance Rising → Midpoint: no puzzles in Midpoint
    store.advanceBeat();
    expect(injected.length).toBe(3);

    // Advance Midpoint → Climb: 1 puzzle in Climb
    store.advanceBeat();
    expect(injected.length).toBe(4);
    expect(injected[injected.length - 1]).toContain('climb_d');

    unsub();
  });

  it('stops injecting after unsubscribe', () => {
    const { spy, injected } = makeServiceSpy();
    const defs = [makeDef('opening_a', NarrativeBeat.Opening, 'k')];
    const store = useGameStateStore.getState();
    const unsub = wireBeatKnowledgeInjection(spy, () => defs);
    const initialCount = injected.length;
    unsub();
    store.advanceBeat();
    expect(injected.length).toBe(initialCount);
  });
});
