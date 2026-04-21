import { useCallback } from 'react';
import { create } from 'zustand';
import type { IPuzzle, PuzzleDefinition } from '../types/puzzle';
import { PuzzleBase } from '../puzzles/PuzzleBase';
import { useGameStateStore } from '../stores/gameStateStore';
import { useRoomManager } from './useRoomManager';
import { getTrustEventReporter } from '../services/TrustEventReporter';
import { TrustEventType } from '../types/trust';

// Event callback type
type EventCallback<T = void> = (data: T) => void;

// Puzzle system store state
interface PuzzleSystemState {
  puzzles: Map<string, IPuzzle>;
  puzzleDefinitions: Map<string, PuzzleDefinition>;
  
  // Actions
  registerPuzzle: (definition: PuzzleDefinition) => void;
  getPuzzle: (id: string) => IPuzzle | undefined;
  getAllPuzzles: () => IPuzzle[];
  markPuzzleSolved: (puzzleId: string) => void;
  
  // Event subscriptions
  onPuzzleSolved: Set<EventCallback<string>>;
  onPuzzleFailed: Set<EventCallback<string>>;
  
  // Subscription methods
  subscribeToPuzzleSolved: (callback: EventCallback<string>) => () => void;
  subscribeToPuzzleFailed: (callback: EventCallback<string>) => () => void;
}

// Zustand store for puzzle system
const usePuzzleSystemStore = create<PuzzleSystemState>((set, get) => ({
  puzzles: new Map<string, IPuzzle>(),
  puzzleDefinitions: new Map<string, PuzzleDefinition>(),
  
  // Event subscription sets
  onPuzzleSolved: new Set<EventCallback<string>>(),
  onPuzzleFailed: new Set<EventCallback<string>>(),
  
  // Subscription methods
  subscribeToPuzzleSolved: (callback) => {
    const store = get();
    store.onPuzzleSolved.add(callback);
    return () => store.onPuzzleSolved.delete(callback);
  },
  
  subscribeToPuzzleFailed: (callback) => {
    const store = get();
    store.onPuzzleFailed.add(callback);
    return () => store.onPuzzleFailed.delete(callback);
  },
  
  // Actions
  registerPuzzle: (definition) => {
    const puzzle = new PuzzleBase(definition);
    set((state) => {
      const newPuzzles = new Map(state.puzzles);
      newPuzzles.set(definition.id, puzzle);
      const newDefinitions = new Map(state.puzzleDefinitions);
      newDefinitions.set(definition.id, definition);
      return { 
        puzzles: newPuzzles,
        puzzleDefinitions: newDefinitions,
      };
    });
  },
  
  getPuzzle: (id) => {
    return get().puzzles.get(id);
  },
  
  getAllPuzzles: () => {
    return Array.from(get().puzzles.values());
  },
  
  markPuzzleSolved: (puzzleId) => {
    const state = get();
    const puzzle = state.puzzles.get(puzzleId);
    
    if (puzzle && !puzzle.isSolved) {
      // Fire solved event
      state.onPuzzleSolved.forEach(cb => cb(puzzleId));
    }
  },
}));

/**
 * usePuzzleSystem hook - Manages all puzzle instances and their state
 * Validates: Requirements 5.1, 5.2, 11.2
 * 
 * Core responsibilities:
 * - Holds Map<string, IPuzzle> of all puzzle instances
 * - Exposes getPuzzle(id) for lookup
 * - Fires onPuzzleSolved and onPuzzleFailed events
 * - Wires onPuzzleSolved → tryUnlockDoor and advanceBeat
 */
export function usePuzzleSystem() {
  const store = usePuzzleSystemStore();
  const { markPuzzleSolved: markDoorPuzzleSolved } = useRoomManager();
  const advanceBeat = useGameStateStore((state) => state.advanceBeat);
  const incrementSolvedPuzzles = useGameStateStore((state) => state.incrementSolvedPuzzles);

  /**
   * Submit a solution to a puzzle
   * Validates: Requirements 5.2, 5.3, 11.2
   */
  const submitSolution = useCallback(async (puzzleId: string, input: string): Promise<boolean> => {
    const puzzle = store.getPuzzle(puzzleId);

    if (!puzzle) {
      console.warn(`Puzzle not found: ${puzzleId}`);
      return false;
    }

    const puzzleBase = puzzle as PuzzleBase;
    const isCorrect = await puzzleBase.trySubmitSolution(input);

    if (isCorrect) {
      store.onPuzzleSolved.forEach(cb => cb(puzzleId));
      markDoorPuzzleSolved(puzzleId);
      incrementSolvedPuzzles();

      // Requirement 6.4 / Task 8.1: solving a defection-opportunity puzzle
      // means the player chose to truthfully share the information they
      // could have lied about. Record that as SharedRiskyInfo so the
      // partner's trust model actually updates on game events, not only
      // on hypothetical manual reports.
      if (puzzle.isDefectionOpportunity) {
        const reporter = getTrustEventReporter();
        reporter.reportEvent(
          TrustEventType.SharedRiskyInfo,
          `Player truthfully solved defection-opportunity puzzle ${puzzleId}`,
          puzzleId,
        );
      }

      // Requirement 11.2: when all puzzles in the current beat are solved, advance.
      const gameState = useGameStateStore.getState();
      const currentBeat = gameState.currentBeat;
      const beatPuzzles = store.getAllPuzzles().filter((p) => p.narrativeBeat === currentBeat);
      const allBeatPuzzlesSolved =
        beatPuzzles.length > 0 && beatPuzzles.every((p) => p.isSolved);
      if (allBeatPuzzlesSolved) {
        advanceBeat();
      }

      return true;
    } else {
      store.onPuzzleFailed.forEach(cb => cb(puzzleId));
      return false;
    }
  }, [store, markDoorPuzzleSolved, incrementSolvedPuzzles, advanceBeat]);
  
  /**
   * Register a new puzzle from its definition
   */
  const registerPuzzle = useCallback((definition: PuzzleDefinition) => {
    store.registerPuzzle(definition);
  }, [store]);
  
  /**
   * Get a puzzle by ID
   */
  const getPuzzle = useCallback((id: string): IPuzzle | undefined => {
    return store.getPuzzle(id);
  }, [store]);
  
  /**
   * Get all registered puzzles
   */
  const getAllPuzzles = useCallback((): IPuzzle[] => {
    return store.getAllPuzzles();
  }, [store]);
  
  /**
   * Get all puzzle definitions
   */
  const getAllPuzzleDefinitions = useCallback((): PuzzleDefinition[] => {
    return Array.from(store.puzzleDefinitions.values());
  }, [store]);
  
  /**
   * Check if a puzzle is solved
   */
  const isPuzzleSolved = useCallback((puzzleId: string): boolean => {
    const puzzle = store.getPuzzle(puzzleId);
    return puzzle?.isSolved ?? false;
  }, [store]);
  
  return {
    puzzles: store.puzzles,
    puzzleDefinitions: store.puzzleDefinitions,
    
    // Actions
    registerPuzzle,
    getPuzzle,
    getAllPuzzles,
    getAllPuzzleDefinitions,
    submitSolution,
    isPuzzleSolved,
    
    // Event subscriptions
    subscribeToPuzzleSolved: store.subscribeToPuzzleSolved,
    subscribeToPuzzleFailed: store.subscribeToPuzzleFailed,
    
    // Direct event access for internal use
    onPuzzleSolved: store.onPuzzleSolved,
    onPuzzleFailed: store.onPuzzleFailed,
  };
}

// Export the store for direct access if needed
export { usePuzzleSystemStore };
