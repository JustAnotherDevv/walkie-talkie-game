import { Conversation } from '@elevenlabs/client';
import type { Mode, Status } from '@elevenlabs/client';

export interface LiveSessionConfig {
  agentId: string;
  systemPrompt?: string;
  voiceId?: string;
  firstMessage?: string;
}

export type FinalChoicePayload =
  | { choice: 'Cooperate' | 'Defect' }
  | { choice: string };

export interface LiveAdapterCallbacks {
  onPartnerSpeakingChange?: (speaking: boolean) => void;
  onStatusChange?: (status: Status) => void;
  onError?: (message: string) => void;
  onPartnerText?: (text: string) => void;
  onPlayerTranscript?: (text: string) => void;
  onFinalChoiceTool?: (payload: FinalChoicePayload) => void;
}

type LiveConversation = Awaited<ReturnType<typeof Conversation.startSession>>;

/**
 * Thin wrapper around @elevenlabs/client's Conversation.startSession that
 * owns one live session at a time and forwards the subset of callbacks
 * ElevenLabsService needs. Mic starts muted so PTT actually gates
 * transmission.
 */
export class ElevenLabsLiveAdapter {
  private conversation: LiveConversation | null = null;
  private callbacks: LiveAdapterCallbacks = {};
  private muted = true;

  setCallbacks(cb: LiveAdapterCallbacks): void {
    this.callbacks = cb;
  }

  isActive(): boolean {
    return this.conversation !== null;
  }

  async startSession(config: LiveSessionConfig): Promise<void> {
    // If an earlier session is lingering (e.g. HMR reload left one behind),
    // tear it down before opening a new one.
    if (this.conversation) {
      try {
        await this.conversation.endSession();
      } catch {
        // ignore — we'll start fresh regardless
      }
      this.conversation = null;
    }

    // Force the mic permission prompt NOW, before the SDK tries internally.
    // We throw a clear error if permission is denied so the app can surface
    // it rather than silently opening a WebSocket with no audio track.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop the tracks — the SDK will request its own. We only
      // wanted the user to see the browser prompt and grant access.
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const message =
        err instanceof Error
          ? `Microphone access denied: ${err.message}`
          : 'Microphone access denied.';
      this.callbacks.onError?.(message);
      throw new Error(message);
    }

    this.conversation = await Conversation.startSession({
      agentId: config.agentId,
      // Force WebSocket transport — the SDK default is WebRTC/LiveKit,
      // which 404s on /v1/rtc for Creator-tier agents.
      connectionType: 'websocket',
      // Intentionally no `overrides` block. The agent's platform_settings
      // blocks most override fields (agent.prompt, tts.voice_id,
      // first_message) and the server rejects the session when blocked
      // overrides arrive. The full system prompt and voice id are baked
      // into the agent config itself — runtime only adds contextual
      // updates (trust events, beat tone, puzzle knowledge) which
      // don't need override permission.
      clientTools: {
        finalChoice: (params: unknown) => {
          const payload: FinalChoicePayload =
            typeof params === 'object' && params !== null
              ? (params as FinalChoicePayload)
              : { choice: String(params) };
          this.callbacks.onFinalChoiceTool?.(payload);
          return 'Choice received.';
        },
      },
      onConnect: () => {
        // Enforce PTT discipline — never stream until V is held.
        this.conversation?.setMicMuted(true);
        this.muted = true;
      },
      onDisconnect: () => {
        this.callbacks.onPartnerSpeakingChange?.(false);
      },
      onError: (message: string) => this.callbacks.onError?.(message),
      onStatusChange: ({ status }: { status: Status }) =>
        this.callbacks.onStatusChange?.(status),
      onModeChange: ({ mode }: { mode: Mode }) =>
        this.callbacks.onPartnerSpeakingChange?.(mode === 'speaking'),
      onMessage: ({ source, message }: { source: string; message: string }) => {
        if (source === 'ai' || source === 'agent') {
          this.callbacks.onPartnerText?.(message);
        } else if (source === 'user') {
          this.callbacks.onPlayerTranscript?.(message);
        }
      },
    });
  }

  sendUserMessage(text: string): void {
    this.conversation?.sendUserMessage(text);
  }

  sendContextualUpdate(text: string): void {
    this.conversation?.sendContextualUpdate(text);
  }

  unmuteMic(): void {
    if (!this.conversation) return;
    this.muted = false;
    this.conversation.setMicMuted(false);
  }

  muteMic(): void {
    if (!this.conversation) return;
    this.muted = true;
    this.conversation.setMicMuted(true);
  }

  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Current mic input level in 0..1. Returns 0 when no session is open or
   * the SDK hasn't captured a sample yet. Read each frame from a UI timer
   * to drive a volume meter.
   */
  getInputLevel(): number {
    if (!this.conversation) return 0;
    try {
      return this.conversation.getInputVolume();
    } catch {
      return 0;
    }
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

let singleton: ElevenLabsLiveAdapter | null = null;

export function getLiveAdapter(): ElevenLabsLiveAdapter {
  if (!singleton) singleton = new ElevenLabsLiveAdapter();
  return singleton;
}

export function resetLiveAdapter(): void {
  if (singleton) void singleton.endSession();
  singleton = null;
}
