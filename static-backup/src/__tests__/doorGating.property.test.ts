// Feature: ai-escape-room, Property 3: Door gating invariant
// For any room, door locked iff gating puzzle unsolved; solving puzzle unlocks door; never unlocked while unsolved
// Validates: Requirements 1.5, 1.6, 11.3

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { useRoomManagerStore } from '../hooks/useRoomManager';
import type { Room } from '../types/room';

// Helper to reset the store before each test
function resetStore() {
  const store = useRoomManagerStore.getState();
  store.rooms = [];
  store.solvedPuzzles = new Set();
  store.currentRoomIndex = 0;
}

describe('Property 3: Door gating invariant', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should keep door locked when gating puzzle is unsolved', () => {
    fc.assert(
      fc.property(
        // Generate a room with a gating puzzle
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          displayName: fc.string({ minLength: 1, maxLength: 50 }),
          gatingPuzzleId: fc.string({ minLength: 1, maxLength: 20 }),
          isUnlocked: fc.constant(false),
        }),
        (roomData) => {
          resetStore();
          
          const room: Room = {
            ...roomData,
            props: [],
          };
          
          const store = useRoomManagerStore.getState();
          store.setRooms([room]);
          
          // Door should be locked when puzzle is unsolved
          const isUnlocked = store.isDoorUnlocked(0);
          expect(isUnlocked).toBe(false);
          
          // tryUnlockDoor should return false and fire event
          let eventFired = false;
          store.onDoorAttemptedWhileLocked.add(() => { eventFired = true; });
          
          const result = store.tryUnlockDoor(0);
          expect(result).toBe(false);
          expect(eventFired).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should unlock door when gating puzzle is solved', () => {
    fc.assert(
      fc.property(
        // Generate a room with a gating puzzle
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          displayName: fc.string({ minLength: 1, maxLength: 50 }),
          gatingPuzzleId: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        (roomData) => {
          resetStore();
          
          const room: Room = {
            ...roomData,
            props: [],
            isUnlocked: false,
          };
          
          const store = useRoomManagerStore.getState();
          store.setRooms([room]);
          
          // Initially locked
          expect(store.isDoorUnlocked(0)).toBe(false);
          
          // Solve the puzzle
          let unlockEventFired = false;
          let unlockedRoomIndex: number | null = null;
          store.onDoorUnlocked.add((index) => { 
            unlockEventFired = true; 
            unlockedRoomIndex = index;
          });
          
          store.markPuzzleSolved(roomData.gatingPuzzleId);
          
          // Door should now be unlocked
          expect(store.isDoorUnlocked(0)).toBe(true);
          expect(unlockEventFired).toBe(true);
          expect(unlockedRoomIndex).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never have door unlocked while puzzle remains unsolved', () => {
    fc.assert(
      fc.property(
        // Generate multiple rooms with different puzzles
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            gatingPuzzleId: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        // Generate a subset of puzzles to solve
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 0, maxLength: 3 }),
        (roomDataList, puzzleIndicesToSolve) => {
          resetStore();
          
          const rooms: Room[] = roomDataList.map((data, index) => ({
            id: data.id,
            displayName: `Room ${index}`,
            props: [],
            gatingPuzzleId: data.gatingPuzzleId,
            isUnlocked: index === 0, // First room unlocked
          }));
          
          const store = useRoomManagerStore.getState();
          store.setRooms(rooms);
          
          // Solve some puzzles
          const solvedPuzzleIds = new Set<string>();
          puzzleIndicesToSolve.forEach(index => {
            if (index < roomDataList.length) {
              const puzzleId = roomDataList[index].gatingPuzzleId;
              store.markPuzzleSolved(puzzleId);
              solvedPuzzleIds.add(puzzleId);
            }
          });
          
          // Verify invariant: door unlocked iff puzzle solved
          rooms.forEach((room, index) => {
            if (index === 0) return; // Skip first room (always unlocked)
            
            const isPuzzleSolved = solvedPuzzleIds.has(room.gatingPuzzleId);
            const isDoorUnlocked = store.isDoorUnlocked(index);
            
            // Invariant: door unlocked iff puzzle solved
            expect(isDoorUnlocked).toBe(isPuzzleSolved);
            
            // If puzzle is not solved, door must be locked
            if (!isPuzzleSolved) {
              expect(isDoorUnlocked).toBe(false);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain door state consistency after multiple puzzle solves', () => {
    fc.assert(
      fc.property(
        // Generate unique puzzle IDs to ensure each room has a distinct gating puzzle
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }),
          { minLength: 2, maxLength: 4 }
        ).map(ids => [...new Set(ids)]).filter(ids => ids.length >= 2),
        // Generate order of puzzle solves (permutation indices)
        fc.array(fc.integer(), { minLength: 0, maxLength: 10 }),
        (uniquePuzzleIds, solveOrder) => {
          resetStore();
          
          // Create rooms with unique puzzle IDs
          const rooms: Room[] = uniquePuzzleIds.map((puzzleId, index) => ({
            id: `room_${index}`,
            displayName: `Room ${index}`,
            props: [],
            gatingPuzzleId: puzzleId,
            isUnlocked: index === 0, // First room always unlocked
          }));
          
          const store = useRoomManagerStore.getState();
          store.setRooms(rooms);
          
          // Solve puzzles in random order
          solveOrder.forEach(index => {
            const actualIndex = Math.abs(index) % uniquePuzzleIds.length;
            const puzzleId = uniquePuzzleIds[actualIndex];
            store.markPuzzleSolved(puzzleId);
          });
          
          // Verify final state consistency
          // Get fresh state after all puzzle solves
          const finalState = useRoomManagerStore.getState();
          const solvedPuzzles = finalState.solvedPuzzles;
          
          finalState.rooms.forEach((room, index) => {
            if (index === 0) {
              // First room always unlocked regardless of puzzle state
              expect(finalState.isDoorUnlocked(0)).toBe(true);
            } else {
              const isPuzzleSolved = solvedPuzzles.has(room.gatingPuzzleId);
              const isDoorUnlocked = finalState.isDoorUnlocked(index);
              
              // Invariant must hold: door unlocked iff puzzle solved
              expect(isDoorUnlocked).toBe(isPuzzleSolved);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not unlock door when wrong puzzle is solved', () => {
    fc.assert(
      fc.property(
        // Generate room with a gating puzzle
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          gatingPuzzleId: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        // Generate a different puzzle ID
        fc.string({ minLength: 1, maxLength: 20 }),
        (roomData, wrongPuzzleId) => {
          // Skip if puzzle IDs are the same
          fc.pre(roomData.gatingPuzzleId !== wrongPuzzleId);
          
          resetStore();
          
          const room: Room = {
            id: roomData.id,
            displayName: 'Test Room',
            props: [],
            gatingPuzzleId: roomData.gatingPuzzleId,
            isUnlocked: false,
          };
          
          const store = useRoomManagerStore.getState();
          store.setRooms([room]);
          
          // Solve the wrong puzzle
          store.markPuzzleSolved(wrongPuzzleId);
          
          // Door should still be locked
          expect(store.isDoorUnlocked(0)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple rooms with same gating puzzle', () => {
    fc.assert(
      fc.property(
        // Generate a shared puzzle ID
        fc.string({ minLength: 1, maxLength: 20 }),
        // Generate room count
        fc.integer({ min: 2, max: 5 }),
        (sharedPuzzleId, roomCount) => {
          resetStore();
          
          const rooms: Room[] = Array.from({ length: roomCount }, (_, index) => ({
            id: `room_${index}`,
            displayName: `Room ${index}`,
            props: [],
            gatingPuzzleId: sharedPuzzleId,
            isUnlocked: index === 0,
          }));
          
          const store = useRoomManagerStore.getState();
          store.setRooms(rooms);
          
          // All doors should be locked initially (except first room)
          for (let i = 1; i < roomCount; i++) {
            expect(store.isDoorUnlocked(i)).toBe(false);
          }
          
          // Solve the shared puzzle
          store.markPuzzleSolved(sharedPuzzleId);
          
          // All doors should now be unlocked
          for (let i = 0; i < roomCount; i++) {
            expect(store.isDoorUnlocked(i)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
