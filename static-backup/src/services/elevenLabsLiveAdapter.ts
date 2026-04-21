// Live ElevenLabs Conversational AI adapter.
// Wraps @elevenlabs/client Conversation.startSession, exposing the subset of
// operations that ElevenLabsService needs to route runtime partner dialogue
// through a real agent. All calls gracefully no-op if the adapter has not
// been started, so service callers do not have to special-case it.
// Validates: Requirements 3.1, 3.2, 3.4, 4.2, 10.2

import { Conversation } from '@elevenlabs/client';
import type { Mode, Status } from '@elevenlabs/client';

export interface LiveSessionConfig {
  agentId: string;
  systemPrompt?: string;
  voiceId?: string;
  firstMessage?: string;
}

/**
 * Client tools exposed to the agent. The partner calls `finalChoice` with
 * its decision at the prisoner's dilemma; we resolve the pending promise
 * held by ElevenLabsService.getFinalChoice.
 */
export type FinalChoiceToolPayload = { choice: 'Cooperate' | 'Defect' } | { choice: string };

export interface LiveAdapterCallbacks {
  onPartnerSpeakingChange?: (speaking: boolean) => void;
  onStatusChange?: (status: Status) => void;
  onError?: (message: string) => void;
  onPartnerText?: (text: string) => void;
  onPlayerTranscript?: (text: string) => void;
  /** Called when the agent invokes clientTools.finalChoice. */
  onFinalChoiceTool?: (payload: FinalChoiceToolPayload) => void;
}

export type LiveConversation = Awaited<ReturnType<typeof Conversation.startSession>>;

/**
 * Live adapter state. A single instance is held by ElevenLabsService.
 */
export class ElevenLabsLiveAdapter {
  private conversation: LiveConversation | null = null;
  private callbacks: LiveAdapterCallbacks = {};
  private muted = true;
  private lastError: string | null = null;

  setCallbacks(callbacks: LiveAdapterCallbacks): void {
    this.callbacks = callbacks;
  }

  isActive(): boolean {
    return this.conversation !== null;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Start a ConvAI session against the real agent.
   * Validates: Requirements 3.1, 3.2, 4.2
   */
  async startSession(config: LiveSessionConfig): Promise<void> {
    if (this.conversation) {
      return;
    }

    this.lastError = null;

    try {
      this.conversation = await Conversation.startSession({
        agentId: config.agentId,
        overrides: {
          agent: config.systemPrompt
            ? {
                prompt: { prompt: config.systemPrompt },
                firstMessage: config.firstMessage,
              }
            : undefined,
          tts: config.voiceId ? { voiceId: config.voiceId } : undefined,
        },
        clientTools: {
          /**
           * The agent calls this with its Cooperate/Defect decision at the
           * prisoner's dilemma. The service awaits it in getFinalChoice.
           */
          finalChoice: (params: unknown) => {
            const payload =
              typeof params === 'object' && params !== null
                ? (params as FinalChoiceToolPayload)
                : { choice: String(params) };
            this.callbacks.onFinalChoiceTool?.(payload);
            return 'Choice received.';
          },
        },
        onConnect: () => {
          // Enforce PTT discipline: start muted so nothing transmits until
          // the player physically holds V.
          this.conversation?.setMicMuted(true);
          this.muted = true;
        },
        onDisconnect: () => {
          this.callbacks.onPartnerSpeakingChange?.(false);
        },
        onError: (message: string) => {
          this.lastError = message;
          this.callbacks.onError?.(message);
        },
        onStatusChange: ({ status }: { status: Status }) => {
          this.callbacks.onStatusChange?.(status);
        },
        onModeChange: ({ mode }: { mode: Mode }) => {
          this.callbacks.onPartnerSpeakingChange?.(mode === 'speaking');
        },
        onMessage: ({ source, message }: { source: string; message: string }) => {
          if (source === 'ai' || source === 'agent') {
            this.callbacks.onPartnerText?.(message);
          } else if (source === 'user') {
            this.callbacks.onPlayerTranscript?.(message);
          }
        },
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.callbacks.onError?.(this.lastError);
      this.conversation = null;
      throw err;
    }
  }

  /**
   * Send a user text turn into the conversation. Used by the mic-denied
   * text-input fallback and by puzzle solution reporting.
   */
  sendUserMessage(text: string): void {
    this.conversation?.sendUserMessage(text);
  }

  /**
   * Inject an out-of-band context message (trust event, beat tone, puzzle
   * partnerKnowledge). Doesn't trigger a partner turn on its own.
   */
  sendContextualUpdate(text: string): void {
    this.conversation?.sendContextualUpdate(text);
  }

  /**
   * PTT start — unmute the mic so the player's voice streams to ConvAI.
   * Validates: Requirement 2.1
   */
  unmuteMic(): void {
    if (!this.conversation) return;
    this.muted = false;
    this.conversation.setMicMuted(false);
  }

  /**
   * PTT release — re-mute so ambient room audio does not transmit.
   * Validates: Requirements 2.2, 2.6
   */
  muteMic(): void {
    if (!this.conversation) return;
    this.muted = true;
    this.conversation.setMicMuted(true);
  }

  isMuted(): boolean {
    return this.muted;
  }

  setOutputVolume(volume: number): void {
    this.conversation?.setVolume({ volume: Math.max(0, Math.min(1, volume)) });
  }

  async endSession(): Promise<void> {
    if (!this.conversation) return;
    try {
      await this.conversation.endSession();
    } finally {
      this.conversation = null;
    }
  }
}

/**
 * Module-level singleton — one live adapter per page load. Tests that want
 * to assert the mock path never trigger this instance.
 */
let liveAdapterInstance: ElevenLabsLiveAdapter | null = null;

export function getLiveAdapter(): ElevenLabsLiveAdapter {
  if (!liveAdapterInstance) {
    liveAdapterInstance = new ElevenLabsLiveAdapter();
  }
  return liveAdapterInstance;
}

export function resetLiveAdapter(): void {
  if (liveAdapterInstance) {
    void liveAdapterInstance.endSession();
  }
  liveAdapterInstance = null;
}
