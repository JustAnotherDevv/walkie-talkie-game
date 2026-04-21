import { create } from 'zustand';
import { NarrativeBeat, FinalChoice, EndingType } from '../types';

// Event emitter type for store events
type EventCallback<T = void> = (data: T) => void;

// Total number of puzzles in the game
// Validates: Requirements 11.5
const TOTAL_PUZZLES = 4;

interface GameStateStore {
  // State
  currentBeat: NarrativeBeat;
  solvedPuzzleCount: number;
  totalPuzzles: number;
  playerFinalChoice: FinalChoice;
  partnerFinalChoice: FinalChoice;
  midGameRevealTriggered: boolean;
  gameEnded: boolean;
  endingType: EndingType | null;
  currentRevealedContent: string | null;
  currentInteractionPrompt: string | null;
  hasStarted: boolean;
  finalChoiceActive: boolean;
  signalLost: boolean;
  lightingMode: 'normal' | 'dim' | 'cut';
  doorsSealedAfterEnding: boolean;

  // Actions
  advanceBeat: () => void;
  incrementSolvedPuzzles: () => void;
  triggerMidGameReveal: () => void;
  triggerFinalChoice: () => void;
  setPlayerFinalChoice: (choice: FinalChoice) => void;
  setPartnerFinalChoice: (choice: FinalChoice) => void;
  resolveEnding: () => void;
  resetGame: () => void;
  setRevealedContent: (content: string | null) => void;
  setInteractionPrompt: (prompt: string | null) => void;
  startGame: () => void;
  setSignalLost: (lost: boolean) => void;
  setLightingMode: (mode: 'normal' | 'dim' | 'cut') => void;
  setDoorsSealedAfterEnding: (sealed: boolean) => void;

  // Event subscriptions
  onBeatChanged: Set<EventCallback<NarrativeBeat>>;
  onMidGameReveal: Set<EventCallback<void>>;
  onFinalChoiceTriggered: Set<EventCallback<void>>;
  onGameEnded: Set<EventCallback<EndingType>>;

  // Event subscription methods
  subscribeToBeatChange: (callback: EventCallback<NarrativeBeat>) => () => void;
  subscribeToMidGameReveal: (callback: EventCallback<void>) => () => void;
  subscribeToFinalChoice: (callback: EventCallback<void>) => () => void;
  subscribeToGameEnd: (callback: EventCallback<EndingType>) => () => void;
}

