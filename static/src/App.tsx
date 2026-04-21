import { useEffect, useRef, useState } from 'react';
import { useGameStateStore } from './stores/gameStateStore';
import { getTrustEventReporter, getTrustImpact } from './services/TrustEventReporter';
import { TrustEventType } from './types/trust';
import { NarrativeBeat } from './types/narrative';
import { FinalChoice } from './types/choices';
import { Scene } from './components/Scene';
import { RevealPanel } from './components/RevealPanel';
import { useAudioManager } from './hooks/useAudioManager';
import { audioBus } from './services/audioBus';
import './App.css';

export default function App() {
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

  // Force a re-render when the reporter fires events (it's not zustand).
  const [, bump] = useState(0);
  const forceUpdate = () => bump((n) => n + 1);
  const reporter = getTrustEventReporter();

  // Audio manager: initialized on the first user gesture (Begin transmission).
  const audio = useAudioManager();
  const audioInitialized = useRef(false);

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

  // Follow beat changes → music level.
  useEffect(() => {
    if (!audio.isReady) return;
    void audio.setMusicBeat(currentBeat);
  }, [audio.isReady, audio.setMusicBeat, currentBeat]);

  const fireTrust = (type: TrustEventType) => {
    reporter.reportEvent(type, `round-4 demo event for ${type}`);
    forceUpdate();
  };

  // Esc closes reveal panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && revealedContent) {
        closeReveal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealedContent, closeReveal]);

  const atClimax = currentBeat === NarrativeBeat.Climax;
  const allPuzzlesSolved = solvedPuzzleCount >= totalPuzzles;

  if (!hasStarted) {
    return (
      <div className="shell">
        <Scene movementEnabled={false} />
        <div className="panel overlay">
          <div className="brand">STATIC</div>
          <div className="tagline">Round 4 · interactable props + puzzle flow</div>
          <div className="controls">
            <div><kbd>WASD</kbd> move</div>
            <div><kbd>Mouse</kbd> look (click canvas to lock pointer)</div>
            <div><kbd>E</kbd> interact with glowing props</div>
            <div><kbd>Esc</kbd> close reveal / release pointer</div>
          </div>
          <button
            className="start-btn"
            onClick={async () => {
              // First user-gesture: boot the audio manager.
              if (!audioInitialized.current) {
                audioInitialized.current = true;
                await audio.initialize();
              }
              startGame();
              // Fire opening monologue TTS + set initial music bed.
              void audio.playTTSLine('opening_monologue');
              void audio.setMusicBeat(NarrativeBeat.Opening);
            }}
          >
            Begin transmission
          </button>
        </div>
      </div>
    );
  }

  if (gameEnded && endingType) {
    return (
      <div className="shell">
        <Scene movementEnabled={false} />
        <div className="panel overlay">
          <div className="brand">ENDING · {endingType}</div>
          <div className="tagline">
            Player chose {playerFinalChoice}. Partner chose {partnerFinalChoice}.
          </div>
          <button
            className="start-btn"
            onClick={() => {
              reporter.clear();
              resetGame();
              forceUpdate();
            }}
          >
            Reset game
          </button>
        </div>
      </div>
    );
  }

  // Movement is disabled while the reveal panel is open so the camera
  // doesn't drift around while the player reads / types.
  const movementEnabled = hasStarted && !gameEnded && !revealedContent;

  return (
    <div className="shell">
      <Scene movementEnabled={movementEnabled} />

      {interactionPrompt && !revealedContent && (
        <div className="interaction-prompt">
          <kbd>E</kbd> {interactionPrompt}
        </div>
      )}

      <div className="panel wide overlay corner">
        <div className="row">
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
            onClick={() => {
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
                className="btn coop"
                disabled={partnerFinalChoice !== FinalChoice.Pending}
                onClick={() => setPartnerFinalChoice(FinalChoice.Cooperate)}
              >
                partner cooperate
              </button>
              <button
                className="btn defect"
                disabled={partnerFinalChoice !== FinalChoice.Pending}
                onClick={() => setPartnerFinalChoice(FinalChoice.Defect)}
              >
                partner defect
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

      <RevealPanel />
    </div>
  );
}

function formatDelta(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
