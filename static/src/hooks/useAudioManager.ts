import { useCallback, useEffect, useRef, useState } from 'react';
import { NarrativeBeat } from '../types/narrative';
import { SFXKey } from '../types/audio';
import { getElevenLabsService } from '../services/ElevenLabsService';

/**
 * Music volume + enabled state per narrative beat. The score starts near-
 * silent and escalates into the Climax. Matches the spec's audio
 * atmosphere requirements.
 */
const BEAT_MUSIC: Record<
  NarrativeBeat,
  { enabled: boolean; volume: number }
> = {
  [NarrativeBeat.Opening]: { enabled: false, volume: 0 },
  [NarrativeBeat.Rising]: { enabled: false, volume: 0 },
  [NarrativeBeat.Midpoint]: { enabled: true, volume: 0.2 },
  [NarrativeBeat.Climb]: { enabled: true, volume: 0.5 },
  [NarrativeBeat.Climax]: { enabled: true, volume: 1.0 },
};

export interface AudioManager {
  isReady: boolean;
  initialize: () => Promise<void>;
  playSFX: (key: SFXKey) => Promise<void>;
  playTTSLine: (key: string) => Promise<void>;
  setMusicBeat: (beat: NarrativeBeat) => Promise<void>;
  stopMusic: () => void;
}

/**
 * Centralised HTMLAudioElement management. Keeps three channels (SFX,
 * music, narration) so a music track doesn't get preempted by a one-shot
 * click. Call `initialize()` inside a user-gesture handler (button click)
 * before playing anything — browsers block autoplay otherwise.
 */
export function useAudioManager(): AudioManager {
  const service = getElevenLabsService();
  const [isReady, setIsReady] = useState(false);

  const sfxRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const objectUrls = useRef<string[]>([]);

  // Cleanup object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      for (const u of objectUrls.current) URL.revokeObjectURL(u);
      objectUrls.current = [];
    };
  }, []);

  const ensureElements = useCallback(() => {
    if (!sfxRef.current) sfxRef.current = new Audio();
    if (!musicRef.current) {
      const m = new Audio();
      m.loop = true;
      m.volume = 0;
      musicRef.current = m;
    }
    if (!narrationRef.current) narrationRef.current = new Audio();
  }, []);

  const initialize = useCallback(async () => {
    ensureElements();
    try {
      await service.loadManifest();
      setIsReady(true);
    } catch (err) {
      console.warn('[audio] manifest load failed:', err);
      setIsReady(false);
    }
  }, [ensureElements, service]);

  const playBlob = useCallback(
    async (el: HTMLAudioElement, blob: Blob | null) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      objectUrls.current.push(url);
      try {
        el.src = url;
        el.currentTime = 0;
        await el.play();
      } catch (err) {
        // Autoplay failures surface here. Swallow so one bad clip doesn't
        // break the UI loop.
        console.warn('[audio] play failed:', err);
      }
    },
    [],
  );

  const playSFX = useCallback(
    async (key: SFXKey) => {
      if (!service.isReady()) return;
      ensureElements();
      const blob = await service.getSFX(key);
      if (sfxRef.current) await playBlob(sfxRef.current, blob);
    },
    [service, ensureElements, playBlob],
  );

  const playTTSLine = useCallback(
    async (key: string) => {
      if (!service.isReady()) return;
      ensureElements();
      const blob = await service.getTTSLine(key);
      if (narrationRef.current) await playBlob(narrationRef.current, blob);
    },
    [service, ensureElements, playBlob],
  );

  const setMusicBeat = useCallback(
    async (beat: NarrativeBeat) => {
      if (!service.isReady()) return;
      ensureElements();
      const cfg = BEAT_MUSIC[beat];
      if (!musicRef.current) return;
      if (!cfg.enabled) {
        musicRef.current.pause();
        musicRef.current.volume = 0;
        return;
      }
      const blob = await service.getMusicTrack(beat);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      objectUrls.current.push(url);
      musicRef.current.src = url;
      musicRef.current.volume = cfg.volume;
      try {
        await musicRef.current.play();
      } catch (err) {
        console.warn('[audio] music play failed:', err);
      }
    },
    [service, ensureElements],
  );

  const stopMusic = useCallback(() => {
    musicRef.current?.pause();
  }, []);

  return { isReady, initialize, playSFX, playTTSLine, setMusicBeat, stopMusic };
}
