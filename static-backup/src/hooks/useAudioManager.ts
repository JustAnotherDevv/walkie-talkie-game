import { useCallback, useRef, useEffect, useState } from 'react';
import { SFXKey, NarrativeBeat, EndingType } from '../types';
import { getElevenLabsService, ElevenLabsService } from '../services/ElevenLabsService';

/**
 * Audio layer configuration for each narrative beat.
 * Exported so property tests can verify the mapping (Property 17).
 * Validates: Requirements 12.3, 12.4, 12.5, 12.6
 */
export interface BeatAudioConfig {
  musicVolume: number;
  ambientVolume: number;
  musicEnabled: boolean;
}

export const BEAT_AUDIO_CONFIG: Record<NarrativeBeat, BeatAudioConfig> = {
  [NarrativeBeat.Opening]: { musicVolume: 0, ambientVolume: 0.5, musicEnabled: false },
  [NarrativeBeat.Rising]: { musicVolume: 0, ambientVolume: 0.5, musicEnabled: false },
  [NarrativeBeat.Midpoint]: { musicVolume: 0.2, ambientVolume: 0.5, musicEnabled: true },
  [NarrativeBeat.Climb]: { musicVolume: 0.5, ambientVolume: 0.5, musicEnabled: true },
  [NarrativeBeat.Climax]: { musicVolume: 1.0, ambientVolume: 0.5, musicEnabled: true },
};

/**
 * Pure helper: audio volume for a given narrative beat.
 * Validates: Requirements 12.3, 12.4, 12.5, 12.6 (Property 17).
 */
export function getMusicVolumeForBeat(beat: NarrativeBeat): number {
  return BEAT_AUDIO_CONFIG[beat].musicVolume;
}

/**
 * Pure helper: whether music is audible during the given beat.
 */
export function isMusicEnabledForBeat(beat: NarrativeBeat): boolean {
  return BEAT_AUDIO_CONFIG[beat].musicEnabled;
}

/**
 * useAudioManager hook - Manages all audio layers
 * Validates: Requirements 12.1, 12.2
 * 
 * Manages:
 * - Ambient soundscape (fluorescent hum, distant mechanical thumps)
 * - SFX playback (door, radio static, object interaction)
 * - Music tracks per narrative beat
 * - Partner voice via intercom with radio filter
 */
