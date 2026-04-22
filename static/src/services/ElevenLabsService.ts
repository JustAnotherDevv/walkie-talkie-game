import type { AudioAssetManifest } from '../types/audio';
import { SFXKey } from '../types/audio';
import { NarrativeBeat } from '../types/narrative';
import { EndingType } from '../types/endings';
import { FinalChoice } from '../types/choices';
import {
  ElevenLabsLiveAdapter,
  getLiveAdapter,
  resetLiveAdapter,
} from './elevenLabsLiveAdapter';

const AGENT_PLACEHOLDERS = new Set([
  '',
  'placeholder',
  'partner-voice-placeholder',
]);

/**
 * Audio + ConvAI facade. Branches on whether VITE_ELEVENLABS_AGENT_ID is a
 * real-looking agent id: live path talks to @elevenlabs/client, mock path
 * returns deterministic blobs fetched from /audio/*.
 */
export class ElevenLabsService {
  private manifest: AudioAssetManifest | null = null;
  private cache = new Map<string, Blob>();

  private readonly agentId: string;
  private readonly voiceId: string;
  private readonly liveEnabled: boolean;
  private liveAdapter: ElevenLabsLiveAdapter | null = null;

  // Resolver for the Promise returned from live getFinalChoice().
  private pendingFinalChoice: ((c: FinalChoice) => void) | null = null;

  // Callbacks bubbled up from the live adapter.
  private onPartnerSpeakingChangeCb: ((speaking: boolean) => void) | null = null;
  private onErrorCb: ((msg: string) => void) | null = null;
  private onPartnerTextCb: ((text: string) => void) | null = null;

  constructor(
    agentId: string = '',
    voiceId: string = 'partner-voice-placeholder',
  ) {
    this.agentId = agentId;
    this.voiceId = voiceId;
    this.liveEnabled = !AGENT_PLACEHOLDERS.has(agentId);
    if (this.liveEnabled) {
      this.liveAdapter = getLiveAdapter();
      this.liveAdapter.setCallbacks({
        onPartnerSpeakingChange: (s) => this.onPartnerSpeakingChangeCb?.(s),
        onError: (m) => this.onErrorCb?.(m),
        onPartnerText: (t) => this.onPartnerTextCb?.(t),
        onFinalChoiceTool: (payload) => {
          const raw = String(payload.choice).toLowerCase();
          const resolved = raw.includes('coop')
            ? FinalChoice.Cooperate
            : FinalChoice.Defect;
          const resolver = this.pendingFinalChoice;
          this.pendingFinalChoice = null;
          resolver?.(resolved);
        },
      });
    }
  }

  isLiveMode(): boolean {
    return this.liveEnabled;
  }

  setOnPartnerSpeakingChange(cb: ((speaking: boolean) => void) | null): void {
    this.onPartnerSpeakingChangeCb = cb;
  }

  setOnError(cb: ((msg: string) => void) | null): void {
    this.onErrorCb = cb;
  }

  setOnPartnerText(cb: ((text: string) => void) | null): void {
    this.onPartnerTextCb = cb;
  }

  // ── Manifest + static audio fetches (shared by both paths) ────────────

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

  private async fetchAndCache(key: string, url: string | undefined): Promise<Blob | null> {
    if (!url) return null;
    const cached = this.cache.get(key);
    if (cached) return cached;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[audio] fetch failed for ${url}: ${res.status}`);
        return null;
      }
      const blob = await res.blob();
      this.cache.set(key, blob);
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

  // ── Live ConvAI pass-through ──────────────────────────────────────────

  async startConversationSession(systemPrompt: string, initialMemory?: string): Promise<void> {
    if (!this.liveEnabled || !this.liveAdapter) return;
    await this.liveAdapter.startSession({
      agentId: this.agentId,
      systemPrompt,
      voiceId: this.voiceId,
    });
    if (initialMemory) {
      this.liveAdapter.sendContextualUpdate(`[SYSTEM] Partner knowledge: ${initialMemory}`);
    }
  }

  startMicStreaming(): void {
    this.liveAdapter?.unmuteMic();
  }

  stopMicStreaming(): void {
    this.liveAdapter?.muteMic();
  }

  /** 0..1 live mic input level. 0 in mock mode. */
  getInputLevel(): number {
    return this.liveAdapter?.getInputLevel() ?? 0;
  }

  injectAgentContext(message: string): void {
    this.liveAdapter?.sendContextualUpdate(message);
  }

  sendUserMessage(text: string): void {
    this.liveAdapter?.sendUserMessage(text);
  }

  async getFinalChoice(trustContext: string): Promise<FinalChoice> {
    if (!this.liveEnabled || !this.liveAdapter) {
      // Cue-based fallback so the mock path returns a non-Pending value.
      const ctx = trustContext.toLowerCase();
      const lowCues = ['lied', 'withheld', 'contradict', 'broke', 'distrust', 'low trust'];
      const highCues = ['shared', 'reassur', 'promise', 'high trust', 'cooperative'];
      const low = lowCues.reduce((a, c) => a + (ctx.includes(c) ? 1 : 0), 0);
      const high = highCues.reduce((a, c) => a + (ctx.includes(c) ? 1 : 0), 0);
      if (low > high) return FinalChoice.Defect;
      if (high > low) return FinalChoice.Cooperate;
      return FinalChoice.Cooperate;
    }

    this.liveAdapter.sendContextualUpdate(`[FINAL_CHOICE_REQUEST] ${trustContext}`);
    this.liveAdapter.sendUserMessage(
      'Make your final choice now. Call the finalChoice client tool with {"choice": "Cooperate"} or {"choice": "Defect"}.',
    );

    const livePromise = new Promise<FinalChoice>((resolve) => {
      this.pendingFinalChoice = resolve;
    });
    const timeoutPromise = new Promise<FinalChoice>((resolve) => {
      setTimeout(() => {
        if (!this.pendingFinalChoice) return;
        this.pendingFinalChoice = null;
        resolve(FinalChoice.Cooperate);
      }, 30_000);
    });
    return Promise.race([livePromise, timeoutPromise]);
  }

  async endSession(): Promise<void> {
    if (this.liveAdapter) await this.liveAdapter.endSession();
  }
}

let singleton: ElevenLabsService | null = null;

export function getElevenLabsService(): ElevenLabsService {
  if (!singleton) {
    const agentId = (import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined) ?? '';
    const voiceId =
      (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) ??
      'partner-voice-placeholder';
    singleton = new ElevenLabsService(agentId, voiceId);
  }
  return singleton;
}

export function resetElevenLabsService(): void {
  singleton = null;
  resetLiveAdapter();
}
