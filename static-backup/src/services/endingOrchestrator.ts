import { EndingType } from '../types';

/**
 * Door state that the ending wants the room system to be in.
 * - 'all-open': every door unlocked (Release / Alone — Player can leave).
 * - 'all-sealed': every door closed and locked (Reset — cycle restart).
 * - 'keep': no door transitions (LeftBehind — player door stays as-is).
 */
export type EndingDoorsMode = 'all-open' | 'all-sealed' | 'keep';

export interface EndingSpec {
  ttsLineKey: string;
  lighting: 'normal' | 'dim' | 'cut';
  doors: EndingDoorsMode;
  intercomFilter: 'clear' | 'radio' | 'corporate';
}

/**
 * Declarative mapping between each EndingType and the runtime effects it
 * produces. The spec is pure data so tests can assert on it directly.
 * Validates: Requirements 9.2–9.7
 */
export const ENDING_SPECS: Record<EndingType, EndingSpec> = {
  [EndingType.Release]: {
    ttsLineKey: 'ending_release',
    lighting: 'normal',
    doors: 'all-open',
    intercomFilter: 'clear',
  },
  [EndingType.LeftBehind]: {
    ttsLineKey: 'ending_left_behind',
    lighting: 'dim',
    doors: 'keep',
    intercomFilter: 'corporate',
  },
  [EndingType.Alone]: {
    ttsLineKey: 'ending_alone',
    lighting: 'normal',
    doors: 'all-open',
    intercomFilter: 'radio',
  },
  [EndingType.Reset]: {
    ttsLineKey: 'ending_reset',
    lighting: 'cut',
    doors: 'all-sealed',
    intercomFilter: 'radio',
  },
};

export interface EndingEffects {
  playTTSLine: (key: string) => Promise<void> | void;
  playEndingSting: (ending: EndingType) => Promise<void> | void;
  setLighting: (mode: 'normal' | 'dim' | 'cut') => void;
  setAllRoomsUnlocked: (unlocked: boolean) => void;
  sealAllRooms: () => void;
  setDoorsSealedAfterEnding: (sealed: boolean) => void;
  setIntercomFilter?: (filter: 'clear' | 'radio' | 'corporate') => void;
}

/**
 * Run the full ending sequence for a given ending.
 * Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */
export async function runEnding(
  ending: EndingType,
  effects: EndingEffects,
): Promise<void> {
  const spec = ENDING_SPECS[ending];

  effects.setLighting(spec.lighting);

  switch (spec.doors) {
    case 'all-open':
      effects.setAllRoomsUnlocked(true);
      effects.setDoorsSealedAfterEnding(false);
      break;
    case 'all-sealed':
      effects.sealAllRooms();
      effects.setDoorsSealedAfterEnding(true);
      break;
    case 'keep':
      effects.setDoorsSealedAfterEnding(false);
      break;
  }

  effects.setIntercomFilter?.(spec.intercomFilter);

  // Sting first (diegetic transition), then the narration in the partner's voice.
  await effects.playEndingSting(ending);
  await effects.playTTSLine(spec.ttsLineKey);
}
