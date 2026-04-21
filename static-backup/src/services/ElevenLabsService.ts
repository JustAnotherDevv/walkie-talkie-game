import { FinalChoice, EndingType, NarrativeBeat, SFXKey, ElevenLabsError, AudioAssetManifest } from '../types';
import { ElevenLabsLiveAdapter, getLiveAdapter, resetLiveAdapter } from './elevenLabsLiveAdapter';

/**
 * ConvAI session interface (mocked or real SDK)
 */
export interface ConvAISession {
  id: string;
  voiceId: string;
  isActive: boolean;
}

/**
 * Partner response from ConvAI
 */
export interface PartnerResponse {
  audioBlob: Blob;
  text?: string;
}

/**
 * Event callback types
 */
export type PartnerResponseCallback = (blob: Blob) => void;
export type APIErrorCallback = (error: ElevenLabsError) => void;
export type SignalLostCallback = () => void;
export type TextInputFallbackCallback = () => void;

/**
 * Session state enum
 */
export enum SessionState {
  Idle = 'Idle',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Error = 'Error',
}

/**
 * ElevenLabsService class
 * Validates: Requirements 3.1, 3.2, 8.3, 10.2
 * 
 * Facade over all ElevenLabs API calls:
 * - Conversational AI for runtime dialogue
 * - TTS for pre-generated narration lines
 * - Sound Effects for diegetic audio cues
 * - Music for tension score
 * 
 * Centralizes error handling, retry logic, and API key management.
 */
/**
 * Strings treated as "no real agent configured" — service falls back to the
 * in-memory mock path (tests rely on this when VITE_ELEVENLABS_AGENT_ID is
 * absent from the environment).
 */
const AGENT_PLACEHOLDERS = new Set([
  '',
  'placeholder',
  'partner-voice-placeholder',
  'test-agent-id',
]);

export class ElevenLabsService {
  private readonly apiKey: string;
  private readonly agentId: string;
  private partnerVoiceId: string;
  private conversationSession: ConvAISession | null = null;
  private sessionState: SessionState = SessionState.Idle;
  private audioManifest: AudioAssetManifest | null = null;
  private audioCache: Map<string, Blob> = new Map();
  private conversationHistory: string[] = [];
  private retryCount: number = 0;
  private maxRetries: number = 1;
  private timeoutMs: number = 10000; // 10 seconds per Requirement 3.6
  // Abortable simulated-delay hook; tests can shorten it without racing.
  private simulatedDelayMs: number = 100;

  private readonly liveEnabled: boolean;
  private liveAdapter: ElevenLabsLiveAdapter | null = null;

  // Event callbacks
  private onPartnerResponseReadyCallback: PartnerResponseCallback | null = null;
  private onAPIErrorCallback: APIErrorCallback | null = null;
  private onSignalLostCallback: SignalLostCallback | null = null;
  private onTextInputFallbackCallback: TextInputFallbackCallback | null = null;
  private onPartnerSpeakingChangeCallback: ((speaking: boolean) => void) | null = null;

  constructor(apiKey: string, agentId: string, partnerVoiceId: string) {
    this.apiKey = apiKey;
    this.agentId = agentId;
    this.partnerVoiceId = partnerVoiceId;
    this.liveEnabled = !AGENT_PLACEHOLDERS.has(agentId);
    if (this.liveEnabled) {
      this.liveAdapter = getLiveAdapter();
      this.liveAdapter.setCallbacks({
        onError: (message) => this.handleError('ConversationalAI', new Error(message)),
        onPartnerSpeakingChange: (speaking) =>
          this.onPartnerSpeakingChangeCallback?.(speaking),
        onFinalChoiceTool: (payload) => {
          const raw = String(payload.choice).toLowerCase();
          const resolved = raw.includes('coop')
            ? FinalChoice.Cooperate
            : FinalChoice.Defect;
          const resolver = this.pendingFinalChoiceResolver;
          this.pendingFinalChoiceResolver = null;
          resolver?.(resolved);
        },
      });
    }
  }

  /** Resolver for the Promise returned from live getFinalChoice. */
  private pendingFinalChoiceResolver: ((choice: FinalChoice) => void) | null = null;

  /**
   * Fired whenever the live ConvAI agent transitions between listening and
   * speaking. App uses this to overlay radio static ambience on top of the
   * SDK's direct audio output so live mode still sounds like an intercom.
   */
  set onPartnerSpeakingChange(callback: ((speaking: boolean) => void) | null) {
    this.onPartnerSpeakingChangeCallback = callback;
  }

