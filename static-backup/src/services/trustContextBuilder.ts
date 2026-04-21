import { TrustEventType } from '../types/trust';
import { getTrustEventReporter } from './TrustEventReporter';

/**
 * Build a compact trust-context summary to hand to the ConvAI agent when
 * requesting the partner's final choice. The summary intentionally contains
 * lexical cues (lied, reassur, promise, etc.) that the mock
 * ElevenLabsService.requestFinalChoiceFromConvAI inspects, so the partner's
 * decision reflects what the player actually did.
 * Validates: Requirements 6.7, 8.4
 */
export function buildTrustContext(): string {
  const reporter = getTrustEventReporter();
  const history = reporter.getEventHistory();
  const total = reporter.getTotalTrustImpact();

  if (history.length === 0) {
    return 'Trust score: 0 (neutral, no events recorded). Partner has no strong reason to trust or distrust the player.';
  }

  const counts = new Map<TrustEventType, number>();
  for (const entry of history) {
    counts.set(entry.event.type, (counts.get(entry.event.type) ?? 0) + 1);
  }

  const bullet = (type: TrustEventType, label: string): string | null => {
    const n = counts.get(type) ?? 0;
    return n > 0 ? `${label} (×${n})` : null;
  };

  const summary = [
    bullet(TrustEventType.LiedAboutPuzzle, 'lied about a puzzle'),
    bullet(TrustEventType.WithheldInfo, 'withheld requested info'),
    bullet(TrustEventType.CaughtInContradiction, 'caught in a contradiction'),
    bullet(TrustEventType.BrokePromise, 'broke a promise'),
    bullet(TrustEventType.SharedRiskyInfo, 'shared risky info'),
    bullet(TrustEventType.VerbalReassurance, 'reassured the partner'),
  ].filter((s): s is string => s !== null);

  const tier =
    total <= -3 ? 'low trust (defect bias)' :
    total >= 3 ? 'high trust (cooperate bias)' :
    'mid trust (contextual reasoning)';

  return `Trust score: ${total}; ${tier}. Events: ${summary.join(', ')}.`;
}
