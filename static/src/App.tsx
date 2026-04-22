import { useEffect, useRef, useState } from 'react';
import { useGameStateStore } from './stores/gameStateStore';
import { getTrustEventReporter, getTrustImpact } from './services/TrustEventReporter';
import { TrustEventType } from './types/trust';
import { NarrativeBeat } from './types/narrative';
import { FinalChoice } from './types/choices';
import { Scene } from './components/Scene';
import { RevealPanel } from './components/RevealPanel';
import { EndingScreen } from './components/EndingScreen';
import { useAudioManager } from './hooks/useAudioManager';
import { usePTT } from './hooks/usePTT';
import { audioBus } from './services/audioBus';
import { getElevenLabsService } from './services/ElevenLabsService';
import { buildFullSystemPrompt, PARTNER_INITIAL_MEMORY } from './config/agentConfig';
import { buildTrustContext } from './services/trustContextBuilder';
import {
  buildBeatKnowledgeInjection,
  buildToneInstruction,
} from './services/agentContextInjection';
import { runEnding } from './services/endingOrchestrator';
import './App.css';

// Decided once at module load so the hook order is stable across renders
// (window resize on desktop shouldn't flip into a mobile notice mid-game).
const IS_MOBILE = (() => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaHit = /Mobi|Android|iPhone|iPad|iPod|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i.test(ua);
  const narrow = window.innerWidth < 820;
  const noFinePointer = 'ontouchstart' in window && !window.matchMedia?.('(pointer: fine)').matches;
  return uaHit || narrow || noFinePointer;
})();