  /** Credentials accessor retained so TS `noUnusedLocals` considers the fields used. */
  getCredentials(): { apiKey: string; agentId: string; partnerVoiceId: string } {
    return {
      apiKey: this.apiKey,
      agentId: this.agentId,
      partnerVoiceId: this.partnerVoiceId,
    };
  }

  /** True iff a real ElevenLabs ConvAI agent is wired behind the service. */
  isLiveMode(): boolean {
    return this.liveEnabled;
  }

  /** Exposed primarily for tests; production code should not reach into this. */
  getLiveAdapter(): ElevenLabsLiveAdapter | null {
    return this.liveAdapter;
  }

  /**
   * Test-only hook: overrides the mock path's simulated network delay
   * (and therefore when the internal AbortController fires). In live mode
   * the adapter's own timeouts apply, so this is a no-op for production.
   */
  setMockTimingForTests(options: { timeoutMs?: number; simulatedDelayMs?: number }): void {
    if (typeof options.timeoutMs === 'number') this.timeoutMs = options.timeoutMs;
    if (typeof options.simulatedDelayMs === 'number') {
      this.simulatedDelayMs = options.simulatedDelayMs;
    }
  }

  /**
   * Set callback for partner response ready event
   */
  set onPartnerResponseReady(callback: PartnerResponseCallback | null) {
    this.onPartnerResponseReadyCallback = callback;
  }

  /**
   * Set callback for API error event
   */
  set onAPIError(callback: APIErrorCallback | null) {
    this.onAPIErrorCallback = callback;
  }

  /**
   * Set callback for signal lost event
   */
  set onSignalLost(callback: SignalLostCallback | null) {
    this.onSignalLostCallback = callback;
  }

