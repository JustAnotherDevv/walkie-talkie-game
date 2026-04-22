import { create } from 'zustand';
import { BEAT_ORDER, NarrativeBeat } from '../types/narrative';
import { FinalChoice } from '../types/choices';
import { EndingType } from '../types/endings';

/**
 * Minimal game state store, grown incrementally as rounds add features.
 * Round 4 adds reveal-panel state, solved-puzzle tracking, and an
 * interaction-prompt string the HUD reads.
 */
export type LightingMode = 'normal' | 'dim' | 'cut';
export type DoorsMode = 'gated' | 'all-open' | 'all-sealed';

export interface GameState {
  hasStarted: boolean;
  currentBeat: NarrativeBeat;
  solvedPuzzleCount: number;
  totalPuzzles: number;
  solvedPuzzles: Set<string>;
  playerFinalChoice: FinalChoice;
  partnerFinalChoice: FinalChoice;
  gameEnded: boolean;
  endingType: EndingType | null;
  midGameRevealTriggered: boolean;

  /** Prompt shown in the HUD when a prop is within interaction range. */
  interactionPrompt: string | null;
  /** Body text of the currently-open reveal panel (null = closed). */
  revealedContent: string | null;
  /** Puzzle id associated with the currently-open reveal panel. */
  activePuzzleId: string | null;

  /** Ending-driven scene state. */
  lightingMode: LightingMode;
  doorsMode: DoorsMode;

  /** Room-0 keycard + door mechanic — gates door 0 instead of puzzle_01. */
  hasKeycard: boolean;
  door0Opened: boolean;

  /** Endgame narrative flags — each fires a scripted agent interjection once. */
  allPuzzlesSolvedFired: boolean;
  enteredFinalCorridor: boolean;

  /** Final-room mechanism state. */
  leverLeftPulled: boolean;
  leverRightPulled: boolean;
  /** True while the fade-to-black cutscene is on screen (after commit button). */
  finalCutscenePlaying: boolean;

  // Actions
  startGame: () => void;
  advanceBeat: () => void;
  incrementSolvedPuzzles: () => void;
  markPuzzleSolved: (puzzleId: string) => void;
  triggerMidGameReveal: () => void;
  setInteractionPrompt: (prompt: string | null) => void;
  openReveal: (content: string, puzzleId: string | null) => void;
  closeReveal: () => void;
  setPlayerFinalChoice: (choice: FinalChoice) => void;
  setPartnerFinalChoice: (choice: FinalChoice) => void;
  resolveEnding: () => void;
  resetGame: () => void;
  setLightingMode: (mode: LightingMode) => void;
  setDoorsMode: (mode: DoorsMode) => void;
  pickUpKeycard: () => void;
  openDoor0WithKeycard: () => boolean;

  markAllPuzzlesSolvedFired: () => void;
  markEnteredFinalCorridor: () => void;
  toggleLever: (side: 'left' | 'right') => void;
  triggerFinalCutscene: () => void;
  setFinalCutscenePlaying: (playing: boolean) => void;
}

const initialState = {
  hasStarted: false,
  currentBeat: NarrativeBeat.Opening,
  solvedPuzzleCount: 0,
  totalPuzzles: 4,
  solvedPuzzles: new Set<string>(),
  playerFinalChoice: FinalChoice.Pending,
  partnerFinalChoice: FinalChoice.Pending,
  gameEnded: false,
  endingType: null as EndingType | null,
  midGameRevealTriggered: false,
  interactionPrompt: null as string | null,
  revealedContent: null as string | null,
  activePuzzleId: null as string | null,
  lightingMode: 'normal' as LightingMode,
  doorsMode: 'gated' as DoorsMode,
  hasKeycard: false,
  door0Opened: false,
  allPuzzlesSolvedFired: false,
  enteredFinalCorridor: false,
  leverLeftPulled: false,
  leverRightPulled: false,
  finalCutscenePlaying: false,
};