export function useAudioManager() {
  const elevenLabsServiceRef = useRef<ElevenLabsService>(getElevenLabsService());
  
  // Audio elements
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);
  const intercomAudioRef = useRef<HTMLAudioElement | null>(null);
  // Dedicated element for the low-volume intercom hiss loop that rides under
  // live partner speech (so it doesn't get preempted by one-shot SFX).
  const staticLoopRef = useRef<HTMLAudioElement | null>(null);
  const staticLoopBlobUrl = useRef<string | null>(null);
  
  // Audio context for radio filter
  const audioContextRef = useRef<AudioContext | null>(null);
  const intercomSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const intercomFilterRef = useRef<BiquadFilterNode | null>(null);
  
  // State
  const [currentBeat, setCurrentBeat] = useState<NarrativeBeat>(NarrativeBeat.Opening);
  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [isManifestLoaded, setIsManifestLoaded] = useState(false);

  /**
   * Initialize audio context and elements. All construction is defensive —
   * some browsers throw or suspend an AudioContext created without a user
   * gesture, and we do not want that to bring down the whole mount.
   */
  const initializeAudio = useCallback(() => {
    try {
      if (!audioContextRef.current && typeof AudioContext !== 'undefined') {
        audioContextRef.current = new AudioContext();
      }
    } catch (err) {
      console.warn('[audio] AudioContext construction failed:', err);
    }

    try {
      if (!ambientAudioRef.current) {
        ambientAudioRef.current = new Audio();
        ambientAudioRef.current.loop = true;
      }
      if (!musicAudioRef.current) {
        musicAudioRef.current = new Audio();
        musicAudioRef.current.loop = true;
      }
      if (!sfxAudioRef.current) {
        sfxAudioRef.current = new Audio();
      }
      if (!intercomAudioRef.current) {
        intercomAudioRef.current = new Audio();
      }
      if (!staticLoopRef.current) {
        staticLoopRef.current = new Audio();
        staticLoopRef.current.loop = true;
        staticLoopRef.current.volume = 0.25;
      }
    } catch (err) {
      console.warn('[audio] Audio element construction failed:', err);
    }
  }, []);

  /**
   * Start a looping low-volume static hiss that rides under the partner's
   * voice so live ConvAI replies still carry an intercom character (the
   * SDK plays its own audio output directly, outside our filter chain).
   * Validates: Requirements 12.2, 3.6
   */
  const startIntercomHiss = useCallback(async (): Promise<void> => {
    try {
      if (!staticLoopRef.current) return;
      if (!staticLoopBlobUrl.current) {
        const blob = await elevenLabsServiceRef.current.playSFX(SFXKey.StaticBurst);
        staticLoopBlobUrl.current = URL.createObjectURL(blob);
        staticLoopRef.current.src = staticLoopBlobUrl.current;
      }
      staticLoopRef.current.currentTime = 0;
      await staticLoopRef.current.play();
    } catch (error) {
      console.error('Failed to start intercom hiss:', error);
    }
  }, []);

  const stopIntercomHiss = useCallback((): void => {
    if (!staticLoopRef.current) return;
    staticLoopRef.current.pause();
    staticLoopRef.current.currentTime = 0;
  }, []);

  /**
   * Play a sound effect
   * Validates: Requirements 10.4, 12.8
   */
  const playSFX = useCallback(async (key: SFXKey): Promise<void> => {
    try {
      const blob = await elevenLabsServiceRef.current.playSFX(key);
      const url = URL.createObjectURL(blob);
      
      if (sfxAudioRef.current) {
        sfxAudioRef.current.src = url;
        sfxAudioRef.current.currentTime = 0;
        await sfxAudioRef.current.play();
      }
    } catch (error) {
      console.error(`Failed to play SFX ${key}:`, error);
    }
  }, []);

  /**
   * Play radio static at PTT start
   * Validates: Requirement 2.4
   */
  const playPTTStartSFX = useCallback(async (): Promise<void> => {
    await playSFX(SFXKey.RadioStaticStart);
  }, [playSFX]);

  /**
   * Play radio static at PTT end
   * Validates: Requirement 2.4
   */
  const playPTTEndSFX = useCallback(async (): Promise<void> => {
    await playSFX(SFXKey.RadioStaticEnd);
  }, [playSFX]);

  /**
   * Set music based on narrative beat
   * Validates: Requirements 12.3, 12.4, 12.5, 12.6
   */
  const setMusicBeat = useCallback(async (beat: NarrativeBeat): Promise<void> => {
    const config = BEAT_AUDIO_CONFIG[beat];
    setCurrentBeat(beat);
    
    if (!musicAudioRef.current) return;
    
    try {
      if (config.musicEnabled) {
        const blob = await elevenLabsServiceRef.current.playMusicTrack(beat);
        const url = URL.createObjectURL(blob);
        
        musicAudioRef.current.src = url;
        musicAudioRef.current.volume = config.musicVolume;
        
        // Only play if not already playing or if track changed
        if (musicAudioRef.current.paused) {
          await musicAudioRef.current.play();
        }
      } else {
        // Fade out or stop music
        musicAudioRef.current.pause();
      }
    } catch (error) {
      console.error(`Failed to set music for beat ${beat}:`, error);
    }
  }, []);

  /**
   * Play partner response via intercom
   * Validates: Requirement 12.2
   */
  const playPartnerResponse = useCallback(async (blob: Blob): Promise<void> => {
    if (!intercomAudioRef.current || !audioContextRef.current) {
      initializeAudio();
    }
    
    try {
      const url = URL.createObjectURL(blob);
      
      if (intercomAudioRef.current) {
        intercomAudioRef.current.src = url;
        intercomAudioRef.current.currentTime = 0;
        
        // Apply radio filter via Web Audio API
        if (audioContextRef.current && intercomAudioRef.current) {
          // Create or reuse the filter chain
          if (!intercomSourceRef.current && intercomAudioRef.current) {
            intercomSourceRef.current = audioContextRef.current.createMediaElementSource(intercomAudioRef.current);
            
            // Create bandpass filter for radio effect
            const filter = audioContextRef.current.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1000; // Center frequency
            filter.Q.value = 1; // Resonance
            
            // Add high-pass for more radio-like sound
            const highpass = audioContextRef.current.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = 300;
            
            // Connect: source -> highpass -> bandpass -> destination
            intercomSourceRef.current.connect(highpass);
            highpass.connect(filter);
            filter.connect(audioContextRef.current.destination);
            
            intercomFilterRef.current = filter;
          }
        }
        
        setIsIntercomActive(true);
        await intercomAudioRef.current.play();
        
        // Reset intercom state when playback ends
        intercomAudioRef.current.onended = () => {
          setIsIntercomActive(false);
        };
      }
    } catch (error) {
      console.error('Failed to play partner response:', error);
      setIsIntercomActive(false);
    }
  }, [initializeAudio]);

  /**
   * Play TTS line (pre-generated narration), clean (unfiltered) voice.
   * Validates: Requirement 10.3
   */
  const playTTSLine = useCallback(async (lineKey: string): Promise<void> => {
    try {
      const blob = await elevenLabsServiceRef.current.playTTSLine(lineKey);
      const url = URL.createObjectURL(blob);

      if (sfxAudioRef.current) {
        sfxAudioRef.current.src = url;
        sfxAudioRef.current.currentTime = 0;
        await sfxAudioRef.current.play();
      }
    } catch (error) {
      console.error(`Failed to play TTS line ${lineKey}:`, error);
    }
  }, []);

  /**
   * Play a pre-generated TTS line through the filtered intercom channel so
   * it sounds like the partner talking on the radio. Used for first
   * intercom contact after the opening monologue.
   * Validates: Requirements 12.2, 13.2
   */
  const playIntercomLine = useCallback(
    async (lineKey: string): Promise<void> => {
      try {
        const blob = await elevenLabsServiceRef.current.playTTSLine(lineKey);
        await playPartnerResponse(blob);
      } catch (error) {
        console.error(`Failed to play intercom line ${lineKey}:`, error);
      }
    },
    [playPartnerResponse],
  );

  /**
   * Play ending sting
   * Validates: Requirement 12.7
   */
  const playEndingSting = useCallback(async (ending: EndingType): Promise<void> => {
    try {
      const blob = await elevenLabsServiceRef.current.playEndingSting(ending);
      const url = URL.createObjectURL(blob);
      
      if (musicAudioRef.current) {
        // Fade out current music
        musicAudioRef.current.pause();
        
        // Play ending sting
        musicAudioRef.current.src = url;
        musicAudioRef.current.volume = 1.0;
        musicAudioRef.current.loop = false;
        await musicAudioRef.current.play();
      }
    } catch (error) {
      console.error(`Failed to play ending sting for ${ending}:`, error);
    }
  }, []);

  /**
   * Set intercom active state
   * Validates: Requirement 12.2
   */
  const setIntercomActive = useCallback((active: boolean): void => {
    setIsIntercomActive(active);
  }, []);

  /**
   * Play locked door sound
   * Validates: Requirement 1.6
   */
  const playLockedDoorSFX = useCallback(async (): Promise<void> => {
    await playSFX(SFXKey.LockedDoorThud);
  }, [playSFX]);

  /**
   * Play object interaction sound
   * Validates: Requirement 12.8
   */
  const playInteractSFX = useCallback(async (): Promise<void> => {
    await playSFX(SFXKey.ObjectInteract);
  }, [playSFX]);

  /**
   * Play door unlock sound
   */
  const playDoorUnlockSFX = useCallback(async (): Promise<void> => {
    await playSFX(SFXKey.DoorUnlock);
  }, [playSFX]);

  /**
   * Play door lock sound
   */
  const playDoorLockSFX = useCallback(async (): Promise<void> => {
    await playSFX(SFXKey.DoorLock);
  }, [playSFX]);

  /**
   * Play signal lost sound
   */
  const playSignalLostSFX = useCallback(async (): Promise<void> => {
    await playSFX(SFXKey.SignalLost);
  }, [playSFX]);

  /**
   * Play static burst sound
   */
  const playStaticBurstSFX = useCallback(async (): Promise<void> => {
    await playSFX(SFXKey.StaticBurst);
  }, [playSFX]);

  /**
   * Load audio manifest
   * Validates: Requirements 10.3, 10.4, 10.5, 10.6
   */
  const loadManifest = useCallback(async (): Promise<void> => {
    try {
      await elevenLabsServiceRef.current.loadAudioManifest('/audio/manifest.json');
      setIsManifestLoaded(true);
    } catch (error) {
      console.error('Failed to load audio manifest:', error);
      throw error;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeAudio();
    
    return () => {
      // Cleanup audio elements
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current = null;
      }
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
      if (sfxAudioRef.current) {
        sfxAudioRef.current.pause();
        sfxAudioRef.current = null;
      }
      if (intercomAudioRef.current) {
        intercomAudioRef.current.pause();
        intercomAudioRef.current = null;
      }
      if (staticLoopRef.current) {
        staticLoopRef.current.pause();
        staticLoopRef.current = null;
      }
      if (staticLoopBlobUrl.current) {
        URL.revokeObjectURL(staticLoopBlobUrl.current);
        staticLoopBlobUrl.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [initializeAudio]);

  return {
    // State
    currentBeat,
    isIntercomActive,
    isManifestLoaded,
    
    // SFX playback
    playSFX,
    playPTTStartSFX,
    playPTTEndSFX,
    playLockedDoorSFX,
    playInteractSFX,
    playDoorUnlockSFX,
    playDoorLockSFX,
    playSignalLostSFX,
    playStaticBurstSFX,
    
    // Music
    setMusicBeat,
    playEndingSting,
    
    // Partner voice
    playPartnerResponse,
    playTTSLine,
    playIntercomLine,
    setIntercomActive,
    startIntercomHiss,
    stopIntercomHiss,
    
    // Manifest
    loadManifest,
  };
}
