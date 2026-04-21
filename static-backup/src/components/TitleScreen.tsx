import { useGameStateStore } from '../stores/gameStateStore';

/**
 * TitleScreen component - shown before the game begins.
 * Validates: Requirements 13.1, 13.5
 *
 * Clicking Start fires startGame() on the store. App.tsx observes this
 * transition to play the opening monologue TTS and open the ConvAI session.
 */
export function TitleScreen({ onStart }: { onStart?: () => void | Promise<void> }) {
  const hasStarted = useGameStateStore((s) => s.hasStarted);
  const startGame = useGameStateStore((s) => s.startGame);

  if (hasStarted) return null;

  const handleStart = async () => {
    startGame();
    await onStart?.();
  };

  return (
    <div className="title-screen" role="dialog" aria-label="Title screen">
      <div className="title-brand">STATIC</div>
      <div className="title-tagline">A cooperative escape room. You are not alone.</div>
      <div className="title-controls">
        <div><kbd>WASD</kbd> move</div>
        <div><kbd>mouse</kbd> look (click to lock pointer)</div>
        <div><kbd>E</kbd> interact with props</div>
        <div><kbd>V</kbd> hold to talk to your partner</div>
      </div>
      <button className="title-start" onClick={handleStart}>
        Begin transmission
      </button>
    </div>
  );
}
