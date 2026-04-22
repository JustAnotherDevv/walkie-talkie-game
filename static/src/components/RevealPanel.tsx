import { useEffect, useState } from 'react';
import { useGameStateStore } from '../stores/gameStateStore';
import {
  allBeatPuzzlesSolved,
  checkSolution,
  getPuzzle,
} from '../puzzles/puzzleInstances';
import { getTrustEventReporter } from '../services/TrustEventReporter';
import { TrustEventType } from '../types/trust';

/**
 * Modal-ish overlay that opens when the player interacts with a prop.
 * Shows the prop's body text and, if the prop is bound to a puzzle, a
 * solution input. Releases pointer lock on open so the user can type.
 */
export function RevealPanel() {
  const revealedContent = useGameStateStore((s) => s.revealedContent);
  const activePuzzleId = useGameStateStore((s) => s.activePuzzleId);
  const closeReveal = useGameStateStore((s) => s.closeReveal);
  const markPuzzleSolved = useGameStateStore((s) => s.markPuzzleSolved);
  const solvedPuzzles = useGameStateStore((s) => s.solvedPuzzles);
  const currentBeat = useGameStateStore((s) => s.currentBeat);
  const advanceBeat = useGameStateStore((s) => s.advanceBeat);

  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // Release pointer lock when reveal opens so the input is reachable.
  useEffect(() => {
    if (revealedContent && document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (!revealedContent) {
      // Reset transient state on close.
      setInput('');
      setFeedback('idle');
    }
  }, [revealedContent]);

  if (!revealedContent) return null;

  const puzzle = activePuzzleId ? getPuzzle(activePuzzleId) : null;
  const alreadySolved = activePuzzleId ? solvedPuzzles.has(activePuzzleId) : false;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activePuzzleId) return;
    const ok = checkSolution(activePuzzleId, input);
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) {
      const solvedPuzzle = getPuzzle(activePuzzleId);
      markPuzzleSolved(activePuzzleId);

      // Solving a defection-opportunity puzzle means the Player chose to
      // share truthful info they could have lied about. Fire an automatic
      // SharedRiskyInfo trust event so the partner's trust model actually
      // updates on game events (not only manual demo buttons).
      if (solvedPuzzle?.isDefectionOpportunity) {
        getTrustEventReporter().reportEvent(
          TrustEventType.SharedRiskyInfo,
          `Player truthfully solved defection-opportunity puzzle ${activePuzzleId}`,
          activePuzzleId,
        );
      }

      // Auto-advance the beat if the newly solved puzzle completes the
      // beat's puzzle set.
      const nextSolved = new Set(solvedPuzzles);
      nextSolved.add(activePuzzleId);
      if (allBeatPuzzlesSolved(currentBeat, nextSolved)) {
        advanceBeat();
      }

      setTimeout(() => closeReveal(), 700);
    } else {
      setTimeout(() => setFeedback('idle'), 1200);
    }
  };

  return (
    <div className="reveal-backdrop" onClick={closeReveal}>
      <div
        className="reveal-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="reveal-content">{revealedContent}</div>

        {puzzle && !alreadySolved && (
          <form className="reveal-form" onSubmit={submit}>
            <input
              autoFocus
              value={input}
              placeholder="Enter solution…"
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="btn">Submit</button>
            {feedback === 'correct' && <span className="ok">correct</span>}
            {feedback === 'wrong' && <span className="bad">no match</span>}
          </form>
        )}

        {puzzle && alreadySolved && (
          <div className="solved-tag">Already solved ✓</div>
        )}

        <div className="reveal-actions">
          <button className="btn ghost" onClick={closeReveal}>
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
