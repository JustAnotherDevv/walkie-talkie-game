import { useCallback, useRef, useState, useEffect } from 'react';
import { getElevenLabsService, ElevenLabsService, SessionState } from '../services/ElevenLabsService';

/**
 * PTT state enum
 */
export enum PTTState {
  Idle = 'Idle',
  Transmitting = 'Transmitting',
  Processing = 'Processing',
  Error = 'Error',
}

/**
 * Microphone availability status
 */
export enum MicStatus {
  Available = 'Available',
  Unavailable = 'Unavailable',
  PermissionDenied = 'PermissionDenied',
  NotChecked = 'NotChecked',
}

/**
 * Audio frame with timestamp for PTT filtering
 */
export interface AudioFrame {
  data: Blob;
  timestamp: number;
  pttActive: boolean;
}

/**
 * PTT event callbacks
 */
export interface PTTEvents {
  onPTTStart?: () => void;
  onPTTEnd?: () => void;
  onPartnerResponse?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onSignalLost?: () => void;
  onTextInputFallback?: () => void;
}

/**
 * usePTT hook - Manages push-to-talk microphone capture and audio transmission
 * Validates: Requirements 2.1, 2.2, 2.6
 * 
 * Key behaviors:
 * - Only captures audio while PTT is active (V key held)
 * - Filters out ambient audio when PTT is not active
 * - Plays radio static SFX at start/end of transmission
 * - Shows PTT indicator while transmitting
 */
