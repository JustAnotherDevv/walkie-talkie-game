import { EndingType } from '../types/endings';

export type LightingMode = 'normal' | 'dim' | 'cut';
export type DoorsMode = 'all-open' | 'all-sealed' | 'keep';

export interface EndingSpec {
  ttsLineKey: string;
  lighting: LightingMode;
  doors: DoorsMode;
}

/**
 * Declarative per-ending effects. Matches the narrative design:
 * - Release:     warm resolution, doors open, lights normal
 * - LeftBehind:  cold betrayal, door stays sealed, lights dim
 * - Alone:       bittersweet, door opens so the player can leave, lights normal
 * - Reset:       cycle restart, everything sealed, lights cut
 */
export const ENDING_SPECS: Record<EndingType, EndingSpec> = {
  [EndingType.Release]: { ttsLineKey: 'ending_release', lighting: 'normal', doors: 'all-open' },
  [EndingType.LeftBehind]: { ttsLineKey: 'ending_left_behind', lighting: 'dim', doors: 'keep' },
  [EndingType.Alone]: { ttsLineKey: 'ending_alone', lighting: 'normal', doors: 'all-open' },
  [EndingType.Reset]: { ttsLineKey: 'ending_reset', lighting: 'cut', doors: 'all-sealed' },
};

export interface EndingEffects {
  playTTSLine: (key: string) => void | Promise<void>;
  playEndingSting: (type: EndingType) => void | Promise<void>;
  setLighting: (mode: LightingMode) => void;
  setDoorsMode: (mode: DoorsMode) => void;
}

/**
 * Run the full ending sequence. Await only for ordering — per-channel
 * audio continues playing after this resolves.
 */
export async function runEnding(
  ending: EndingType,
  effects: EndingEffects,
): Promise<void> {
  const spec = ENDING_SPECS[ending];
  effects.setLighting(spec.lighting);
  effects.setDoorsMode(spec.doors);
  // Sting first to cue the moment, then the narration.
  await effects.playEndingSting(ending);
  await effects.playTTSLine(spec.ttsLineKey);
}
