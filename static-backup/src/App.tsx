import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import './App.css';

import { PlayerController } from './components/PlayerController';
import { RoomScene, createInitialRooms } from './components/RoomScene';
import { InteractableProp } from './components/InteractableProp';
import { PTTIndicator } from './components/PTTIndicator';
import { InteractionPrompt } from './components/InteractionPrompt';
import { TitleScreen } from './components/TitleScreen';
import { FinalChoiceUI } from './components/FinalChoiceUI';
import { EndingScreen } from './components/EndingScreen';
import { SignalLostMessage } from './components/SignalLostMessage';
import { useGameStateStore } from './stores/gameStateStore';
import { useRoomManager } from './hooks/useRoomManager';
import { usePuzzleSystem } from './hooks/usePuzzleSystem';
import { useAudioManager } from './hooks/useAudioManager';
import { usePTT, PTTState } from './hooks/usePTT';
import { allPropsByRoom, getAllPuzzleDefinitions } from './puzzles/puzzleInstances';
import { initializeServices } from './services/bootstrap';
import { getElevenLabsService } from './services/ElevenLabsService';
import { wireBeatKnowledgeInjection } from './services/agentContextInjection';
import { wireBeatToneInjection } from './services/beatToneInjection';
import { getTrustEventReporter } from './services/TrustEventReporter';
import { runEnding } from './services/endingOrchestrator';
import { runMidGameReveal } from './services/midGameRevealOrchestrator';
import { agentConfig, buildFullSystemPrompt } from './config/agentConfig';
import { NarrativeBeat, SFXKey } from './types';
import type { Prop } from './types';

const PROP_POSITIONS: Record<string, [number, number, number]> = {
  prop_glyph_room1: [-3, -1, -3],
  prop_note_room1: [3, -1, -3],
  prop_object_room2: [-3, -1, 11],
  prop_sequence_blue: [-3, -1, 15],
  prop_sequence_green: [-1, -1, 15],
  prop_sequence_yellow: [1, -1, 15],
  prop_sequence_red: [3, -1, 15],
  prop_midgame_reveal: [3, -1, 17],
};

interface PropEntry {
  prop: Prop;
  position: [number, number, number];
}

/**
 * Per-ending lighting multiplier. Normal=full, dim=reduced, cut=dark.
 * Validates: Requirements 9.3, 9.5
 */
function lightingIntensity(mode: 'normal' | 'dim' | 'cut'): number {
  switch (mode) {
    case 'normal':
      return 1;
    case 'dim':
      return 0.3;
    case 'cut':
      return 0.05;
  }
}

function HUD({ pttState, onPlaySFX }: { pttState: PTTState; onPlaySFX: (key: SFXKey) => Promise<void> }) {
  const beat = useGameStateStore((s) => s.currentBeat);
  const solvedCount = useGameStateStore((s) => s.solvedPuzzleCount);
  const totalPuzzles = useGameStateStore((s) => s.totalPuzzles);
  const midGameRevealTriggered = useGameStateStore((s) => s.midGameRevealTriggered);
  const hasStarted = useGameStateStore((s) => s.hasStarted);

  if (!hasStarted) return null;

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-tag">STATIC</div>
        <div className="hud-meta">
          <span>Beat: {beat}</span>
          <span>Puzzles: {solvedCount}/{totalPuzzles}</span>
          {midGameRevealTriggered && <span className="hud-alert">Memo read</span>}
        </div>
        <div className="hud-hint">
          <kbd>V</kbd> talk · <kbd>E</kbd> interact · <kbd>WASD</kbd> move · click to lock pointer
        </div>
      </div>

      <InteractionPrompt />
      <RevealPanel />
      <PTTIndicator pttState={pttState} visible={pttState !== PTTState.Idle} />
      <FinalChoiceUI onPlaySFX={onPlaySFX} />
      <SignalLostMessage />
      <EndingScreen />
    </div>
  );
}

function RevealPanel() {
  const revealed = useGameStateStore((s) => s.currentRevealedContent);
  const setRevealed = useGameStateStore((s) => s.setRevealedContent);
  const [solutionInput, setSolutionInput] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const { submitSolution } = usePuzzleSystem();

  const linkedPuzzleId = useMemo(() => {
    if (!revealed) return null;
    for (const props of Object.values(allPropsByRoom)) {
      const hit = props.find((p) => p.revealContent === revealed);
      if (hit) return hit.puzzleId;
    }
    return null;
  }, [revealed]);

  if (!revealed) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedPuzzleId) return;
    const ok = await submitSolution(linkedPuzzleId, solutionInput.trim());
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) {
      setSolutionInput('');
      setTimeout(() => {
        setRevealed(null);
        setFeedback('idle');
      }, 800);
    } else {
      setTimeout(() => setFeedback('idle'), 1200);
    }
  };

  return (
    <div className="reveal-panel">
      <div className="reveal-content">{revealed}</div>
      {linkedPuzzleId && (
        <form onSubmit={onSubmit} className="reveal-form">
          <input
            autoFocus
            value={solutionInput}
            onChange={(e) => setSolutionInput(e.target.value)}
            placeholder="Enter solution"
          />
          <button type="submit">Submit</button>
          {feedback === 'correct' && <span className="reveal-ok">Correct</span>}
          {feedback === 'wrong' && <span className="reveal-bad">No match</span>}
        </form>
      )}
      <button className="reveal-close" onClick={() => setRevealed(null)}>
        Close
      </button>
    </div>
  );
}

