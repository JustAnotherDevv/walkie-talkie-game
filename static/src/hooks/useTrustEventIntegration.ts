import { useCallback, useEffect } from 'react';
import { TrustEventType, getTrustEventReporter } from '../services/TrustEventReporter';
import { usePuzzleSystemStore } from './usePuzzleSystem';
import { useGameStateStore } from '../stores/gameStateStore';

/**
 * Hook to integrate TrustEventReporter with puzzle outcomes
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6
 * 
 * This hook wires:
 * - Defection-opportunity puzzle outcomes to trust events
 * - Verbal reassurance detection to trust events
 * - Room transitions to maintain trust context
 */
export function useTrustEventIntegration() {
  const reporter = getTrustEventReporter();
  const puzzleStore = usePuzzleSystemStore();
  const currentBeat = useGameStateStore((state) => state.currentBeat);

  /**
   * Report a lie during a defection opportunity puzzle
   * Validates: Requirement 6.2
   * 
   * @param puzzleId - The puzzle where the lie occurred
   * @param playerStatedInfo - What the player claimed
   * @param actualInfo - The actual correct information
   */
  const reportLiedAboutPuzzle = useCallback((
    puzzleId: string,
    playerStatedInfo: string,
    actualInfo: string
  ) => {
    reporter.reportEvent(
      TrustEventType.LiedAboutPuzzle,
      `Player stated "${playerStatedInfo}" but actual info was "${actualInfo}"`,
      puzzleId
    );
  }, [reporter]);

  /**
   * Report withholding information the partner requested
   * Validates: Requirement 6.3
   * 
   * @param puzzleId - The puzzle where info was withheld
   * @param requestedInfo - What the partner asked for
   */
  const reportWithheldInfo = useCallback((
    puzzleId: string,
    requestedInfo: string
  ) => {
    reporter.reportEvent(
      TrustEventType.WithheldInfo,
      `Player did not provide requested information: "${requestedInfo}"`,
      puzzleId
    );
  }, [reporter]);

  /**
   * Report sharing risky/disadvantageous information
   * Validates: Requirement 6.4
   * 
   * @param puzzleId - The puzzle where risky info was shared
   * @param sharedInfo - The risky information shared
   */
  const reportSharedRiskyInfo = useCallback((
    puzzleId: string,
    sharedInfo: string
  ) => {
    reporter.reportEvent(
      TrustEventType.SharedRiskyInfo,
      `Player shared potentially disadvantageous information: "${sharedInfo}"`,
      puzzleId
    );
  }, [reporter]);

  /**
   * Report being caught in a contradiction
   * Validates: Requirement 6.5
   * 
   * @param earlierStatement - What the player said earlier
   * @param currentStatement - What the player said now (contradicting)
   */
  const reportCaughtInContradiction = useCallback((
    earlierStatement: string,
    currentStatement: string
  ) => {
    reporter.reportEvent(
      TrustEventType.CaughtInContradiction,
      `Player contradicted themselves. Earlier: "${earlierStatement}" Now: "${currentStatement}"`
    );
  }, [reporter]);

  /**
   * Report verbal reassurance or emotional engagement
   * Validates: Requirement 6.6
   * 
   * @param reassuranceContent - The reassurance provided
   */
  const reportVerbalReassurance = useCallback((
    reassuranceContent: string
  ) => {
    reporter.reportEvent(
      TrustEventType.VerbalReassurance,
      `Player provided emotional support: "${reassuranceContent}"`
    );
  }, [reporter]);

  /**
   * Report breaking a promise
   * 
   * @param promiseContent - The promise that was broken
   */
  const reportBrokePromise = useCallback((
    promiseContent: string
  ) => {
    reporter.reportEvent(
      TrustEventType.BrokePromise,
      `Player broke their promise: "${promiseContent}"`
    );
  }, [reporter]);

  /**
   * Set the current room for trust event context
   * Validates: Requirement 6.9 (trust accumulates across rooms)
   * 
   * @param roomId - The current room ID
   */
  const setCurrentRoom = useCallback((roomId: string) => {
    reporter.setCurrentRoom(roomId);
  }, [reporter]);

  /**
   * Get all trust events that have been reported
   */
  const getTrustEvents = useCallback(() => {
    return reporter.getEventHistory();
  }, [reporter]);

  /**
   * Get the total trust impact
   */
  const getTotalTrustImpact = useCallback(() => {
    return reporter.getTotalTrustImpact();
  }, [reporter]);

  return {
    // Trust event reporting methods
    reportLiedAboutPuzzle,
    reportWithheldInfo,
    reportSharedRiskyInfo,
    reportCaughtInContradiction,
    reportVerbalReassurance,
    reportBrokePromise,
    
    // Context methods
    setCurrentRoom,
    
    // Query methods
    getTrustEvents,
    getTotalTrustImpact,
    
    // Direct reporter access for advanced use
    reporter,
  };
}

/**
 * Type for the trust event integration hook return value
 */
export type TrustEventIntegration = ReturnType<typeof useTrustEventIntegration>;
