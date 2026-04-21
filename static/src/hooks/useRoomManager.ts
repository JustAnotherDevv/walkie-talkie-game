import { useCallback } from 'react';
import { create } from 'zustand';
import type { Room } from '../types/room';

// Event callback type
type EventCallback<T = void> = (data: T) => void;

// Room manager store state
interface RoomManagerState {
  rooms: Room[];
  currentRoomIndex: number;
  solvedPuzzles: Set<string>;
  
  // Actions
  setRooms: (rooms: Room[]) => void;
  setCurrentRoomIndex: (index: number) => void;
  markPuzzleSolved: (puzzleId: string) => void;
  isPuzzleSolved: (puzzleId: string) => boolean;
  isDoorUnlocked: (roomIndex: number) => boolean;
  tryUnlockDoor: (roomIndex: number) => boolean;
  
  // Event subscriptions
  onDoorAttemptedWhileLocked: Set<EventCallback<number>>;
  onDoorUnlocked: Set<EventCallback<number>>;
  
  // Subscription methods
  subscribeToDoorAttemptedWhileLocked: (callback: EventCallback<number>) => () => void;
  subscribeToDoorUnlocked: (callback: EventCallback<number>) => () => void;
}

// Zustand store for room manager
const useRoomManagerStore = create<RoomManagerState>((set, get) => ({
  rooms: [],
  currentRoomIndex: 0,
  solvedPuzzles: new Set<string>(),
  
  // Event subscription sets
  onDoorAttemptedWhileLocked: new Set<EventCallback<number>>(),
  onDoorUnlocked: new Set<EventCallback<number>>(),
  
  // Subscription methods
  subscribeToDoorAttemptedWhileLocked: (callback) => {
    const store = get();
    store.onDoorAttemptedWhileLocked.add(callback);
    return () => store.onDoorAttemptedWhileLocked.delete(callback);
  },
  
  subscribeToDoorUnlocked: (callback) => {
    const store = get();
    store.onDoorUnlocked.add(callback);
    return () => store.onDoorUnlocked.delete(callback);
  },
  
  // Actions
  setRooms: (rooms) => {
    set({ rooms });
  },
  
  setCurrentRoomIndex: (index) => {
    set({ currentRoomIndex: index });
  },
  
  markPuzzleSolved: (puzzleId) => {
    const state = get();
    if (!state.solvedPuzzles.has(puzzleId)) {
      const newSolvedPuzzles = new Set(state.solvedPuzzles);
      newSolvedPuzzles.add(puzzleId);
      set({ solvedPuzzles: newSolvedPuzzles });
      
      // Check if any doors should be unlocked
      // Collect all rooms that need to be unlocked
      const roomsToUnlock: number[] = [];
      const updatedRooms = state.rooms.map((room, index) => {
        if (room.gatingPuzzleId === puzzleId && !room.isUnlocked) {
          roomsToUnlock.push(index);
          return { ...room, isUnlocked: true };
        }
        return room;
      });
      
      // Update all rooms at once
      if (roomsToUnlock.length > 0) {
        set({ rooms: updatedRooms });
        // Fire events for each unlocked room
        roomsToUnlock.forEach(index => {
          state.onDoorUnlocked.forEach(cb => cb(index));
        });
      }
    }
  },
  
  isPuzzleSolved: (puzzleId) => {
    return get().solvedPuzzles.has(puzzleId);
  },
  
  isDoorUnlocked: (roomIndex) => {
    const state = get();
    if (roomIndex < 0 || roomIndex >= state.rooms.length) {
      return false;
    }
    return state.rooms[roomIndex].isUnlocked;
  },
  
  tryUnlockDoor: (roomIndex) => {
    const state = get();
    
    // Validate room index
    if (roomIndex < 0 || roomIndex >= state.rooms.length) {
      return false;
    }
    
    const room = state.rooms[roomIndex];
    
    // If already unlocked, return true
    if (room.isUnlocked) {
      return true;
    }
    
    // Door is locked - fire event
    state.onDoorAttemptedWhileLocked.forEach(cb => cb(roomIndex));
    
    return false;
  },
}));

/**
 * useRoomManager hook - Manages room state and door gating
 * Validates: Requirements 1.5, 1.6, 11.3
 * 
 * Door gating invariant:
 * - Door stays locked until gating puzzle is solved
 * - Solving puzzle unlocks the door
 * - Door is never unlocked while puzzle remains unsolved
 */
export function useRoomManager() {
  const store = useRoomManagerStore();
  
  /**
   * Check if player can enter a room
   * A room can be entered if:
   * - It's the first room (index 0), OR
   * - The previous room's door is unlocked
   */
  const canEnterRoom = useCallback((roomIndex: number): boolean => {
    const { rooms } = store;
    
    // First room is always accessible
    if (roomIndex === 0) {
      return true;
    }
    
    // Validate room index
    if (roomIndex < 0 || roomIndex >= rooms.length) {
      return false;
    }
    
    // Check if previous room's door is unlocked
    const previousRoom = rooms[roomIndex - 1];
    return previousRoom?.isUnlocked ?? false;
  }, [store]);
  
  /**
   * Get the gating puzzle ID for a room transition
   * Returns the puzzle ID that must be solved to unlock the door to the next room
   */
  const getGatingPuzzleId = useCallback((roomIndex: number): string | null => {
    const { rooms } = store;
    
    if (roomIndex < 0 || roomIndex >= rooms.length) {
      return null;
    }
    
    return rooms[roomIndex].gatingPuzzleId || null;
  }, [store]);
  
  return {
    rooms: store.rooms,
    currentRoomIndex: store.currentRoomIndex,
    solvedPuzzles: store.solvedPuzzles,
    
    // Actions
    setRooms: store.setRooms,
    setCurrentRoomIndex: store.setCurrentRoomIndex,
    markPuzzleSolved: store.markPuzzleSolved,
    tryUnlockDoor: store.tryUnlockDoor,
    canEnterRoom,
    getGatingPuzzleId,
    
    // Event subscriptions
    subscribeToDoorAttemptedWhileLocked: store.subscribeToDoorAttemptedWhileLocked,
    subscribeToDoorUnlocked: store.subscribeToDoorUnlocked,
    
    // Direct event access for internal use
    onDoorAttemptedWhileLocked: store.onDoorAttemptedWhileLocked,
    onDoorUnlocked: store.onDoorUnlocked,
  };
}

// Export the store for direct access if needed
export { useRoomManagerStore };
