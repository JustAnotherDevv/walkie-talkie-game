import { useState } from 'react';
import { FinalChoice, SFXKey } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';
import { getElevenLabsService } from '../services/ElevenLabsService';
import { buildTrustContext } from '../services/trustContextBuilder';

/**
 * FinalChoiceUI component - diegetic 2-button panel at the final door.
 * Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.6, 9.1
 *
 * There is no timer. When the player locks in a choice, we simultaneously
 * request the partner's choice from ConvAI using the trust context, then
 * store both before routing to the ending.
 */
export function FinalChoiceUI({
  onPlaySFX,
}: {
  onPlaySFX?: (key: SFXKey) => void | Promise<void>;
} = {}) {
  const finalChoiceActive = useGameStateStore((s) => s.finalChoiceActive);
  const gameEnded = useGameStateStore((s) => s.gameEnded);
  const playerChoice = useGameStateStore((s) => s.playerFinalChoice);
  const setPlayerFinalChoice = useGameStateStore((s) => s.setPlayerFinalChoice);
  const setPartnerFinalChoice = useGameStateStore((s) => s.setPartnerFinalChoice);
  const resolveEnding = useGameStateStore((s) => s.resolveEnding);

  const [awaitingPartner, setAwaitingPartner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!finalChoiceActive || gameEnded) return null;
  if (playerChoice !== FinalChoice.Pending && !awaitingPartner) return null;

  const handleSelect = async (choice: FinalChoice) => {
    if (playerChoice !== FinalChoice.Pending) return;

    setPlayerFinalChoice(choice);
    await onPlaySFX?.(
      choice === FinalChoice.Cooperate
        ? SFXKey.CooperateButtonClick
        : SFXKey.DefectButtonClick,
    );

    setAwaitingPartner(true);
    setError(null);

    try {
      const service = getElevenLabsService();
      const trustContext = buildTrustContext();
      const partnerChoice = await service.getFinalChoice(trustContext);
      setPartnerFinalChoice(partnerChoice);
      // resolveEnding is a no-op if either side is still Pending, so this is safe.
      resolveEnding();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Partner did not respond');
    } finally {
      setAwaitingPartner(false);
    }
  };

  return (
    <div className="final-choice" role="dialog" aria-label="Final choice">
      <div className="final-choice-title">The door demands a command.</div>
      <div className="final-choice-subtitle">
        Cooperate and share the code, or defect and keep it for yourself.
      </div>

      <div className="final-choice-buttons">
        <button
          className="final-choice-cooperate"
          disabled={awaitingPartner}
          onClick={() => handleSelect(FinalChoice.Cooperate)}
        >
          COOPERATE
        </button>
        <button
          className="final-choice-defect"
          disabled={awaitingPartner}
          onClick={() => handleSelect(FinalChoice.Defect)}
        >
          DEFECT
        </button>
      </div>

      {awaitingPartner && (
        <div className="final-choice-wait">waiting for partner…</div>
      )}
      {error && <div className="final-choice-error">{error}</div>}
    </div>
  );
}