export const useGameStateStore = create<GameState>((set, get) => ({
  ...initialState,

  startGame: () => set({ hasStarted: true }),

  advanceBeat: () => {
    const idx = BEAT_ORDER.indexOf(get().currentBeat);
    if (idx < BEAT_ORDER.length - 1) {
      set({ currentBeat: BEAT_ORDER[idx + 1] });
    }
  },

  incrementSolvedPuzzles: () =>
    set((s) => ({ solvedPuzzleCount: s.solvedPuzzleCount + 1 })),

  markPuzzleSolved: (puzzleId) =>
    set((s) => {
      if (s.solvedPuzzles.has(puzzleId)) return s;
      const next = new Set(s.solvedPuzzles);
      next.add(puzzleId);
      return {
        solvedPuzzles: next,
        solvedPuzzleCount: next.size,
      };
    }),

  triggerMidGameReveal: () =>
    set((s) => {
      if (s.midGameRevealTriggered) return s;
      // If we're sitting in Midpoint (no puzzles to gate it), the reveal is
      // the trigger that bridges us into Climb.
      const shouldAdvance = s.currentBeat === NarrativeBeat.Midpoint;
      const advancedBeat = shouldAdvance ? NarrativeBeat.Climb : s.currentBeat;
      return {
        midGameRevealTriggered: true,
        currentBeat: advancedBeat,
      };
    }),

  setInteractionPrompt: (prompt) => {
    // Skip the write if unchanged — playerController polls this every frame.
    if (get().interactionPrompt === prompt) return;
    set({ interactionPrompt: prompt });
  },

  openReveal: (content, puzzleId) =>
    set({ revealedContent: content, activePuzzleId: puzzleId }),

  closeReveal: () => set({ revealedContent: null, activePuzzleId: null }),

  setPlayerFinalChoice: (choice) => set({ playerFinalChoice: choice }),
  setPartnerFinalChoice: (choice) => set({ partnerFinalChoice: choice }),

  resolveEnding: () => {
    const { playerFinalChoice: p, partnerFinalChoice: q } = get();
    if (p === FinalChoice.Pending || q === FinalChoice.Pending) return;

    let endingType: EndingType;
    if (p === FinalChoice.Cooperate && q === FinalChoice.Cooperate) {
      endingType = EndingType.Release;
    } else if (p === FinalChoice.Cooperate && q === FinalChoice.Defect) {
      endingType = EndingType.LeftBehind;
    } else if (p === FinalChoice.Defect && q === FinalChoice.Cooperate) {
      endingType = EndingType.Alone;
    } else {
      endingType = EndingType.Reset;
    }
    set({ gameEnded: true, endingType });
  },

  resetGame: () =>
    set({
      ...initialState,
      solvedPuzzles: new Set<string>(),
    }),

  setLightingMode: (mode) => set({ lightingMode: mode }),
  setDoorsMode: (mode) => set({ doorsMode: mode }),

  pickUpKeycard: () => set({ hasKeycard: true }),
  openDoor0WithKeycard: () => {
    if (!get().hasKeycard) return false;
    if (get().door0Opened) return true;
    set({ door0Opened: true });
    return true;
  },

  markAllPuzzlesSolvedFired: () =>
    set((s) => (s.allPuzzlesSolvedFired ? s : { allPuzzlesSolvedFired: true })),
  markEnteredFinalCorridor: () =>
    set((s) => (s.enteredFinalCorridor ? s : { enteredFinalCorridor: true })),
  toggleLever: (side) =>
    set((s) =>
      side === 'left'
        ? { leverLeftPulled: !s.leverLeftPulled }
        : { leverRightPulled: !s.leverRightPulled },
    ),
  triggerFinalCutscene: () => set({ finalCutscenePlaying: true }),
  setFinalCutscenePlaying: (playing) => set({ finalCutscenePlaying: playing }),
}));
