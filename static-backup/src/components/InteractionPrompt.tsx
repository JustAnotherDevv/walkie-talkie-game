import { useGameStateStore } from '../stores/gameStateStore';

/**
 * InteractionPrompt component - HUD overlay shown when a prop is in range.
 * Validates: Requirements 1.3, 2.3
 */
export function InteractionPrompt() {
  const prompt = useGameStateStore((s) => s.currentInteractionPrompt);
  const revealed = useGameStateStore((s) => s.currentRevealedContent);

  if (!prompt || revealed) return null;

  return (
    <div className="hud-prompt" role="status" aria-live="polite">
      {prompt} <kbd>E</kbd>
    </div>
  );
}
