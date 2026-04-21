import type { SFXKey } from './sfx';
import type { NarrativeBeat } from './narrative';
import type { EndingType } from './endings';

// Audio asset manifest - pre-generated audio assets catalog
// Validates: Requirements 10.3, 10.4, 10.5
export interface AudioAssetManifest {
  partnerVoiceId: string
  ttsLines: Map<string, string>     // key → URL to audio file
  sfxClips: Map<SFXKey, string>     // key → URL
  musicTracks: Map<NarrativeBeat, string>
  endingStings: Map<EndingType, string>
}
