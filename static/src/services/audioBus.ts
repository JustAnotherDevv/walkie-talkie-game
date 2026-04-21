import type { SFXKey } from '../types/audio';
import type { NarrativeBeat } from '../types/narrative';

/**
 * Tiny module-level pass-through for audio calls. useAudioManager installs
 * its methods into this object on mount, and non-React code (e.g. the
 * interactable registry's onInteract closures) can fire audio without
 * needing to be in React's render tree.
 */
export const audioBus: {
  playSFX?: (key: SFXKey) => Promise<void> | void;
  playTTSLine?: (key: string) => Promise<void> | void;
  setMusicBeat?: (beat: NarrativeBeat) => Promise<void> | void;
} = {};
