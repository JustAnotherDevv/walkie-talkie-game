import { useGameStateStore } from '../stores/gameStateStore';

/**
 * SignalLostMessage component - shown when the ConvAI pipeline reports signal lost.
 * Validates: Requirement 3.6
 */
export function SignalLostMessage() {
  const signalLost = useGameStateStore((s) => s.signalLost);
  const setSignalLost = useGameStateStore((s) => s.setSignalLost);

  if (!signalLost) return null;

  return (
    <div className="signal-lost" role="alert">
      <div className="signal-lost-title">— signal lost —</div>
      <div className="signal-lost-body">The intercom crackles. Try pressing V again.</div>
      <button className="signal-lost-dismiss" onClick={() => setSignalLost(false)}>
        Dismiss
      </button>
    </div>
  );
}
