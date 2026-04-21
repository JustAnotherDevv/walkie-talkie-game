import type { NarrativeBeat } from './narrative';
import type { EndingType } from './endings';

export enum SFXKey {
  DoorLock = 'DoorLock',
  DoorUnlock = 'DoorUnlock',
  RadioStaticStart = 'RadioStaticStart',
  RadioStaticEnd = 'RadioStaticEnd',
  ObjectInteract = 'ObjectInteract',
  CooperateButtonClick = 'CooperateButtonClick',
  DefectButtonClick = 'DefectButtonClick',
  LockedDoorThud = 'LockedDoorThud',
  SignalLost = 'SignalLost',
  StaticBurst = 'StaticBurst',
}

export interface AudioAssetManifest {
  partnerVoiceId: string;
  ttsLines: Map<string, string>;
  sfxClips: Map<SFXKey, string>;
  musicTracks: Map<NarrativeBeat, string>;
  endingStings: Map<EndingType, string>;
}