// Beat order for monotonic advancement
const BEAT_ORDER: NarrativeBeat[] = [
  NarrativeBeat.Opening,
  NarrativeBeat.Rising,
  NarrativeBeat.Midpoint,
  NarrativeBeat.Climb,
  NarrativeBeat.Climax,
];

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  // Initial state
  currentBeat: NarrativeBeat.Opening,
  solvedPuzzleCount: 0,
  totalPuzzles: TOTAL_PUZZLES,
  playerFinalChoice: FinalChoice.Pending,
  partnerFinalChoice: FinalChoice.Pending,
  midGameRevealTriggered: false,
  gameEnded: false,
  endingType: null,
  currentRevealedContent: null,
  currentInteractionPrompt: null,
  hasStarted: false,
  finalChoiceActive: false,
  signalLost: false,
  lightingMode: 'normal',
  doorsSealedAfterEnding: false,

  // Event subscription sets
  onBeatChanged: new Set<EventCallback<NarrativeBeat>>(),
  onMidGameReveal: new Set<EventCallback<void>>(),
  onFinalChoiceTriggered: new Set<EventCallback<void>>(),
  onGameEnded: new Set<EventCallback<EndingType>>(),

  // Subscription methods
  subscribeToBeatChange: (callback) => {
    const store = get();
    store.onBeatChanged.add(callback);
    return () => store.onBeatChanged.delete(callback);
  },

  subscribeToMidGameReveal: (callback) => {
    const store = get();
    store.onMidGameReveal.add(callback);
    return () => store.onMidGameReveal.delete(callback);
  },

  subscribeToFinalChoice: (callback) => {
    const store = get();
    store.onFinalChoiceTriggered.add(callback);
    return () => store.onFinalChoiceTriggered.delete(callback);
  },

  subscribeToGameEnd: (callback) => {
    const store = get();
    store.onGameEnded.add(callback);
    return () => store.onGameEnded.delete(callback);
  },

  // Actions
  advanceBeat: () => {
    const state = get();
    const currentIndex = BEAT_ORDER.indexOf(state.currentBeat);

    if (currentIndex < BEAT_ORDER.length - 1) {
      const newBeat = BEAT_ORDER[currentIndex + 1];
      set({ currentBeat: newBeat });
      state.onBeatChanged.forEach(cb => cb(newBeat));

      // If we just arrived at Midpoint and the mid-game reveal already fired,
      // continue straight through to Climb — Midpoint holds no gating puzzle.
      const postState = get();
      if (newBeat === NarrativeBeat.Midpoint && postState.midGameRevealTriggered) {
        const nextIndex = BEAT_ORDER.indexOf(NarrativeBeat.Climb);
        set({ currentBeat: NarrativeBeat.Climb });
        postState.onBeatChanged.forEach(cb => cb(NarrativeBeat.Climb));
        void nextIndex;
      }
    }
  },

  incrementSolvedPuzzles: () => {
    set(state => ({ solvedPuzzleCount: state.solvedPuzzleCount + 1 }));
  },

  triggerMidGameReveal: () => {
    const state = get();
    if (!state.midGameRevealTriggered) {
      set({ midGameRevealTriggered: true });
      state.onMidGameReveal.forEach(cb => cb());

      // If the player is already in Midpoint, the reveal is the trigger
      // that escalates to Climb (Requirement 7.2, 7.5 pacing).
      const postState = get();
      if (postState.currentBeat === NarrativeBeat.Midpoint) {
        set({ currentBeat: NarrativeBeat.Climb });
        postState.onBeatChanged.forEach(cb => cb(NarrativeBeat.Climb));
      }
    }
  },

  triggerFinalChoice: () => {
    const state = get();
    // Validates: Requirements 11.5
    // Final choice triggers when:
    // 1. Current beat is Climax
    // 2. All puzzles are solved
    // 3. Game has not ended
    if (
      state.currentBeat === NarrativeBeat.Climax &&
      state.solvedPuzzleCount >= state.totalPuzzles &&
      !state.gameEnded &&
      !state.finalChoiceActive
    ) {
      set({ finalChoiceActive: true });
      state.onFinalChoiceTriggered.forEach(cb => cb());
    }
  },

  setPlayerFinalChoice: (choice: FinalChoice) => {
    set({ playerFinalChoice: choice });
  },

  setPartnerFinalChoice: (choice: FinalChoice) => {
    set({ partnerFinalChoice: choice });
  },

  resolveEnding: () => {
    const state = get();
    const { playerFinalChoice, partnerFinalChoice } = state;

    // Invariant (Property 15): the ending must not resolve until both sides decided.
    if (
      playerFinalChoice === FinalChoice.Pending ||
      partnerFinalChoice === FinalChoice.Pending
    ) {
      return;
    }

    let endingType: EndingType;

    if (playerFinalChoice === FinalChoice.Cooperate && partnerFinalChoice === FinalChoice.Cooperate) {
      endingType = EndingType.Release;
    } else if (playerFinalChoice === FinalChoice.Cooperate && partnerFinalChoice === FinalChoice.Defect) {
      endingType = EndingType.LeftBehind;
    } else if (playerFinalChoice === FinalChoice.Defect && partnerFinalChoice === FinalChoice.Cooperate) {
      endingType = EndingType.Alone;
    } else {
      endingType = EndingType.Reset;
    }

    set({ gameEnded: true, endingType });
    state.onGameEnded.forEach(cb => cb(endingType));
  },

  resetGame: () => {
    set({
      currentBeat: NarrativeBeat.Opening,
      solvedPuzzleCount: 0,
      playerFinalChoice: FinalChoice.Pending,
      partnerFinalChoice: FinalChoice.Pending,
      midGameRevealTriggered: false,
      gameEnded: false,
      endingType: null,
      currentRevealedContent: null,
      currentInteractionPrompt: null,
      hasStarted: false,
      finalChoiceActive: false,
      signalLost: false,
      lightingMode: 'normal',
      doorsSealedAfterEnding: false,
    });
  },

  setRevealedContent: (content) => {
    set({ currentRevealedContent: content });
  },

  setInteractionPrompt: (prompt) => {
    set({ currentInteractionPrompt: prompt });
  },

  startGame: () => {
    set({ hasStarted: true });
  },

  setSignalLost: (lost) => {
    set({ signalLost: lost });
  },

  setLightingMode: (mode) => {
    set({ lightingMode: mode });
  },

  setDoorsSealedAfterEnding: (sealed) => {
    set({ doorsSealedAfterEnding: sealed });
  },
}));
