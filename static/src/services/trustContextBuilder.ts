import { getTrustEventReporter, getTrustImpact } from './TrustEventReporter';
import { TrustEventType } from '../types/trust';

/**
 * Format the trust summary the ConvAI agent receives when the game asks
 * for the Partner's final choice. Intentionally uses lexical cues
 * (lied / reassur / shared / broke / contradict) that the mock service
 * keys off too.
 */
export function buildTrustContext(): string {
  const reporter = getTrustEventReporter();
  const history = reporter.getHistory();
  const total = reporter.getTotalImpact();

  if (history.length === 0) {
    return 'Trust score: 0 (neutral, no events recorded). Partner has no strong reason to trust or distrust the player.';
  }

  const count = (type: TrustEventType) => history.filter((e) => e.type === type).length;
  const bullet = (type: TrustEventType, label: string): string | null => {
    const n = count(type);
    return n > 0 ? `${label} (×${n}, Δ${getTrustImpact(type) * n})` : null;
  };

  const parts = [
    bullet(TrustEventType.LiedAboutPuzzle, 'lied about a puzzle'),
    bullet(TrustEventType.WithheldInfo, 'withheld requested info'),
    bullet(TrustEventType.CaughtInContradiction, 'caught in a contradiction'),
    bullet(TrustEventType.BrokePromise, 'broke a promise'),
    bullet(TrustEventType.SharedRiskyInfo, 'shared risky info'),
    bullet(TrustEventType.VerbalReassurance, 'reassured the partner'),
  ].filter((s): s is string => s !== null);

  const tier =
    total <= -3 ? 'low trust (defect bias)'
    : total >= 3 ? 'high trust (cooperate bias)'
    : 'mid trust (contextual reasoning)';

  return `Trust score: ${total}; ${tier}. Events: ${parts.join(', ')}.`;
}
