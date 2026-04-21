import type { AudioAssetManifest } from '../types/audio';
import { SFXKey } from '../types/audio';
import { NarrativeBeat } from '../types/narrative';
import { EndingType } from '../types/endings';

/**
 * Mock-path ElevenLabs service. Round 5 only covers pre-generated audio
 * (TTS narration, SFX clips, music per beat, ending stings) — live
 * ConvAI dialogue returns later in Round 6.
 */
export class ElevenLabsService {
  private manifest: AudioAssetManifest | null = null;
  private cache = new Map<string, Blob>();

  async loadManifest(url: string = '/audio/manifest.json'): Promise<AudioAssetManifest> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
    const raw = await res.json();

    this.manifest = {
      partnerVoiceId: raw.partnerVoiceId ?? 'placeholder',
      ttsLines: new Map<string, string>(
        Object.entries(raw.ttsLines ?? {}) as [string, string][],
      ),
      sfxClips: new Map<SFXKey, string>(
        Object.entries(raw.sfxClips ?? {}) as [SFXKey, string][],
      ),
      musicTracks: new Map<NarrativeBeat, string>(
        Object.entries(raw.musicTracks ?? {}) as [NarrativeBeat, string][],
      ),
      endingStings: new Map<EndingType, string>(
        Object.entries(raw.endingStings ?? {}) as [EndingType, string][],
      ),
    };

    return this.manifest;
  }

  isReady(): boolean {
    return this.manifest !== null;
  }

  private async fetchAndCache(cacheKey: string, url: string | undefined): Promise<Blob | null> {
    if (!url) return null;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[audio] fetch failed for ${url}: ${res.status}`);
        return null;
      }
      const blob = await res.blob();
      this.cache.set(cacheKey, blob);
      return blob;
    } catch (err) {
      console.warn(`[audio] fetch error for ${url}:`, err);
      return null;
    }
  }

  async getTTSLine(key: string): Promise<Blob | null> {
    return this.fetchAndCache(`tts:${key}`, this.manifest?.ttsLines.get(key));
  }

  async getSFX(key: SFXKey): Promise<Blob | null> {
    return this.fetchAndCache(`sfx:${key}`, this.manifest?.sfxClips.get(key));
  }

  async getMusicTrack(beat: NarrativeBeat): Promise<Blob | null> {
    return this.fetchAndCache(`music:${beat}`, this.manifest?.musicTracks.get(beat));
  }

  async getEndingSting(ending: EndingType): Promise<Blob | null> {
    return this.fetchAndCache(`sting:${ending}`, this.manifest?.endingStings.get(ending));
  }
}

let singleton: ElevenLabsService | null = null;

export function getElevenLabsService(): ElevenLabsService {
  if (!singleton) singleton = new ElevenLabsService();
  return singleton;
}

export function resetElevenLabsService(): void {
  singleton = null;
}
