// Task 22.1 unit tests
// Validates: Requirement 6.8
// Partner tone instructions update on beat change and on trust tier.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveTrustTier,
  deriveToneInstruction,
  wireBeatToneInjection,
} from '../services/beatToneInjection';
import { NarrativeBeat } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';

beforeEach(() => {
  useGameStateStore.getState().resetGame();
});

describe('deriveTrustTier thresholds', () => {
  it.each([
    [-99, 'low'],
    [-3, 'low'],
    [-2, 'mid'],
    [0, 'mid'],
    [2, 'mid'],
    [3, 'high'],
    [99, 'high'],
  ] as const)('trustTotal=%i → %s', (trust, tier) => {
    expect(deriveTrustTier(trust)).toBe(tier);
  });
});

describe('deriveToneInstruction matrix coverage', () => {
  const beats = [
    NarrativeBeat.Opening,
    NarrativeBeat.Rising,
    NarrativeBeat.Midpoint,
    NarrativeBeat.Climb,
    NarrativeBeat.Climax,
  ];
  const trustLevels: Array<[number, string]> = [
    [-10, 'low'],
    [0, 'mid'],
    [10, 'high'],
  ];

  it('produces a distinct, tagged instruction for every beat × tier combo', () => {
    const seen = new Set<string>();
    for (const beat of beats) {
      for (const [trust, tier] of trustLevels) {
        const msg = deriveToneInstruction(beat, trust);
        expect(msg).toContain(`beat=${beat}`);
        expect(msg).toContain(`trust=${tier}`);
        expect(msg.startsWith('[TONE')).toBe(true);
        seen.add(msg);
      }
    }
    expect(seen.size).toBe(beats.length * trustLevels.length);
  });

  it('wariness only appears on low-trust tiers', () => {
    for (const beat of beats) {
      const low = deriveToneInstruction(beat, -10).toLowerCase();
      const high = deriveToneInstruction(beat, 10).toLowerCase();
      expect(
        /cautious|probing|wary|suspic|cold|defensive/.test(low),
      ).toBe(true);
      expect(
        /cautious|probing|wary|suspic|cold|defensive/.test(high),
      ).toBe(false);
    }
  });

  it('urgency language appears in Climb/Climax instructions', () => {
    for (const trust of [-10, 0, 10]) {
      const climb = deriveToneInstruction(NarrativeBeat.Climb, trust).toLowerCase();
      const climax = deriveToneInstruction(NarrativeBeat.Climax, trust).toLowerCase();
      expect(/urgen|accelerat|press|tense|cold|resolve|pace/.test(climb)).toBe(true);
      expect(/tense|resolve|cold|decid/.test(climax)).toBe(true);
    }
  });
});

describe('wireBeatToneInjection', () => {
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

  it('injects a tone instruction for the current beat on wire-up', () => {
    const { spy, injected } = makeServiceSpy();
    const unsub = wireBeatToneInjection(spy, () => 0);
    expect(injected.length).toBe(1);
    expect(injected[0]).toContain(`beat=${NarrativeBeat.Opening}`);
    expect(injected[0]).toContain('trust=mid');
    unsub();
  });

  it('injects a fresh tone instruction on every beat change', () => {
    const { spy, injected } = makeServiceSpy();
    const store = useGameStateStore.getState();
    let trust = 0;
    const unsub = wireBeatToneInjection(spy, () => trust);

    // Wire-up emits one
    expect(injected.length).toBe(1);

    store.advanceBeat(); // Opening → Rising
    expect(injected.length).toBe(2);
    expect(injected[1]).toContain(`beat=${NarrativeBeat.Rising}`);
    expect(injected[1]).toContain('trust=mid');

    trust = -5; // push trust into low
    store.advanceBeat(); // Rising → Midpoint
    expect(injected.length).toBe(3);
    expect(injected[2]).toContain(`beat=${NarrativeBeat.Midpoint}`);
    expect(injected[2]).toContain('trust=low');

    trust = 7; // push trust into high
    store.advanceBeat(); // Midpoint → Climb
    expect(injected.length).toBe(4);
    expect(injected[3]).toContain(`beat=${NarrativeBeat.Climb}`);
    expect(injected[3]).toContain('trust=high');

    unsub();
  });

  it('stops injecting after unsubscribe', () => {
    const { spy, injected } = makeServiceSpy();
    const unsub = wireBeatToneInjection(spy, () => 0);
    const initial = injected.length;
    unsub();
    useGameStateStore.getState().advanceBeat();
    expect(injected.length).toBe(initial);
  });
});