export default function App() {
  if (IS_MOBILE) {
    return (
      <div className="mobile-notice">
        <div className="mobile-title">WALKIE TALKIE</div>
        <div className="mobile-sub">Open on a desktop or laptop.</div>
        <div className="mobile-body">
          This game needs a keyboard, mouse, and microphone to play. Visit this
          URL from a computer to begin.
        </div>
      </div>
    );
  }
  const hasStarted = useGameStateStore((s) => s.hasStarted);
  const currentBeat = useGameStateStore((s) => s.currentBeat);
  const solvedPuzzleCount = useGameStateStore((s) => s.solvedPuzzleCount);
  const totalPuzzles = useGameStateStore((s) => s.totalPuzzles);
  const endingType = useGameStateStore((s) => s.endingType);
  const gameEnded = useGameStateStore((s) => s.gameEnded);
  const playerFinalChoice = useGameStateStore((s) => s.playerFinalChoice);
  const partnerFinalChoice = useGameStateStore((s) => s.partnerFinalChoice);
  const interactionPrompt = useGameStateStore((s) => s.interactionPrompt);
  const revealedContent = useGameStateStore((s) => s.revealedContent);
  const midGameRevealTriggered = useGameStateStore((s) => s.midGameRevealTriggered);

  const startGame = useGameStateStore((s) => s.startGame);
  const advanceBeat = useGameStateStore((s) => s.advanceBeat);
  const setPlayerFinalChoice = useGameStateStore((s) => s.setPlayerFinalChoice);
  const setPartnerFinalChoice = useGameStateStore((s) => s.setPartnerFinalChoice);
  const resolveEnding = useGameStateStore((s) => s.resolveEnding);
  const resetGame = useGameStateStore((s) => s.resetGame);
  const closeReveal = useGameStateStore((s) => s.closeReveal);
  const setLightingMode = useGameStateStore((s) => s.setLightingMode);
  const setDoorsMode = useGameStateStore((s) => s.setDoorsMode);
  const lightingMode = useGameStateStore((s) => s.lightingMode);

  // Force a re-render when the reporter fires events (it's not zustand).
  const [, bump] = useState(0);
  const forceUpdate = () => bump((n) => n + 1);
  const reporter = getTrustEventReporter();

  // Audio manager: initialized on the first user gesture (Begin transmission).
  const audio = useAudioManager();
  const audioInitialized = useRef(false);
  const sessionInitialized = useRef(false);
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const captionTimeoutRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);

  // PTT is enabled only when actually in-game and not buried in a reveal.
  const pttEnabled = hasStarted && !gameEnded && !revealedContent;
  const { state: pttState, inputLevel } = usePTT({ enabled: pttEnabled });

  // Mode indicator so the HUD tells you whether live ConvAI is wired.
  const serviceMode: 'live' | 'mock' = getElevenLabsService().isLiveMode()
    ? 'live'
    : 'mock';

  // Wire trust events → live ConvAI context (no-op in mock mode).
  useEffect(() => {
    reporter.setOnReport((_event, formatted) => {
      const service = getElevenLabsService();
      if (service.isLiveMode()) service.injectAgentContext(formatted);
    });
    return () => reporter.setOnReport(null);
  }, [reporter]);

  // Subscribe to live partner-speaking + error + transcript callbacks.
  useEffect(() => {
    const service = getElevenLabsService();
    service.setOnPartnerSpeakingChange(setPartnerSpeaking);
    service.setOnError((msg) => {
      console.warn('[elevenlabs] live error:', msg);
      setLiveError(msg);
    });
    service.setOnPartnerText((text) => {
      if (!text) return;
      setCaption(text);
      if (captionTimeoutRef.current) window.clearTimeout(captionTimeoutRef.current);
      // Fade out after a grace period — long enough to read a full line.
      const linger = Math.min(12_000, 3_000 + text.length * 45);
      captionTimeoutRef.current = window.setTimeout(() => setCaption(null), linger);
    });
    return () => {
      service.setOnPartnerSpeakingChange(null);
      service.setOnError(null);
      service.setOnPartnerText(null);
      if (captionTimeoutRef.current) window.clearTimeout(captionTimeoutRef.current);
    };
  }, []);

  // Intercom radio hiss tracks the partner-speaking signal so their voice
  // feels like it's coming through a squelchy radio.
  useEffect(() => {
    audio.setIntercomHiss(partnerSpeaking);
  }, [partnerSpeaking, audio]);

  // Mic permission state surfaced to the HUD so the user can tell if the
  // browser blocked the site without opening DevTools → Site Settings.
  const [micPermission, setMicPermission] = useState<PermissionState | 'unknown'>('unknown');
  useEffect(() => {
    if (!navigator.permissions) {
      setMicPermission('unknown');
      return;
    }
    let cancelled = false;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (cancelled) return;
        setMicPermission(status.state);
        status.onchange = () => setMicPermission(status.state);
      })
      .catch(() => {
        if (!cancelled) setMicPermission('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Publish audio handlers onto the module-level bus so non-React code
  // (InteractableProp.onInteract closures, registry callbacks) can trigger
  // SFX without subscribing to the zustand tree.
  useEffect(() => {
    audioBus.playSFX = audio.playSFX;
    audioBus.playTTSLine = audio.playTTSLine;
    audioBus.setMusicBeat = audio.setMusicBeat;
    return () => {
      audioBus.playSFX = undefined;
      audioBus.playTTSLine = undefined;
      audioBus.setMusicBeat = undefined;
    };
  }, [audio.playSFX, audio.playTTSLine, audio.setMusicBeat]);

  // When an ending resolves, run the orchestrator (TTS + sting + lighting + doors).
  const endingAudioRan = useRef(false);
  useEffect(() => {
    if (!gameEnded || !endingType) {
      endingAudioRan.current = false;
      return;
    }
    if (endingAudioRan.current) return;
    endingAudioRan.current = true;
    void runEnding(endingType, {
      playTTSLine: (key) => audio.playTTSLine(key),
      playEndingSting: (t) => audio.playEndingSting(t),
      setLighting: (mode) => setLightingMode(mode),
      setDoorsMode: (mode) => {
        // Orchestrator's 'keep' means "don't touch current doors state".
        if (mode === 'keep') return;
        setDoorsMode(mode);
      },
    });
  }, [gameEnded, endingType, audio, setLightingMode, setDoorsMode]);

  // Scripted mid-game reveal partner reaction. Fires exactly once when
  // the classified memo is first read — pushes a scripted user message
  // so the partner reacts in character via ConvAI.
  const midGameReactionSent = useRef(false);
  useEffect(() => {
    if (!midGameRevealTriggered) {
      midGameReactionSent.current = false;
      return;
    }
    if (midGameReactionSent.current) return;
    midGameReactionSent.current = true;
    const service = getElevenLabsService();
    if (service.isLiveMode()) {
      service.sendUserMessage(
        '[SCRIPTED_EVENT] I just read a classified memo claiming only one of the exit codes will actually work — the other is a decoy. React to this, in character, briefly. Ask me what I intend to do. Do not confirm or deny whether the memo is true.',
      );
    }
  }, [midGameRevealTriggered]);

  // Follow beat changes → music level + agent context.
  useEffect(() => {
    if (!audio.isReady) return;
    void audio.setMusicBeat(currentBeat);

    // Push per-beat puzzle knowledge + tone hint into the live agent.
    // Mock mode just drops these onto the conversationHistory log.
    if (!hasStarted) return;
    const service = getElevenLabsService();
    if (!service.isLiveMode()) return;

    const knowledge = buildBeatKnowledgeInjection(currentBeat);
    if (knowledge) service.injectAgentContext(knowledge);
    service.injectAgentContext(
      buildToneInstruction(currentBeat, reporter.getTotalImpact()),
    );
  }, [audio.isReady, audio.setMusicBeat, currentBeat, hasStarted, reporter]);

  const fireTrust = (type: TrustEventType) => {
    reporter.reportEvent(type, `round-6 demo event for ${type}`);
    forceUpdate();
  };

  const [askingPartner, setAskingPartner] = useState(false);

  const requestPartnerChoice = async () => {
    if (askingPartner) return;
    setAskingPartner(true);
    try {
      const service = getElevenLabsService();
      const choice = await service.getFinalChoice(buildTrustContext());
      setPartnerFinalChoice(choice);
    } catch (err) {
      console.warn('[elevenlabs] getFinalChoice failed:', err);
      setPartnerFinalChoice(FinalChoice.Cooperate);
    } finally {
      setAskingPartner(false);
    }
  };

  // Esc closes reveal panel; P toggles the debug HUD.
  const [debugVisible, setDebugVisible] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && revealedContent) {
        closeReveal();
      }
      if ((e.key === 'p' || e.key === 'P') && !revealedContent) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        setDebugVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealedContent, closeReveal]);

  // Re-acquire pointer lock after a reveal panel closes so the player
  // doesn't have to click the canvas to keep moving. Only fires on the
  // open→closed transition.
  const wasRevealedRef = useRef(false);
  useEffect(() => {
    const wasRevealed = wasRevealedRef.current;
    wasRevealedRef.current = revealedContent !== null;
    if (!wasRevealed || revealedContent !== null) return;
    if (!hasStarted || gameEnded) return;
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    // requestPointerLock returns a Promise in modern Chrome; swallow errors.
    try {
      const result = canvas.requestPointerLock?.();
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {});
      }
    } catch {
      /* fall through — user can click canvas to re-lock */
    }
  }, [revealedContent, hasStarted, gameEnded]);

  const atClimax = currentBeat === NarrativeBeat.Climax;
  const allPuzzlesSolved = solvedPuzzleCount >= totalPuzzles;

  if (!hasStarted) {
    if (loading) {
      return (
        <div className="loading-screen">
          <span className="loading-word">loading</span>
          <span className="loading-dots">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </div>
      );
    }

    const handlePlay = async () => {
      setLoading(true);
      try {
        if (!audioInitialized.current) {
          audioInitialized.current = true;
          await audio.initialize();
        }
        let liveSessionStarted = false;
        if (!sessionInitialized.current) {
          sessionInitialized.current = true;
          try {
            const service = getElevenLabsService();
            await service.startConversationSession(
              buildFullSystemPrompt(),
              PARTNER_INITIAL_MEMORY,
            );
            liveSessionStarted = service.isLiveMode();
          } catch (err) {
            console.warn('[elevenlabs] session start failed:', err);
          }
        } else {
          liveSessionStarted = getElevenLabsService().isLiveMode();
        }
        startGame();
        audio.startAmbientHum();
        if (!liveSessionStarted) {
          void audio.playTTSLine('opening_monologue');
        }
        void audio.setMusicBeat(NarrativeBeat.Opening);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="main-menu">
        <div className="main-menu-title">WALKIE TALKIE</div>
        <div className="main-menu-sub">a cooperative escape</div>
        <div className="main-menu-items">
          <button className="main-menu-btn" onClick={handlePlay}>
            play
          </button>
        </div>
        <div className="main-menu-controls">
          <span><kbd>WASD</kbd> move</span>
          <span><kbd>Mouse</kbd> look</span>
          <span><kbd>E</kbd> interact</span>
          <span><kbd>V</kbd> talk</span>
        </div>
      </div>
    );
  }

  if (gameEnded && endingType) {
    return (
      <div className="shell">
        <Scene movementEnabled={false} lightingMode={lightingMode} />
        <EndingScreen
          onReset={async () => {
            const service = getElevenLabsService();
            await service.endSession();
            sessionInitialized.current = false;
            audio.stopAmbientHum();
            audio.setIntercomHiss(false);
            setCaption(null);
            reporter.clear();
            resetGame();
            forceUpdate();
          }}
        />
      </div>
    );
  }

  // Movement is disabled while the reveal panel is open so the camera
  // doesn't drift around while the player reads / types.
  const movementEnabled = hasStarted && !gameEnded && !revealedContent;

  return (
    <div className="shell">
      <Scene movementEnabled={movementEnabled} lightingMode={lightingMode} />

      {interactionPrompt && !revealedContent && (
        <div className="interaction-prompt">
          <kbd>E</kbd> {interactionPrompt}
        </div>
      )}

      {pttState === 'transmitting' && (
        <div className="ptt-indicator">
          <span className="dot" /> transmitting · hold <kbd>V</kbd>
          <div className="ptt-meter">
            <div
              className="ptt-meter-fill"
              style={{ width: `${Math.min(100, Math.round(inputLevel * 140))}%` }}
            />
          </div>
        </div>
      )}
      {partnerSpeaking && pttState !== 'transmitting' && (
        <div className="ptt-indicator partner">
          <span className="dot" /> partner is speaking
        </div>
      )}
      {caption && <div className="caption-overlay">{caption}</div>}
      {liveError && (
        <div className="live-error" onClick={() => setLiveError(null)}>
          live error: {liveError} · click to dismiss
        </div>
      )}

      {!revealedContent && <div className="crosshair" aria-hidden />}

      {debugVisible && (
        <div className={`mic-pill mic-${micPermission}`} title="Microphone permission">
          mic: {micPermission}
        </div>
      )}

      {debugVisible && (
      <div className="panel wide overlay corner">
        <div className="row">
          <span className={`mode-tag ${serviceMode}`}>
            {serviceMode === 'live' ? 'LIVE ConvAI' : 'MOCK MODE'}
          </span>
          <span className="chip">beat</span>
          <strong>{currentBeat}</strong>
          <span className="chip">puzzles</span>
          <strong>
            {solvedPuzzleCount} / {totalPuzzles}
          </strong>
          <span className="chip">trust</span>
          <strong>{reporter.getTotalImpact()}</strong>
          {midGameRevealTriggered && <span className="memo-tag">memo read</span>}
        </div>

        <div className="row wrap">
          <button className="btn" onClick={advanceBeat}>
            advance beat
          </button>
          <button
            className="btn ghost"
            onClick={async () => {
              const service = getElevenLabsService();
              await service.endSession();
              sessionInitialized.current = false;
              audio.stopAmbientHum();
              audio.setIntercomHiss(false);
              setCaption(null);
              reporter.clear();
              resetGame();
              forceUpdate();
            }}
          >
            reset
          </button>
        </div>

        <div className="divider" />

        <div className="label">trust events</div>
        <div className="row wrap">
          {Object.values(TrustEventType).map((t) => (
            <button key={t} className="btn small" onClick={() => fireTrust(t)}>
              {t} <span className="delta">{formatDelta(getTrustImpact(t))}</span>
              <span className="count">× {reporter.getCountByType(t)}</span>
            </button>
          ))}
        </div>

        {atClimax && allPuzzlesSolved && (
          <>
            <div className="divider" />
            <div className="label">final choice</div>
            <div className="row wrap">
              <button
                className="btn coop"
                disabled={playerFinalChoice !== FinalChoice.Pending}
                onClick={() => setPlayerFinalChoice(FinalChoice.Cooperate)}
              >
                player cooperate
              </button>
              <button
                className="btn defect"
                disabled={playerFinalChoice !== FinalChoice.Pending}
                onClick={() => setPlayerFinalChoice(FinalChoice.Defect)}
              >
                player defect
              </button>
              <button
                className="btn"
                disabled={partnerFinalChoice !== FinalChoice.Pending || askingPartner}
                onClick={requestPartnerChoice}
              >
                {askingPartner ? 'awaiting partner…' : 'ask partner'}
              </button>
              <button
                className="btn coop small"
                disabled={partnerFinalChoice !== FinalChoice.Pending}
                onClick={() => setPartnerFinalChoice(FinalChoice.Cooperate)}
              >
                force coop (dev)
              </button>
              <button
                className="btn defect small"
                disabled={partnerFinalChoice !== FinalChoice.Pending}
                onClick={() => setPartnerFinalChoice(FinalChoice.Defect)}
              >
                force defect (dev)
              </button>
              <button
                className="btn"
                disabled={
                  playerFinalChoice === FinalChoice.Pending ||
                  partnerFinalChoice === FinalChoice.Pending
                }
                onClick={resolveEnding}
              >
                resolve ending
              </button>
            </div>
          </>
        )}
      </div>
      )}

      <RevealPanel />
    </div>
  );
}

function formatDelta(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
