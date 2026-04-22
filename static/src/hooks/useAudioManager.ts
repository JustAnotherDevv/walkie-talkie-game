import { useCallback, useEffect, useRef, useState } from 'react';
import { NarrativeBeat } from '../types/narrative';
import { SFXKey } from '../types/audio';
import { EndingType } from '../types/endings';
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
  playEndingSting: (ending: EndingType) => Promise<void>;
  setMusicBeat: (beat: NarrativeBeat) => Promise<void>;
  stopMusic: () => void;
  startAmbientHum: () => void;
  stopAmbientHum: () => void;
  setIntercomHiss: (active: boolean) => void;
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
  const hissRef = useRef<HTMLAudioElement | null>(null);
  const objectUrls = useRef<string[]>([]);

  // Procedural ambient-hum graph. Built lazily on first start so we don't
  // create an AudioContext before the user gesture.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const humOscRef = useRef<OscillatorNode | null>(null);
  const humGainRef = useRef<GainNode | null>(null);

  // Cleanup object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      for (const u of objectUrls.current) URL.revokeObjectURL(u);
      objectUrls.current = [];
      humOscRef.current?.stop();
      humOscRef.current?.disconnect();
      humGainRef.current?.disconnect();
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
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

  // Procedural low-frequency drone. Two slightly detuned sines through a
  // soft gain ramp give a steady HVAC/intercom bed without needing a file.
  const startAmbientHum = useCallback(() => {
    if (humOscRef.current) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = audioCtxRef.current ?? new Ctx();
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') void ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 60;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 63;
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    osc.connect(mix);
    osc2.connect(mix);
    mix.connect(gain);

    osc.start();
    osc2.start();
    gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.0);

    humOscRef.current = osc;
    humGainRef.current = gain;
  }, []);

  const stopAmbientHum = useCallback(() => {
    const osc = humOscRef.current;
    const gain = humGainRef.current;
    const ctx = audioCtxRef.current;
    if (!osc || !gain || !ctx) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    setTimeout(() => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // already stopped
      }
      gain.disconnect();
      humOscRef.current = null;
      humGainRef.current = null;
    }, 600);
  }, []);

  // Intercom static hiss — looped low-volume StaticBurst blob that plays
  // while the partner is speaking, so their voice feels like it's coming
  // through a radio. Lazy-loaded on first use.
  const setIntercomHiss = useCallback(
    (active: boolean) => {
      if (!active) {
        hissRef.current?.pause();
        return;
      }
      if (!service.isReady()) return;
      const el = hissRef.current ?? new Audio();
      hissRef.current = el;
      el.loop = true;
      el.volume = 0.15;
      if (!el.src) {
        void service.getSFX(SFXKey.StaticBurst).then((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          objectUrls.current.push(url);
          el.src = url;
          el.play().catch(() => {});
        });
      } else {
        el.currentTime = 0;
        el.play().catch(() => {});
      }
    },
    [service],
  );

  const playEndingSting = useCallback(
    async (ending: EndingType) => {
      if (!service.isReady()) return;
      ensureElements();
      if (!musicRef.current) return;
      const blob = await service.getEndingSting(ending);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      objectUrls.current.push(url);
      // Ending stings take over the music channel — one-shot, full volume.
      musicRef.current.pause();
      musicRef.current.src = url;
      musicRef.current.loop = false;
      musicRef.current.volume = 1.0;
      try {
        await musicRef.current.play();
      } catch (err) {
        console.warn('[audio] ending sting failed:', err);
      }
    },
    [service, ensureElements],
  );

  return {
    isReady,
    initialize,
    playSFX,
    playTTSLine,
    playEndingSting,
    setMusicBeat,
    stopMusic,
    startAmbientHum,
    stopAmbientHum,
    setIntercomHiss,
  };
}
