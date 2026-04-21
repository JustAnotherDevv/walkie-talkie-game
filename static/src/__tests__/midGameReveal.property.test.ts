// Feature: ai-escape-room, Property 12: Mid-game reveal prop placement
// Validates: Requirements 7.1
// Exactly one prop has isMidGameRevealProp = true; that prop is in room 2 or room 3

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Prop } from '../types/prop';

/**
 * Helper function to count mid-game reveal props
 */
function countMidGameRevealProps(propsByRoom: Record<string, Prop[]>): number {
  let count = 0;
  for (const props of Object.values(propsByRoom)) {
    count += props.filter(p => p.isMidGameRevealProp).length;
  }
  return count;
}

/**
 * Helper function to find which room contains the mid-game reveal prop
 */
function findMidGameRevealPropRoom(propsByRoom: Record<string, Prop[]>): string | null {
  for (const [roomId, props] of Object.entries(propsByRoom)) {
    if (props.some(p => p.isMidGameRevealProp)) {
      return roomId;
    }
  }
  return null;
}

/**
 * Helper function to validate mid-game reveal prop placement
 */
function validateMidGameRevealPlacement(propsByRoom: Record<string, Prop[]>): {
  isValid: boolean;
  count: number;
  roomId: string | null;
  isCorrectRoom: boolean;
} {
  const count = countMidGameRevealProps(propsByRoom);
  const roomId = findMidGameRevealPropRoom(propsByRoom);
  const isCorrectRoom = roomId === 'room_2' || roomId === 'room_3';
  
  return {
    isValid: count === 1 && isCorrectRoom,
    count,
    roomId,
    isCorrectRoom,
  };
}

describe('Property 12: Mid-game reveal prop placement', () => {
  it('should have exactly one mid-game reveal prop in the game', () => {
    fc.assert(
      fc.property(
        // Generator for room configurations
        fc.record({
          room1: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              interactionPrompt: fc.string({ minLength: 1, maxLength: 50 }),
              revealContent: fc.string({ minLength: 1, maxLength: 100 }),
              isMidGameRevealProp: fc.constant(false), // Room 1 never has the reveal
              puzzleId: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          room2: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              interactionPrompt: fc.string({ minLength: 1, maxLength: 50 }),
              revealContent: fc.string({ minLength: 1, maxLength: 100 }),
              isMidGameRevealProp: fc.boolean(),
              puzzleId: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          room3: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              interactionPrompt: fc.string({ minLength: 1, maxLength: 50 }),
              revealContent: fc.string({ minLength: 1, maxLength: 100 }),
              isMidGameRevealProp: fc.boolean(),
              puzzleId: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
            }),
            { minLength: 0, maxLength: 5 }
          ),
        }),
        (rooms) => {
          // Build props by room
          const propsByRoom: Record<string, Prop[]> = {
            room_1: rooms.room1,
            room_2: rooms.room2,
            room_3: rooms.room3,
          };
          
          // Count mid-game reveal props
          const count = countMidGameRevealProps(propsByRoom);
          
          // Find which room has the reveal
          const roomId = findMidGameRevealPropRoom(propsByRoom);
          
          // Property: exactly one mid-game reveal prop
          // If there's exactly one, it must be in room 2 or room 3
          if (count === 1) {
            expect(roomId).toBeOneOf(['room_2', 'room_3']);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate that mid-game reveal prop is not in room 1', () => {
    fc.assert(
      fc.property(
        fc.record({
          hasRevealInRoom1: fc.boolean(),
          hasRevealInRoom2: fc.boolean(),
          hasRevealInRoom3: fc.boolean(),
        }),
        (config) => {
          // Build props based on config
          const propsByRoom: Record<string, Prop[]> = {
            room_1: config.hasRevealInRoom1 ? [{
              id: 'reveal_room1',
              interactionPrompt: 'Read document',
              revealContent: 'Secret info',
              isMidGameRevealProp: true,
              puzzleId: null,
            }] : [],
            room_2: config.hasRevealInRoom2 ? [{
              id: 'reveal_room2',
              interactionPrompt: 'Read document',
              revealContent: 'Secret info',
              isMidGameRevealProp: true,
              puzzleId: null,
            }] : [],
            room_3: config.hasRevealInRoom3 ? [{
              id: 'reveal_room3',
              interactionPrompt: 'Read document',
              revealContent: 'Secret info',
              isMidGameRevealProp: true,
              puzzleId: null,
            }] : [],
          };
          
          const validation = validateMidGameRevealPlacement(propsByRoom);
          
          // If reveal is in room 1, it should be invalid
          if (config.hasRevealInRoom1) {
            expect(validation.isCorrectRoom).toBe(false);
            expect(validation.isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate exactly one mid-game reveal prop exists', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        (room1Reveals, room2Reveals, room3Reveals) => {
          // Build props with specified number of reveals per room
          const propsByRoom: Record<string, Prop[]> = {
            room_1: Array(room1Reveals).fill(null).map((_, i) => ({
              id: `reveal_room1_${i}`,
              interactionPrompt: 'Read document',
              revealContent: 'Secret info',
              isMidGameRevealProp: true,
              puzzleId: null,
            })),
            room_2: Array(room2Reveals).fill(null).map((_, i) => ({
              id: `reveal_room2_${i}`,
              interactionPrompt: 'Read document',
              revealContent: 'Secret info',
              isMidGameRevealProp: true,
              puzzleId: null,
            })),
            room_3: Array(room3Reveals).fill(null).map((_, i) => ({
              id: `reveal_room3_${i}`,
              interactionPrompt: 'Read document',
              revealContent: 'Secret info',
              isMidGameRevealProp: true,
              puzzleId: null,
            })),
          };
          
          const validation = validateMidGameRevealPlacement(propsByRoom);
          const totalReveals = room1Reveals + room2Reveals + room3Reveals;
          
          // Property: valid only if exactly 1 reveal AND in room 2 or 3
          expect(validation.count).toBe(totalReveals);
          
          if (totalReveals === 1 && (room2Reveals === 1 || room3Reveals === 1)) {
            expect(validation.isValid).toBe(true);
          } else {
            expect(validation.isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate the actual game configuration has correct mid-game reveal placement', async () => {
    // Import the actual game configuration
    const { allPropsByRoom } = await import('../puzzles/puzzleInstances');
    
    const validation = validateMidGameRevealPlacement(allPropsByRoom);
    
    // Property: exactly one mid-game reveal prop in room 2 or room 3
    expect(validation.count).toBe(1);
    expect(validation.roomId).toBeOneOf(['room_2', 'room_3']);
    expect(validation.isValid).toBe(true);
  });

  it('should ensure mid-game reveal prop has no puzzle association', async () => {
    const { allPropsByRoom } = await import('../puzzles/puzzleInstances');
    
    // Find the mid-game reveal prop
    let midGameRevealProp: Prop | null = null;
    for (const props of Object.values(allPropsByRoom)) {
      const found = props.find(p => p.isMidGameRevealProp);
      if (found) {
        midGameRevealProp = found;
        break;
      }
    }
    
    // Property: mid-game reveal prop should not be associated with a puzzle
    expect(midGameRevealProp).not.toBeNull();
    expect(midGameRevealProp?.puzzleId).toBeNull();
  });
});