function App() {
  const roomManager = useRoomManager();
  const setRooms = roomManager.setRooms;
  const setAllRoomsUnlocked = roomManager.setAllRoomsUnlocked;
  const sealAllRooms = roomManager.sealAllRooms;
  const onDoorAttemptedWhileLocked = roomManager.onDoorAttemptedWhileLocked;
  const registerPuzzle = usePuzzleSystem().registerPuzzle;
  const [propsReady, setPropsReady] = useState(false);

  const hasStarted = useGameStateStore((s) => s.hasStarted);
  const currentBeat = useGameStateStore((s) => s.currentBeat);
  const solvedPuzzleCount = useGameStateStore((s) => s.solvedPuzzleCount);
  const totalPuzzles = useGameStateStore((s) => s.totalPuzzles);
  const finalChoiceActive = useGameStateStore((s) => s.finalChoiceActive);
  const gameEnded = useGameStateStore((s) => s.gameEnded);
  const lightingMode = useGameStateStore((s) => s.lightingMode);
  const triggerFinalChoice = useGameStateStore((s) => s.triggerFinalChoice);
  const setSignalLost = useGameStateStore((s) => s.setSignalLost);
  const setLightingMode = useGameStateStore((s) => s.setLightingMode);
  const setDoorsSealedAfterEnding = useGameStateStore((s) => s.setDoorsSealedAfterEnding);

  const audio = useAudioManager();
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const ptt = usePTT({
    onPTTStart: () => {
      void audioRef.current.playPTTStartSFX();
    },
    onPTTEnd: () => {
      void audioRef.current.playPTTEndSFX();
    },
    onPartnerResponse: (blob) => {
      void audioRef.current.playPartnerResponse(blob);
    },
    onSignalLost: () => {
      setSignalLost(true);
    },
  });

  // One-shot bootstrap: service, rooms, puzzles, audio manifest, agent wiring.
  useEffect(() => {
    initializeServices({
      apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY ?? '',
      agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? '',
      partnerVoiceId:
        import.meta.env.VITE_ELEVENLABS_VOICE_ID ?? agentConfig.voiceId,
    });
    setRooms(createInitialRooms());

    const service = getElevenLabsService();
    service.onSignalLost = () => setSignalLost(true);
    // Fix 1: overlay radio static under the SDK's direct audio output so
    // live ConvAI replies still sound like they're coming through an intercom.
    service.onPartnerSpeakingChange = (speaking) => {
      if (speaking) {
        void audioRef.current.playPTTStartSFX();
        void audioRef.current.startIntercomHiss();
      } else {
        audioRef.current.stopIntercomHiss();
        void audioRef.current.playPTTEndSFX();
      }
    };

    let unwireBeatKnowledge: (() => void) | null = null;
    let unwireBeatTone: (() => void) | null = null;

    (async () => {
      const defs = await getAllPuzzleDefinitions();
      defs.forEach((def) => registerPuzzle(def));
      try {
        await audioRef.current.loadManifest();
      } catch (err) {
        console.warn('Audio manifest failed to load', err);
      }
      // Task 18.2: every puzzle's partnerKnowledge is injected when its beat begins.
      unwireBeatKnowledge = wireBeatKnowledgeInjection(service, () => defs);
      // Task 22.1: partner tone instructions flow into context on each beat.
      const reporter = getTrustEventReporter();
      unwireBeatTone = wireBeatToneInjection(service, () =>
        reporter.getTotalTrustImpact(),
      );
      setPropsReady(true);
    })();

    return () => {
      unwireBeatKnowledge?.();
      unwireBeatTone?.();
    };
  }, [setRooms, registerPuzzle, setSignalLost]);

  // Task 13.2 + Task 16: audio follows narrative beat; endings run the orchestrator.
  useEffect(() => {
    const store = useGameStateStore.getState();

    const unsubBeat = store.subscribeToBeatChange((beat) => {
      void audioRef.current.setMusicBeat(beat);
    });

    const unsubEnd = store.subscribeToGameEnd((ending) => {
      void runEnding(ending, {
        playTTSLine: (key) => audioRef.current.playTTSLine(key),
        playEndingSting: (t) => audioRef.current.playEndingSting(t),
        setLighting: (mode) => setLightingMode(mode),
        setAllRoomsUnlocked: (u) => setAllRoomsUnlocked(u),
        sealAllRooms: () => sealAllRooms(),
        setDoorsSealedAfterEnding: (sealed) => setDoorsSealedAfterEnding(sealed),
      });
    });

    // Task 20.1: mid-game reveal triggers a scripted partner reaction before
    // the player can proceed. The orchestrator awaits playPartnerResponse, so
    // anything observing `midGameRevealTriggered` only fires after the partner
    // has replied through the intercom.
    const unsubReveal = store.subscribeToMidGameReveal(() => {
      const service = getElevenLabsService();
      void runMidGameReveal(
        {
          sendScriptedInput: (prompt) => service.sendTextInput(prompt),
          playPartnerResponse: (blob) => audioRef.current.playPartnerResponse(blob),
          playStaticBurst: () => audioRef.current.playStaticBurstSFX(),
          escalateMusic: (beat) => audioRef.current.setMusicBeat(beat),
        },
        NarrativeBeat.Midpoint,
      );
    });

    return () => {
      unsubBeat();
      unsubEnd();
      unsubReveal();
    };
  }, [setLightingMode, setAllRoomsUnlocked, sealAllRooms, setDoorsSealedAfterEnding]);

  // Task 13.3: locked-door SFX.
  useEffect(() => {
    onDoorAttemptedWhileLocked.add(() => {
      void audioRef.current.playLockedDoorSFX();
    });
  }, [onDoorAttemptedWhileLocked]);

  // Task 15.1: auto-trigger final choice when arriving at Climax with every puzzle solved.
  useEffect(() => {
    if (
      currentBeat === NarrativeBeat.Climax &&
      solvedPuzzleCount >= totalPuzzles &&
      !finalChoiceActive &&
      !gameEnded
    ) {
      triggerFinalChoice();
    }
  }, [currentBeat, solvedPuzzleCount, totalPuzzles, finalChoiceActive, gameEnded, triggerFinalChoice]);

  const handleStart = useCallback(async () => {
    console.log('[handleStart] clicked');
    try {
      const service = getElevenLabsService();
      console.log('[handleStart] starting ConvAI session…');
      await service.startConversationSession(
        buildFullSystemPrompt(agentConfig),
        agentConfig.initialMemory,
      );
      console.log('[handleStart] session started; playing opening monologue');
      await audioRef.current.playTTSLine('opening_monologue');
      console.log('[handleStart] opening monologue done; playing intercom_announcement_1');
      await audioRef.current.playIntercomLine('intercom_announcement_1');
      console.log('[handleStart] intercom line done; setting music beat');
      void audioRef.current.setMusicBeat(useGameStateStore.getState().currentBeat);
      console.log('[handleStart] done');
    } catch (err) {
      console.warn('Opening sequence failed', err);
    }
  }, []);

  const handlePTTStateChanged = useCallback(
    (active: boolean) => {
      if (active) {
        void ptt.handlePTTPressed();
      } else {
        void ptt.handlePTTReleased();
      }
    },
    [ptt],
  );

  const handlePropInteracted = useCallback(() => {
    void audioRef.current.playInteractSFX();
  }, []);

  const allProps: PropEntry[] = useMemo(() => {
    const list: PropEntry[] = [];
    for (const props of Object.values(allPropsByRoom)) {
      for (const prop of props) {
        const position = PROP_POSITIONS[prop.id] ?? [0, -1, 0];
        list.push({ prop, position });
      }
    }
    return list;
  }, []);

  const playSFX = useCallback(async (key: SFXKey) => {
    await audioRef.current.playSFX(key);
  }, []);

  const diagnosticMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('canvas') === 'off';

  return (
    <div className="game-root">
      {!diagnosticMode && (
        <Canvas shadows camera={{ position: [0, 0, 2], fov: 75 }}>
          <color attach="background" args={['#0a0a0f']} />
          <fog attach="fog" args={['#0a0a0f', 6, 30]} />
          <ambientLight intensity={0.25 * lightingIntensity(lightingMode)} />
          <directionalLight
            position={[4, 8, 4]}
            intensity={0.7 * lightingIntensity(lightingMode)}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight
            position={[0, 1, 0]}
            intensity={0.6 * lightingIntensity(lightingMode)}
            distance={8}
          />
          <pointLight
            position={[0, 1, 14]}
            intensity={0.6 * lightingIntensity(lightingMode)}
            distance={8}
            color="#fbbf24"
          />
          <pointLight
            position={[0, 1, 28]}
            intensity={0.6 * lightingIntensity(lightingMode)}
            distance={8}
            color="#ef4444"
          />

          <PlayerController moveSpeed={4} onPTTStateChanged={handlePTTStateChanged} />
          <RoomScene />
          {propsReady &&
            hasStarted &&
            allProps.map(({ prop, position }) => (
              <InteractableProp
                key={prop.id}
                id={prop.id}
                interactionPrompt={prop.interactionPrompt}
                revealContent={prop.revealContent}
                isMidGameRevealProp={prop.isMidGameRevealProp}
                puzzleId={prop.puzzleId}
                position={position}
                onInteracted={handlePropInteracted}
              />
            ))}
        </Canvas>
      )}
      {diagnosticMode && (
        <div style={{
          position: 'absolute', inset: 0, background: '#0a0a0f', color: '#e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'ui-monospace, monospace',
        }}>
          canvas disabled (diagnostic mode) · {hasStarted ? 'game started' : 'title screen shown'}
        </div>
      )}
      <TitleScreen onStart={handleStart} />
      <HUD pttState={ptt.pttState} onPlaySFX={playSFX} />
    </div>
  );
}

export default App;