  /**
   * Set callback for text input fallback event
   */
  set onTextInputFallback(callback: TextInputFallbackCallback | null) {
    this.onTextInputFallbackCallback = callback;
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState {
    return this.sessionState;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): string[] {
    return [...this.conversationHistory];
  }

  /**
   * Start a new conversation session with the ConvAI agent
   * Validates: Requirements 3.1, 3.2
   * 
   * @param systemPrompt - Optional system prompt override
   * @param initialMemory - Optional initial memory/knowledge base
   * @returns Promise that resolves when session is established
   */
  async startConversationSession(systemPrompt?: string, initialMemory?: string): Promise<void> {
    this.sessionState = SessionState.Connecting;

    try {
      if (this.liveEnabled && this.liveAdapter) {
        // Real path — open a WebSocket to ElevenLabs ConvAI with our prompt
        // and voice overrides. The SDK starts the mic muted (see adapter).
        await this.liveAdapter.startSession({
          agentId: this.agentId,
          systemPrompt,
          voiceId: this.partnerVoiceId,
        });
        this.conversationSession = {
          id: `live-${Date.now()}`,
          voiceId: this.partnerVoiceId,
          isActive: true,
        };
      } else {
        this.conversationSession = await this.createConvAISession(systemPrompt, initialMemory);
      }

      this.sessionState = SessionState.Connected;
      this.retryCount = 0;

      if (initialMemory) {
        this.conversationHistory.push(`[SYSTEM] Partner knowledge: ${initialMemory}`);
        if (this.liveEnabled && this.liveAdapter) {
          this.liveAdapter.sendContextualUpdate(`[SYSTEM] Partner knowledge: ${initialMemory}`);
        }
      }
    } catch (error) {
      this.sessionState = SessionState.Error;
      this.handleError('ConversationalAI', error);
      throw error;
    }
  }

  /**
   * Create a ConvAI session (internal method)
   * In production, this would call the actual ElevenLabs SDK
   */
  private async createConvAISession(_systemPrompt?: string, _initialMemory?: string): Promise<ConvAISession> {
    // Simulate API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    void controller;

    try {
      // In real implementation: call ElevenLabs ConvAI WebSocket API
      // For now, return a mock session
      await this.simulateNetworkDelay();
      
      clearTimeout(timeoutId);
      
      return {
        id: `session-${Date.now()}`,
        voiceId: this.partnerVoiceId,
        isActive: true,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Send PTT audio to ConvAI and get partner response
   * Validates: Requirements 3.1, 3.2
   * 
   * @param audioBlob - Audio blob from microphone capture
   * @returns Promise resolving to partner response audio blob
   */
  async sendPTTAudio(audioBlob: Blob): Promise<Blob> {
    if (!this.conversationSession || !this.conversationSession.isActive) {
      throw new Error('No active conversation session');
    }

    // In live mode the SDK streams mic audio directly over its own WebSocket
    // when the mic is unmuted, so a "send blob" call here is vestigial — we
    // record the turn and return a sentinel blob. PTT press/release drives
    // the actual transmission via startMicStreaming/stopMicStreaming.
    if (this.liveEnabled) {
      this.conversationHistory.push(`[PLAYER] Audio streamed at ${Date.now()}`);
      const sentinel = new Blob([], { type: 'audio/wav' });
      if (this.onPartnerResponseReadyCallback) {
        this.onPartnerResponseReadyCallback(sentinel);
      }
      return sentinel;
    }

    try {
      this.conversationHistory.push(`[PLAYER] Audio turn at ${Date.now()}`);
      const response = await this.sendToConvAIWithTimeout(audioBlob);
      this.conversationHistory.push(`[PARTNER] Response at ${Date.now()}`);
      this.retryCount = 0;

      if (this.onPartnerResponseReadyCallback) {
        this.onPartnerResponseReadyCallback(response);
      }

      return response;
    } catch (error) {
      if (this.isTimeoutError(error)) {
        return this.handleTimeout(() => this.sendToConvAIWithTimeout(audioBlob));
      }

      this.handleError('ConversationalAI', error);
      throw error;
    }
  }

  /**
   * PTT press — in live mode, unmute the SDK mic so the player's voice
   * starts streaming to ConvAI. In mock mode this is a no-op; the mock
   * path relies on MediaRecorder + sendPTTAudio instead.
   * Validates: Requirements 2.1, 2.6
   */
  startMicStreaming(): void {
    if (this.liveEnabled && this.liveAdapter) {
      this.liveAdapter.unmuteMic();
    }
  }

  /**
   * PTT release — re-mute the SDK mic so ambient audio doesn't transmit.
   * Validates: Requirements 2.2, 2.6
   */
  stopMicStreaming(): void {
    if (this.liveEnabled && this.liveAdapter) {
      this.liveAdapter.muteMic();
    }
  }

  /**
   * Send text input as a text turn to ConvAI (fallback for mic unavailability)
   * Validates: Requirement 2.5
   * 
   * @param text - Text input from player
   * @returns Promise resolving to partner response audio blob
   */
  async sendTextInput(text: string): Promise<Blob> {
    if (!this.conversationSession || !this.conversationSession.isActive) {
      throw new Error('No active conversation session');
    }

    this.conversationHistory.push(`[PLAYER] Text: ${text}`);

    if (this.liveEnabled && this.liveAdapter) {
      // Real path: push the text as a user turn; the agent's audio response
      // is played by the SDK directly, so we return a sentinel blob.
      this.liveAdapter.sendUserMessage(text);
      const sentinel = new Blob([], { type: 'audio/wav' });
      if (this.onPartnerResponseReadyCallback) {
        this.onPartnerResponseReadyCallback(sentinel);
      }
      return sentinel;
    }

    try {
      const response = await this.sendTextToConvAIWithTimeout(text);
      this.conversationHistory.push(`[PARTNER] Response at ${Date.now()}`);
      this.retryCount = 0;

      if (this.onPartnerResponseReadyCallback) {
        this.onPartnerResponseReadyCallback(response);
      }

      return response;
    } catch (error) {
      if (this.isTimeoutError(error)) {
        return this.handleTimeout(() => this.sendTextToConvAIWithTimeout(text));
      }

      this.handleError('ConversationalAI', error);
      throw error;
    }
  }

  /**
   * Get the partner's final choice based on trust context
   * Validates: Requirements 8.3, 8.4
   * 
   * @param trustContext - Trust context string for the AI to consider
   * @returns Promise resolving to the partner's FinalChoice
   */
  async getFinalChoice(trustContext: string): Promise<FinalChoice> {
    if (!this.conversationSession || !this.conversationSession.isActive) {
      throw new Error('No active conversation session');
    }

    try {
      if (this.liveEnabled && this.liveAdapter) {
        this.liveAdapter.sendContextualUpdate(
          `[FINAL_CHOICE_REQUEST] ${trustContext}`,
        );
        this.liveAdapter.sendUserMessage(
          'Make your final choice now. Call the finalChoice client tool with {"choice": "Cooperate"} or {"choice": "Defect"}.',
        );

        const livePromise = new Promise<FinalChoice>((resolve) => {
          this.pendingFinalChoiceResolver = resolve;
        });
        // Safety net: if the agent never calls the tool within the timeout,
        // fall back to the cue-based decision so the game cannot deadlock.
        const fallbackMs = 30_000;
        const timeoutPromise = new Promise<FinalChoice>((resolve) => {
          setTimeout(async () => {
            if (!this.pendingFinalChoiceResolver) return;
            this.pendingFinalChoiceResolver = null;
            const fallback = await this.requestFinalChoiceFromConvAI({
              conversationHistory: this.conversationHistory,
              trustContext,
              timestamp: Date.now(),
            });
            resolve(fallback);
          }, fallbackMs);
        });

        const choice = await Promise.race([livePromise, timeoutPromise]);
        this.conversationHistory.push(`[FINAL_CHOICE] Partner chose: ${choice}`);
        return choice;
      }

      // Mock path — cue-based choice derived from the trust context string.
      const choice = await this.requestFinalChoiceFromConvAI({
        conversationHistory: this.conversationHistory,
        trustContext,
        timestamp: Date.now(),
      });
      this.conversationHistory.push(`[FINAL_CHOICE] Partner chose: ${choice}`);
      return choice;
    } catch (error) {
      this.handleError('ConversationalAI', error);
      throw error;
    }
  }

  /**
   * Play a pre-generated TTS line from cache
   * Validates: Requirements 10.3
   * 
   * @param lineKey - Key for the TTS line (e.g., "opening_monologue", "ending_release")
   * @returns Promise resolving to audio blob
   */
  async playTTSLine(lineKey: string): Promise<Blob> {
    // Check cache first
    if (this.audioCache.has(lineKey)) {
      return this.audioCache.get(lineKey)!;
    }

    // Check manifest
    if (!this.audioManifest) {
      throw new Error('Audio manifest not loaded');
    }

    const ttsUrl = this.audioManifest.ttsLines.get(lineKey);
    if (!ttsUrl) {
      const error: ElevenLabsError = {
        apiName: 'TTS',
        statusCode: 404,
        message: `TTS line not found: ${lineKey}`,
        isRetryable: false,
        assetKey: lineKey,
      };
      this.handleError('TTS', error);
      throw error;
    }

    try {
      // Fetch the pre-generated audio file
      const response = await fetch(ttsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch TTS line: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Cache for future use
      this.audioCache.set(lineKey, blob);
      
      return blob;
    } catch (error) {
      this.handleError('TTS', error);
      throw error;
    }
  }

  /**
   * Play a sound effect from cache
   * Validates: Requirements 10.4
   * 
   * @param sfxKey - SFX key enum value
   * @returns Promise resolving to audio blob
   */
  async playSFX(sfxKey: SFXKey): Promise<Blob> {
    // Check cache first
    const cacheKey = `sfx:${sfxKey}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    // Check manifest
    if (!this.audioManifest) {
      throw new Error('Audio manifest not loaded');
    }

    const sfxUrl = this.audioManifest.sfxClips.get(sfxKey);
    if (!sfxUrl) {
      const error: ElevenLabsError = {
        apiName: 'SFX',
        statusCode: 404,
        message: `SFX clip not found: ${sfxKey}`,
        isRetryable: false,
        assetKey: sfxKey,
      };
      this.handleError('SFX', error);
      throw error;
    }

    try {
      const response = await fetch(sfxUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch SFX: ${response.status}`);
      }
      
      const blob = await response.blob();
      this.audioCache.set(cacheKey, blob);
      
      return blob;
    } catch (error) {
      this.handleError('SFX', error);
      throw error;
    }
  }

  /**
   * Play music track for a narrative beat
   * Validates: Requirements 10.5
   * 
   * @param beat - Narrative beat to get music for
   * @returns Promise resolving to audio blob
   */
  async playMusicTrack(beat: NarrativeBeat): Promise<Blob> {
    const cacheKey = `music:${beat}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    if (!this.audioManifest) {
      throw new Error('Audio manifest not loaded');
    }

    const musicUrl = this.audioManifest.musicTracks.get(beat);
    if (!musicUrl) {
      const error: ElevenLabsError = {
        apiName: 'Music',
        statusCode: 404,
        message: `Music track not found for beat: ${beat}`,
        isRetryable: false,
        assetKey: beat,
      };
      this.handleError('Music', error);
      throw error;
    }

    try {
      const response = await fetch(musicUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch music: ${response.status}`);
      }
      
      const blob = await response.blob();
      this.audioCache.set(cacheKey, blob);
      
      return blob;
    } catch (error) {
      this.handleError('Music', error);
      throw error;
    }
  }

  /**
   * Play ending sting
   * Validates: Requirements 10.5
   * 
   * @param ending - Ending type to get sting for
   * @returns Promise resolving to audio blob
   */
  async playEndingSting(ending: EndingType): Promise<Blob> {
    const cacheKey = `ending:${ending}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    if (!this.audioManifest) {
      throw new Error('Audio manifest not loaded');
    }

    const stingUrl = this.audioManifest.endingStings.get(ending);
    if (!stingUrl) {
      const error: ElevenLabsError = {
        apiName: 'Music',
        statusCode: 404,
        message: `Ending sting not found for: ${ending}`,
        isRetryable: false,
        assetKey: ending,
      };
      this.handleError('Music', error);
      throw error;
    }

    try {
      const response = await fetch(stingUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch ending sting: ${response.status}`);
      }
      
      const blob = await response.blob();
      this.audioCache.set(cacheKey, blob);
      
      return blob;
    } catch (error) {
      this.handleError('Music', error);
      throw error;
    }
  }

  /**
   * Load the audio asset manifest
   * Validates: Requirements 10.3, 10.4, 10.5, 10.6
   * 
   * @param manifestUrl - URL to the manifest JSON file
   * @returns Promise resolving when manifest is loaded
   */
  async loadAudioManifest(manifestUrl: string): Promise<AudioAssetManifest> {
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status}`);
      }
      
      const manifestData = await response.json();

      const ttsLines = new Map<string, string>(
        Object.entries(manifestData.ttsLines ?? {}) as [string, string][],
      );
      const sfxClips = new Map<SFXKey, string>(
        Object.entries(manifestData.sfxClips ?? {}) as [SFXKey, string][],
      );
      const musicTracks = new Map<NarrativeBeat, string>(
        Object.entries(manifestData.musicTracks ?? {}) as [NarrativeBeat, string][],
      );
      const endingStings = new Map<EndingType, string>(
        Object.entries(manifestData.endingStings ?? {}) as [EndingType, string][],
      );

      this.audioManifest = {
        partnerVoiceId: manifestData.partnerVoiceId || this.partnerVoiceId,
        ttsLines,
        sfxClips,
        musicTracks,
        endingStings,
      };

      this.validateManifest();

      return this.audioManifest;
    } catch (error) {
      this.handleError('TTS', error);
      throw error;
    }
  }

  /**
   * Validate that all required assets are present in the manifest
   * Validates: Requirement 10.6
   */
  private validateManifest(): void {
    if (!this.audioManifest) {
      throw new Error('Audio manifest not loaded');
    }

    const missingAssets: string[] = [];

    // Check required SFX keys
    const requiredSFX = [
      SFXKey.DoorLock,
      SFXKey.DoorUnlock,
      SFXKey.RadioStaticStart,
      SFXKey.RadioStaticEnd,
      SFXKey.ObjectInteract,
      SFXKey.CooperateButtonClick,
      SFXKey.DefectButtonClick,
      SFXKey.LockedDoorThud,
      SFXKey.SignalLost,
      SFXKey.StaticBurst,
    ];

    for (const key of requiredSFX) {
      if (!this.audioManifest.sfxClips.has(key)) {
        missingAssets.push(`SFX: ${key}`);
      }
    }

    // Check required music tracks for each beat
    const requiredBeats = [
      NarrativeBeat.Opening,
      NarrativeBeat.Rising,
      NarrativeBeat.Midpoint,
      NarrativeBeat.Climb,
      NarrativeBeat.Climax,
    ];

    for (const beat of requiredBeats) {
      if (!this.audioManifest.musicTracks.has(beat)) {
        missingAssets.push(`Music: ${beat}`);
      }
    }

    // Check required ending stings
    const requiredEndings = [
      EndingType.Release,
      EndingType.LeftBehind,
      EndingType.Alone,
      EndingType.Reset,
    ];

    for (const ending of requiredEndings) {
      if (!this.audioManifest.endingStings.has(ending)) {
        missingAssets.push(`Ending: ${ending}`);
      }
    }

    if (missingAssets.length > 0) {
      const error: ElevenLabsError = {
        apiName: 'TTS',
        statusCode: 400,
        message: `Missing required audio assets: ${missingAssets.join(', ')}`,
        isRetryable: false,
        assetKey: missingAssets[0],
      };
      this.handleError('TTS', error);
      throw new Error(`Build error: Missing audio assets - ${missingAssets.join(', ')}`);
    }
  }

  /**
   * Handle microphone unavailability
   * Validates: Requirement 2.5
   * 
   * Shows HUD error and activates text-input fallback
   */
  handleMicrophoneUnavailable(): void {
    // Notify listeners to show text input fallback
    if (this.onTextInputFallbackCallback) {
      this.onTextInputFallbackCallback();
    }
    
    // Emit error
    const error: ElevenLabsError = {
      apiName: 'ConversationalAI',
      statusCode: 0,
      message: 'Microphone unavailable or permission denied',
      isRetryable: false,
      assetKey: null,
    };
    
    if (this.onAPIErrorCallback) {
      this.onAPIErrorCallback(error);
    }
  }

  /**
   * End the current conversation session
   */
  async endSession(): Promise<void> {
    if (this.liveEnabled && this.liveAdapter) {
      await this.liveAdapter.endSession();
    }
    if (this.conversationSession) {
      this.conversationSession.isActive = false;
      this.conversationSession = null;
    }

    this.sessionState = SessionState.Idle;
    this.conversationHistory = [];
    this.retryCount = 0;
  }

  /**
   * Inject a trust event message into the conversation context
   * Used by TrustEventReporter
   */
  injectTrustEvent(message: string): void {
    this.conversationHistory.push(message);
    if (this.liveEnabled && this.liveAdapter) {
      this.liveAdapter.sendContextualUpdate(message);
    }
  }

  /**
   * Inject a general-purpose agent-context message into the conversation
   * history. Used by wireBeatKnowledgeInjection / wireBeatToneInjection to
   * feed per-puzzle partnerKnowledge and tone hints into the agent.
   * Validates: Requirements 3.3, 5.1, 6.8
   */
  injectAgentContext(message: string): void {
    this.conversationHistory.push(message);
    if (this.liveEnabled && this.liveAdapter) {
      this.liveAdapter.sendContextualUpdate(message);
    }
  }

  // Private helper methods

  /**
   * Send audio to ConvAI with timeout
   */
  private async sendToConvAIWithTimeout(_audioBlob: Blob): Promise<Blob> {
    await this.raceWithTimeout(this.simulateNetworkDelay);
    return new Blob(['mock-partner-audio'], { type: 'audio/wav' });
  }

  /**
   * Send text to ConvAI with timeout
   */
  private async sendTextToConvAIWithTimeout(_text: string): Promise<Blob> {
    await this.raceWithTimeout(this.simulateNetworkDelay);
    return new Blob(['mock-partner-audio'], { type: 'audio/wav' });
  }

  /**
   * Race a bound async operation against the service's configured timeout
   * (Requirement 3.6). When the deadline fires, we reject with an AbortError
   * so handleTimeout() can run the static-burst + signal-lost + retry path.
   */
  private async raceWithTimeout<T>(op: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const deadline = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        controller.abort();
        const err = new Error('ConvAI timeout');
        err.name = 'AbortError';
        reject(err);
      }, this.timeoutMs);
      // Cancel the timer if op settles first.
      controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
    });
    try {
      return (await Promise.race([op.call(this, controller.signal), deadline])) as T;
    } finally {
      controller.abort();
    }
  }

  /**
   * Request final choice from ConvAI.
   * Mock implementation: maps trust context hints onto a reasoned-looking choice
   * so the ending routing in the app does not collapse to Pending.
   */
  private async requestFinalChoiceFromConvAI(request: {
    conversationHistory: string[];
    trustContext: string;
    timestamp: number;
  }): Promise<FinalChoice> {
    await this.simulateNetworkDelay();

    const ctx = (request.trustContext ?? '').toLowerCase();
    const lowCues = ['lied', 'withheld', 'contradict', 'broke', 'distrust', 'low trust'];
    const highCues = ['shared', 'reassur', 'promise', 'trust', 'high trust', 'cooperative'];
    const lowScore = lowCues.reduce((acc, c) => acc + (ctx.includes(c) ? 1 : 0), 0);
    const highScore = highCues.reduce((acc, c) => acc + (ctx.includes(c) ? 1 : 0), 0);

    if (lowScore > highScore) return FinalChoice.Defect;
    if (highScore > lowScore) return FinalChoice.Cooperate;
    // Fall back to mild bias on history length so repeated tests don't all hit Pending.
    return request.conversationHistory.length % 2 === 0
      ? FinalChoice.Cooperate
      : FinalChoice.Defect;
  }

  /**
   * Handle timeout with retry logic.
   * Validates: Requirement 3.6
   *
   * @param retryFn Async operation to retry (the same call that just timed
   * out, wrapped so raceWithTimeout can re-enter it).
   */
  private async handleTimeout(retryFn: () => Promise<Blob>): Promise<Blob> {
    if (this.audioManifest) {
      try {
        await this.playSFX(SFXKey.StaticBurst);
      } catch {
        // Ignore SFX errors during timeout handling
      }
    }

    if (this.onSignalLostCallback) {
      this.onSignalLostCallback();
    }

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      try {
        const response = await retryFn();
        this.retryCount = 0;
        return response;
      } catch (err) {
        // Fall through to the terminal error below.
        void err;
      }
    }

    const error: ElevenLabsError = {
      apiName: 'ConversationalAI',
      statusCode: 408,
      message: 'ConvAI timeout after retry',
      isRetryable: true,
      assetKey: null,
    };

    this.handleError('ConversationalAI', error);
    throw new Error('Signal lost - unable to reach partner');
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.name === 'AbortError' || 
             error.message.includes('timeout') ||
             error.message.includes('Timeout');
    }
    return false;
  }

  /**
   * Handle API errors
   */
  private handleError(apiName: ElevenLabsError['apiName'], error: unknown): void {
    // If error is already an ElevenLabsError, use it directly
    if (this.isElevenLabsError(error)) {
      if (this.onAPIErrorCallback) {
        this.onAPIErrorCallback(error);
      }
      return;
    }

    const elevenLabsError: ElevenLabsError = {
      apiName,
      statusCode: error instanceof Error ? 500 : 0,
      message: error instanceof Error ? error.message : 'Unknown error',
      isRetryable: apiName === 'ConversationalAI',
      assetKey: null,
    };

    if (this.onAPIErrorCallback) {
      this.onAPIErrorCallback(elevenLabsError);
    }
  }

  /**
   * Type guard to check if error is an ElevenLabsError
   */
  private isElevenLabsError(error: unknown): error is ElevenLabsError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'apiName' in error &&
      'statusCode' in error &&
      'message' in error &&
      'isRetryable' in error &&
      'assetKey' in error
    );
  }

  /**
   * Simulate network delay for mock implementation. Accepts an AbortSignal
   * so raceWithTimeout can actually interrupt it — this is what makes the
   * timeout/retry path exercisable in tests.
   */
  private async simulateNetworkDelay(signal?: AbortSignal): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
        return;
      }
      const timeoutId = setTimeout(resolve, this.simulatedDelayMs);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timeoutId);
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        },
        { once: true },
      );
    });
  }
}

// Singleton instance
let elevenLabsServiceInstance: ElevenLabsService | null = null;

/**
 * Get the singleton ElevenLabsService instance
 */
export function getElevenLabsService(): ElevenLabsService {
  if (!elevenLabsServiceInstance) {
    // Default configuration - should be set via initializeElevenLabsService
    elevenLabsServiceInstance = new ElevenLabsService(
      '',
      '',
      ''
    );
  }
  return elevenLabsServiceInstance;
}

/**
 * Initialize the ElevenLabsService singleton with configuration
 */
export function initializeElevenLabsService(
  apiKey: string,
  agentId: string,
  partnerVoiceId: string
): ElevenLabsService {
  elevenLabsServiceInstance = new ElevenLabsService(apiKey, agentId, partnerVoiceId);
  return elevenLabsServiceInstance;
}

/**
 * Reset the ElevenLabsService singleton and its live adapter (if any).
 */
export function resetElevenLabsService(): void {
  if (elevenLabsServiceInstance) {
    elevenLabsServiceInstance.endSession();
  }
  elevenLabsServiceInstance = null;
  resetLiveAdapter();
}
