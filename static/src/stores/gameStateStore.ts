import { create } from 'zustand';
import { NarrativeBeat, FinalChoice, EndingType } from '../types';

// Event emitter type for store events
type EventCallback<T = void> = (data: T) => void;

interface GameStateStore {
  // State
  currentBeat: NarrativeBeat;
  solvedPuzzleCount: number;
  playerFinalChoice: FinalChoice;
  partnerFinalChoice: FinalChoice;
  midGameRevealTriggered: boolean;
  gameEnded: boolean;
  endingType: EndingType | null;

  // Actions
  advanceBeat: () => void;
  incrementSolvedPuzzles: () => void;
  triggerMidGameReveal: () => void;
  triggerFinalChoice: () => void;
  setPlayerFinalChoice: (choice: FinalChoice) => void;
  setPartnerFinalChoice: (choice: FinalChoice) => void;
  resolveEnding: () => void;
  resetGame: () => void;

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
  playerFinalChoice: FinalChoice.Pending,
  partnerFinalChoice: FinalChoice.Pending,
  midGameRevealTriggered: false,
  gameEnded: false,
  endingType: null,

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
    
    // Only advance if not at climax
    if (currentIndex < BEAT_ORDER.length - 1) {
      const newBeat = BEAT_ORDER[currentIndex + 1];
      set({ currentBeat: newBeat });
      
      // Notify subscribers
      state.onBeatChanged.forEach(cb => cb(newBeat));
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
    }
  },

  triggerFinalChoice: () => {
    const state = get();
    if (state.currentBeat === NarrativeBeat.Climax && !state.gameEnded) {
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

    // Determine ending based on 2x2 matrix
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
    });
  },
}));
