import { useCallback, useEffect, useRef, useState } from 'react';
import { getElevenLabsService } from '../services/ElevenLabsService';
import { audioBus } from '../services/audioBus';
import { SFXKey } from '../types/audio';

export type PTTState = 'idle' | 'transmitting';

export interface UsePTTOptions {
  /** Gate whether PTT keys are processed at all (e.g. title screen, reveal panel). */
  enabled: boolean;
}

/**
 * Push-to-talk wiring. Hold V → unmute ConvAI mic + radio static cue.
 * Release V → mute + outro static. Mock mode is a no-op apart from the
 * visual indicator so developers can see the PTT flow without credentials.
 */
export function usePTT({ enabled }: UsePTTOptions): { state: PTTState; inputLevel: number } {
  const [state, setState] = useState<PTTState>('idle');
  const [inputLevel, setInputLevel] = useState(0);
  const levelRafRef = useRef<number | null>(null);

  // Poll the SDK's input volume while transmitting so the UI can render a
  // live mic meter. Stops on release.
  useEffect(() => {
    if (state !== 'transmitting') {
      if (levelRafRef.current !== null) {
        cancelAnimationFrame(levelRafRef.current);
        levelRafRef.current = null;
      }
      setInputLevel(0);
      return;
    }

    const tick = () => {
      const service = getElevenLabsService();
      const lvl = service.getInputLevel();
      setInputLevel(lvl);
      levelRafRef.current = requestAnimationFrame(tick);
    };
    levelRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (levelRafRef.current !== null) {
        cancelAnimationFrame(levelRafRef.current);
        levelRafRef.current = null;
      }
    };
  }, [state]);

  const startPTT = useCallback(() => {
    setState('transmitting');
    const service = getElevenLabsService();
    if (service.isLiveMode()) {
      service.startMicStreaming();
    }
    void audioBus.playSFX?.(SFXKey.RadioStaticStart);
  }, []);

  const stopPTT = useCallback(() => {
    setState('idle');
    const service = getElevenLabsService();
    if (service.isLiveMode()) {
      service.stopMicStreaming();
    }
    void audioBus.playSFX?.(SFXKey.RadioStaticEnd);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let pttActive = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyV' || pttActive || e.repeat) return;
      pttActive = true;
      startPTT();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'KeyV' || !pttActive) return;
      pttActive = false;
      stopPTT();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (pttActive) stopPTT();
    };
  }, [enabled, startPTT, stopPTT]);

  return { state, inputLevel };
}
