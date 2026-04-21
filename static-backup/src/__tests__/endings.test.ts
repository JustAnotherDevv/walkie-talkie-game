// Task 16.5: ending content tests
// Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EndingType } from '../types';
import {
  ENDING_SPECS,
  runEnding,
  EndingEffects,
} from '../services/endingOrchestrator';

function makeSpies(): EndingEffects & {
  calls: {
    playTTSLine: string[];
    playEndingSting: EndingType[];
    setLighting: ('normal' | 'dim' | 'cut')[];
    setAllRoomsUnlocked: boolean[];
    sealAllRooms: number;
    setDoorsSealedAfterEnding: boolean[];
    setIntercomFilter: ('clear' | 'radio' | 'corporate')[];
  };
} {
  const calls = {
    playTTSLine: [] as string[],
    playEndingSting: [] as EndingType[],
    setLighting: [] as ('normal' | 'dim' | 'cut')[],
    setAllRoomsUnlocked: [] as boolean[],
    sealAllRooms: 0,
    setDoorsSealedAfterEnding: [] as boolean[],
    setIntercomFilter: [] as ('clear' | 'radio' | 'corporate')[],
  };
  return {
    playTTSLine: async (key: string) => {
      calls.playTTSLine.push(key);
    },
    playEndingSting: async (t: EndingType) => {
      calls.playEndingSting.push(t);
    },
    setLighting: (m) => {
      calls.setLighting.push(m);
    },
    setAllRoomsUnlocked: (u) => {
      calls.setAllRoomsUnlocked.push(u);
    },
    sealAllRooms: () => {
      calls.sealAllRooms++;
    },
    setDoorsSealedAfterEnding: (s) => {
      calls.setDoorsSealedAfterEnding.push(s);
    },
    setIntercomFilter: (f) => {
      calls.setIntercomFilter.push(f);
    },
    calls,
  };
}

describe('ENDING_SPECS declarative mapping', () => {
  it('has a distinct TTS line key per ending (Req 9.6)', () => {
    const keys = Object.values(ENDING_SPECS).map((s) => s.ttsLineKey);
    expect(new Set(keys).size).toBe(4);
  });

  it('Release opens doors and keeps light normal (Req 9.2, 9.7)', () => {
    expect(ENDING_SPECS[EndingType.Release].doors).toBe('all-open');
    expect(ENDING_SPECS[EndingType.Release].lighting).toBe('normal');
    expect(ENDING_SPECS[EndingType.Release].intercomFilter).toBe('clear');
  });

  it('LeftBehind keeps door state and dims lights (Req 9.3)', () => {
    expect(ENDING_SPECS[EndingType.LeftBehind].doors).toBe('keep');
    expect(ENDING_SPECS[EndingType.LeftBehind].lighting).toBe('dim');
    expect(ENDING_SPECS[EndingType.LeftBehind].intercomFilter).toBe('corporate');
  });

  it('Alone opens doors and keeps light normal (Req 9.4)', () => {
    expect(ENDING_SPECS[EndingType.Alone].doors).toBe('all-open');
    expect(ENDING_SPECS[EndingType.Alone].lighting).toBe('normal');
  });

  it('Reset seals doors and cuts lights (Req 9.5)', () => {
    expect(ENDING_SPECS[EndingType.Reset].doors).toBe('all-sealed');
    expect(ENDING_SPECS[EndingType.Reset].lighting).toBe('cut');
  });
});

describe('runEnding per-ending effects', () => {
  let spies: ReturnType<typeof makeSpies>;

  beforeEach(() => {
    spies = makeSpies();
  });

  it('Release plays ending_release, opens all rooms, keeps lights normal', async () => {
    await runEnding(EndingType.Release, spies);
    expect(spies.calls.playTTSLine).toEqual(['ending_release']);
    expect(spies.calls.playEndingSting).toEqual([EndingType.Release]);
    expect(spies.calls.setLighting).toEqual(['normal']);
    expect(spies.calls.setAllRoomsUnlocked).toEqual([true]);
    expect(spies.calls.sealAllRooms).toBe(0);
    expect(spies.calls.setDoorsSealedAfterEnding).toEqual([false]);
    expect(spies.calls.setIntercomFilter).toEqual(['clear']);
  });

  it('LeftBehind plays ending_left_behind, dims lights, keeps door state', async () => {
    await runEnding(EndingType.LeftBehind, spies);
    expect(spies.calls.playTTSLine).toEqual(['ending_left_behind']);
    expect(spies.calls.playEndingSting).toEqual([EndingType.LeftBehind]);
    expect(spies.calls.setLighting).toEqual(['dim']);
    // 'keep' means neither open nor sealed ops should run
    expect(spies.calls.setAllRoomsUnlocked).toEqual([]);
    expect(spies.calls.sealAllRooms).toBe(0);
    expect(spies.calls.setDoorsSealedAfterEnding).toEqual([false]);
    expect(spies.calls.setIntercomFilter).toEqual(['corporate']);
  });

  it('Alone plays ending_alone, opens doors, keeps lights normal', async () => {
    await runEnding(EndingType.Alone, spies);
    expect(spies.calls.playTTSLine).toEqual(['ending_alone']);
    expect(spies.calls.playEndingSting).toEqual([EndingType.Alone]);
    expect(spies.calls.setLighting).toEqual(['normal']);
    expect(spies.calls.setAllRoomsUnlocked).toEqual([true]);
    expect(spies.calls.sealAllRooms).toBe(0);
  });

  it('Reset plays ending_reset, seals all rooms, cuts lights', async () => {
    await runEnding(EndingType.Reset, spies);
    expect(spies.calls.playTTSLine).toEqual(['ending_reset']);
    expect(spies.calls.playEndingSting).toEqual([EndingType.Reset]);
    expect(spies.calls.setLighting).toEqual(['cut']);
    expect(spies.calls.sealAllRooms).toBe(1);
    expect(spies.calls.setAllRoomsUnlocked).toEqual([]);
    expect(spies.calls.setDoorsSealedAfterEnding).toEqual([true]);
  });

  it('ending sting plays before the narration line', async () => {
    const order: string[] = [];
    const orderingSpies: EndingEffects = {
      playEndingSting: async (t) => {
        order.push(`sting:${t}`);
      },
      playTTSLine: async (k) => {
        order.push(`tts:${k}`);
      },
      setLighting: () => {},
      setAllRoomsUnlocked: () => {},
      sealAllRooms: () => {},
      setDoorsSealedAfterEnding: () => {},
    };
    await runEnding(EndingType.Release, orderingSpies);
    expect(order).toEqual([`sting:${EndingType.Release}`, 'tts:ending_release']);
  });

  it('gracefully works when setIntercomFilter is not provided', async () => {
    const minimalSpies: EndingEffects = {
      playTTSLine: vi.fn(),
      playEndingSting: vi.fn(),
      setLighting: vi.fn(),
      setAllRoomsUnlocked: vi.fn(),
      sealAllRooms: vi.fn(),
      setDoorsSealedAfterEnding: vi.fn(),
    };
    await expect(runEnding(EndingType.Release, minimalSpies)).resolves.toBeUndefined();
  });
});