export function usePTT(events: PTTEvents = {}) {
  const {
    onPTTStart,
    onPTTEnd,
    onPartnerResponse,
    onError,
    onSignalLost,
    onTextInputFallback,
  } = events;

  // State
  const [pttState, setPTTState] = useState<PTTState>(PTTState.Idle);
  const [micStatus, setMicStatus] = useState<MicStatus>(MicStatus.NotChecked);

  // Refs for MediaRecorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pttStartTimeRef = useRef<number>(0);
  const elevenLabsServiceRef = useRef<ElevenLabsService>(getElevenLabsService());

  // Track if PTT is currently active
  const pttActiveRef = useRef(false);

  /**
   * Check microphone availability
   * Validates: Requirement 2.5
   */
  const checkMicrophone = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We got access, stop the test stream
      stream.getTracks().forEach(track => track.stop());
      setMicStatus(MicStatus.Available);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setMicStatus(MicStatus.PermissionDenied);
        } else {
          setMicStatus(MicStatus.Unavailable);
        }
      } else {
        setMicStatus(MicStatus.Unavailable);
      }
      return false;
    }
  }, []);

  /**
   * Start microphone capture
   * Validates: Requirements 2.1, 2.6
   *
   * Only frames captured during PTT-active window are included. In live
   * ConvAI mode the SDK owns the mic; we unmute it via the service and
   * the SDK streams audio directly to ElevenLabs (no MediaRecorder blob).
   */
  const startCapture = useCallback(async (): Promise<void> => {
    // Live path: SDK already manages mic when the session is active.
    if (elevenLabsServiceRef.current.isLiveMode()) {
      pttActiveRef.current = true;
      pttStartTimeRef.current = Date.now();
      elevenLabsServiceRef.current.startMicStreaming();
      setPTTState(PTTState.Transmitting);
      onPTTStart?.();
      return;
    }

    // Mock path below — retains MediaRecorder blob capture for tests and
    // for dev without an ElevenLabs agent.
    if (micStatus === MicStatus.NotChecked) {
      const available = await checkMicrophone();
      if (!available) {
        elevenLabsServiceRef.current.handleMicrophoneUnavailable();
        onTextInputFallback?.();
        return;
      }
    } else if (micStatus !== MicStatus.Available) {
      elevenLabsServiceRef.current.handleMicrophoneUnavailable();
      onTextInputFallback?.();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      pttStartTimeRef.current = Date.now();
      pttActiveRef.current = true;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && pttActiveRef.current) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);

      setPTTState(PTTState.Transmitting);
      onPTTStart?.();
    } catch (error) {
      console.error('Failed to start capture:', error);
      setPTTState(PTTState.Error);
      onError?.(error instanceof Error ? error : new Error('Failed to start capture'));

      elevenLabsServiceRef.current.handleMicrophoneUnavailable();
      onTextInputFallback?.();
    }
  }, [micStatus, checkMicrophone, onPTTStart, onError, onTextInputFallback]);

  /**
   * Stop microphone capture and (mock path only) send the blob.
   * Validates: Requirements 2.2, 2.6
   */
  const stopCapture = useCallback(async (): Promise<void> => {
    // Live path: tell the SDK to mute the mic; no blob involved.
    if (elevenLabsServiceRef.current.isLiveMode()) {
      if (!pttActiveRef.current) return;
      pttActiveRef.current = false;
      elevenLabsServiceRef.current.stopMicStreaming();
      setPTTState(PTTState.Idle);
      onPTTEnd?.();
      return;
    }

    if (!mediaRecorderRef.current || !pttActiveRef.current) {
      return;
    }

    pttActiveRef.current = false;

    const recorder = mediaRecorderRef.current;

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        setPTTState(PTTState.Processing);
        onPTTEnd?.();

        try {
          const responseBlob = await elevenLabsServiceRef.current.sendPTTAudio(audioBlob);
          setPTTState(PTTState.Idle);
          onPartnerResponse?.(responseBlob);
        } catch (error) {
          console.error('Failed to send PTT audio:', error);

          if (error instanceof Error && error.message.includes('Signal lost')) {
            onSignalLost?.();
          }

          setPTTState(PTTState.Error);
          onError?.(error instanceof Error ? error : new Error('Failed to send audio'));
        }

        resolve();
      };

      recorder.stop();
    });
  }, [onPTTEnd, onPartnerResponse, onError, onSignalLost]);

  /**
   * Handle PTT pressed event from useInput
   * Validates: Requirement 2.1
   */
  const handlePTTPressed = useCallback(async () => {
    if (pttState !== PTTState.Idle) {
      return; // Don't start if already transmitting or processing
    }
    
    await startCapture();
  }, [pttState, startCapture]);

  /**
   * Handle PTT released event from useInput
   * Validates: Requirement 2.2
   */
  const handlePTTReleased = useCallback(async () => {
    if (pttState !== PTTState.Transmitting) {
      return; // Only stop if currently transmitting
    }
    
    await stopCapture();
  }, [pttState, stopCapture]);

  /**
   * Send text input as fallback
   * Validates: Requirement 2.5
   */
  const sendTextInput = useCallback(async (text: string): Promise<void> => {
    if (elevenLabsServiceRef.current.getSessionState() !== SessionState.Connected) {
      onError?.(new Error('No active session'));
      return;
    }
    
    setPTTState(PTTState.Processing);
    
    try {
      const responseBlob = await elevenLabsServiceRef.current.sendTextInput(text);
      setPTTState(PTTState.Idle);
      onPartnerResponse?.(responseBlob);
    } catch (error) {
      console.error('Failed to send text input:', error);
      setPTTState(PTTState.Error);
      onError?.(error instanceof Error ? error : new Error('Failed to send text'));
    }
  }, [onPartnerResponse, onError]);

  /**
   * Reset PTT state
   */
  const reset = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    audioChunksRef.current = [];
    pttActiveRef.current = false;
    setPTTState(PTTState.Idle);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return {
    // State
    pttState,
    micStatus,
    isTransmitting: pttState === PTTState.Transmitting,
    
    // Actions
    handlePTTPressed,
    handlePTTReleased,
    sendTextInput,
    checkMicrophone,
    reset,
  };
}

/**
 * Create a filtered audio blob containing only PTT-active frames
 * Validates: Requirement 2.6
 * 
 * This function ensures that only audio captured during PTT-active
 * periods is included in the final blob sent to ConvAI.
 */
export function filterPTTAudioFrames(
  frames: AudioFrame[]
): Blob {
  // Filter to only PTT-active frames
  const activeFrames = frames.filter(frame => frame.pttActive);
  
  // Combine into single blob
  const blobs = activeFrames.map(frame => frame.data);
  return new Blob(blobs, { type: 'audio/webm' });
}

/**
 * Check if a frame should be included based on PTT state
 * Validates: Requirement 2.6
 */
export function shouldIncludeFrame(pttActive: boolean): boolean {
  return pttActive;
}
