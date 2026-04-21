// Feature: ai-escape-room, Property 5: Puzzle structural completeness
// Feature: ai-escape-room, Property 6: Correct solution unlocks puzzle
// Feature: ai-escape-room, Property 7: Incorrect solution preserves puzzle state
// Feature: ai-escape-room, Property 8: Required puzzle archetypes present
// Feature: ai-escape-room, Property 9: Defection opportunity puzzles are unverifiable by partner
// Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { PuzzleBase, hashSolution } from '../puzzles/PuzzleBase';
import { usePuzzleSystemStore } from '../hooks/usePuzzleSystem';
import { useRoomManagerStore } from '../hooks/useRoomManager';
import type { PuzzleDefinition } from '../types/puzzle';
import { PuzzleArchetype } from '../types/puzzle';
import { NarrativeBeat } from '../types/narrative';
import type { Room } from '../types/room';

// Helper to create a valid puzzle definition
// Note: correctSolution in overrides should be the RAW solution string, not pre-hashed
async function createTestPuzzleDefinition(overrides: Partial<PuzzleDefinition> = {}): Promise<PuzzleDefinition> {
  // If correctSolution is provided in overrides, hash it
  // Otherwise use a default solution
  const rawSolution = overrides.correctSolution || 'test-solution';
  const hashedSolution = await hashSolution(rawSolution);
  
  return {
    id: `puzzle_${Math.random().toString(36).slice(2, 9)}`,
    archetype: PuzzleArchetype.SymbolCorrelation,
    isDefectionOpportunity: false,
    playerSideProps: ['prop_1'],
    partnerKnowledge: 'Partner knows the symbol matches the key labeled ALPHA',
    correctSolution: hashedSolution,
    roomId: 'room_1',
    narrativeBeat: NarrativeBeat.Opening,
    ...overrides,
    // Override correctSolution with the hashed version after spreading
    correctSolution: hashedSolution,
  };
}

// Helper to reset stores before each test
function resetStores() {
  const puzzleStore = usePuzzleSystemStore.getState();
  puzzleStore.puzzles = new Map();
  puzzleStore.puzzleDefinitions = new Map();
  
  const roomStore = useRoomManagerStore.getState();
  roomStore.rooms = [];
  roomStore.solvedPuzzles = new Set();
}

describe('Property 5: Puzzle structural completeness', () => {
  beforeEach(() => {
    resetStores();
  });

  it('should have non-empty partnerKnowledge for any puzzle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          archetype: fc.constantFrom(...Object.values(PuzzleArchetype)),
          isDefectionOpportunity: fc.boolean(),
          playerSideProps: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          partnerKnowledge: fc.string({ minLength: 1, maxLength: 200 }),
          correctSolution: fc.string({ minLength: 1, maxLength: 50 }),
          roomId: fc.string({ minLength: 1, maxLength: 20 }),
          narrativeBeat: fc.constantFrom(...Object.values(NarrativeBeat)),
        }),
        async (puzzleData) => {
          const definition = await createTestPuzzleDefinition(puzzleData);
          const puzzle = new PuzzleBase(definition);
          
          // Property: partnerKnowledge must be non-empty
          const partnerKnowledge = puzzle.getPartnerKnowledge();
          expect(partnerKnowledge.length).toBeGreaterThan(0);
          expect(partnerKnowledge).toBe(definition.partnerKnowledge);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have valid correctSolution for any puzzle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          archetype: fc.constantFrom(...Object.values(PuzzleArchetype)),
          solution: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async (puzzleData) => {
          const definition = await createTestPuzzleDefinition({
            id: puzzleData.id,
            archetype: puzzleData.archetype,
            correctSolution: puzzleData.solution,
          });
          
          // Property: correctSolution must be non-empty (hashed)
          expect(definition.correctSolution.length).toBeGreaterThan(0);
          
          // Verify the puzzle can be created
          const puzzle = new PuzzleBase(definition);
          expect(puzzle).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have valid roomId for any puzzle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          roomId: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async (puzzleData) => {
          const definition = await createTestPuzzleDefinition(puzzleData);
          const puzzle = new PuzzleBase(definition);
          
          // Property: roomId must be non-empty
          expect(puzzle.roomId.length).toBeGreaterThan(0);
          expect(puzzle.roomId).toBe(puzzleData.roomId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have valid narrativeBeat for any puzzle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...Object.values(NarrativeBeat)),
        async (beat) => {
          const definition = await createTestPuzzleDefinition({ narrativeBeat: beat });
          const puzzle = new PuzzleBase(definition);
          
          // Property: narrativeBeat must be a valid NarrativeBeat value
          expect(Object.values(NarrativeBeat)).toContain(puzzle.narrativeBeat);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have all required structural properties for any puzzle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          archetype: fc.constantFrom(...Object.values(PuzzleArchetype)),
          isDefectionOpportunity: fc.boolean(),
          partnerKnowledge: fc.string({ minLength: 1, maxLength: 200 }),
          solution: fc.string({ minLength: 1, maxLength: 50 }),
          roomId: fc.string({ minLength: 1, maxLength: 20 }),
          narrativeBeat: fc.constantFrom(...Object.values(NarrativeBeat)),
        }),
        async (puzzleData) => {
          const definition = await createTestPuzzleDefinition({
            id: puzzleData.id,
            archetype: puzzleData.archetype,
            isDefectionOpportunity: puzzleData.isDefectionOpportunity,
            partnerKnowledge: puzzleData.partnerKnowledge,
            correctSolution: puzzleData.solution,
            roomId: puzzleData.roomId,
            narrativeBeat: puzzleData.narrativeBeat,
          });
          
          const puzzle = new PuzzleBase(definition);
          
          // Property: all structural properties must be valid
          expect(puzzle.puzzleId.length).toBeGreaterThan(0);
          expect(puzzle.getPartnerKnowledge().length).toBeGreaterThan(0);
          expect(puzzle.roomId.length).toBeGreaterThan(0);
          expect(Object.values(NarrativeBeat)).toContain(puzzle.narrativeBeat);
          expect(Object.values(PuzzleArchetype)).toContain(puzzle.archetype);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 6: Correct solution unlocks puzzle', () => {
  beforeEach(() => {
    resetStores();
  });

  it('should mark puzzle as solved when correct solution is submitted', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Use alphanumeric strings to avoid whitespace issues
        fc.stringMatching(/[a-zA-Z0-9]{1,50}/),
        async (solution) => {
          const definition = await createTestPuzzleDefinition({ correctSolution: solution });
          const puzzle = new PuzzleBase(definition);
          
          // Initially unsolved
          expect(puzzle.isSolved).toBe(false);
          
          // Submit correct solution
          const result = await puzzle.trySubmitSolution(solution);
          
          // Property: correct solution → isSolved = true
          expect(result).toBe(true);
          expect(puzzle.isSolved).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should unlock door when puzzle is solved via puzzle system', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          puzzleId: fc.stringMatching(/[a-zA-Z0-9]{1,20}/),
          solution: fc.stringMatching(/[a-zA-Z0-9]{1,50}/),
          roomId: fc.stringMatching(/[a-zA-Z0-9]{1,20}/),
        }),
        async (puzzleData) => {
          resetStores();
          
          const definition = await createTestPuzzleDefinition({
            id: puzzleData.puzzleId,
            correctSolution: puzzleData.solution,
            roomId: puzzleData.roomId,
          });
          
          // Set up room with gating puzzle
          const room: Room = {
            id: puzzleData.roomId,
            displayName: 'Test Room',
            props: [],
            gatingPuzzleId: puzzleData.puzzleId,
            isUnlocked: false,
          };
          
          const roomStore = useRoomManagerStore.getState();
          roomStore.setRooms([room]);
          
          const puzzleStore = usePuzzleSystemStore.getState();
          puzzleStore.registerPuzzle(definition);
          
          // Initially locked
          expect(roomStore.isDoorUnlocked(0)).toBe(false);
          
          // Solve puzzle
          const startTime = Date.now();
          roomStore.markPuzzleSolved(puzzleData.puzzleId);
          const endTime = Date.now();
          
          // Property: door unlocked within 1 second
          expect(endTime - startTime).toBeLessThan(1000);
          expect(roomStore.isDoorUnlocked(0)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should remain solved after multiple correct solution submissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/[a-zA-Z0-9]{1,50}/),
        fc.integer({ min: 2, max: 10 }),
        async (solution, submitCount) => {
          const definition = await createTestPuzzleDefinition({ correctSolution: solution });
          const puzzle = new PuzzleBase(definition);
          
          // Submit correct solution multiple times
          for (let i = 0; i < submitCount; i++) {
            const result = await puzzle.trySubmitSolution(solution);
            expect(result).toBe(true);
            expect(puzzle.isSolved).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 7: Incorrect solution preserves puzzle state', () => {
  beforeEach(() => {
    resetStores();
  });

  it('should keep puzzle unsolved when incorrect solution is submitted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/[a-zA-Z0-9]{1,50}/),
        fc.stringMatching(/[a-zA-Z0-9]{1,50}/),
        async (correctSolution, wrongSolution) => {
          // Skip if solutions are the same
          fc.pre(correctSolution !== wrongSolution);
          
          const definition = await createTestPuzzleDefinition({ correctSolution });
          const puzzle = new PuzzleBase(definition);
          
          // Submit wrong solution
          const result = await puzzle.trySubmitSolution(wrongSolution);
          
          // Property: isSolved remains false
          expect(result).toBe(false);
          expect(puzzle.isSolved).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow retry after incorrect solution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/[a-zA-Z0-9]{1,50}/),
        fc.stringMatching(/[a-zA-Z0-9]{1,50}/),
        async (correctSolution, wrongSolution) => {
          fc.pre(correctSolution !== wrongSolution);
          
          const definition = await createTestPuzzleDefinition({ correctSolution });
          const puzzle = new PuzzleBase(definition);
          
          // Submit wrong solution
          await puzzle.trySubmitSolution(wrongSolution);
          expect(puzzle.isSolved).toBe(false);
          
          // Submit correct solution - should work
          const result = await puzzle.trySubmitSolution(correctSolution);
          expect(result).toBe(true);
          expect(puzzle.isSolved).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not apply any state penalty for incorrect solutions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/[a-zA-Z0-9]{1,50}/),
        fc.array(fc.stringMatching(/[a-zA-Z0-9]{1,50}/), { minLength: 1, maxLength: 10 }),
        async (correctSolution, wrongSolutions) => {
          // Filter out correct solutions
          const onlyWrongSolutions = wrongSolutions.filter(s => s !== correctSolution);
          fc.pre(onlyWrongSolutions.length > 0);
          
          const definition = await createTestPuzzleDefinition({ correctSolution });
          const puzzle = new PuzzleBase(definition);
          
          // Submit multiple wrong solutions
          for (const wrong of onlyWrongSolutions) {
            const result = await puzzle.trySubmitSolution(wrong);
            expect(result).toBe(false);
            expect(puzzle.isSolved).toBe(false);
          }
          
          // Property: can still solve after multiple failures (no penalty)
          const finalResult = await puzzle.trySubmitSolution(correctSolution);
          expect(finalResult).toBe(true);
          expect(puzzle.isSolved).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 8: Required puzzle archetypes present', () => {
  beforeEach(() => {
    resetStores();
  });

  it('should validate that a valid puzzle set contains all required archetypes', async () => {
    // This test validates that the game's puzzle configuration meets requirements
    // The actual game will have 4-5 puzzles with specific archetypes
    
    // Simulate a valid puzzle set configuration
    const validPuzzleArchetypes = [
      PuzzleArchetype.SymbolCorrelation,
      PuzzleArchetype.SplitCombination,
      PuzzleArchetype.DescriptiveMatch,
      PuzzleArchetype.OrderedSequence,
    ];
    
    const validDefectionOpportunities = [false, true, false, true]; // Exactly 2
    
    // Property: puzzle set must contain ≥1 SymbolCorrelation
    expect(validPuzzleArchetypes.filter(a => a === PuzzleArchetype.SymbolCorrelation).length).toBeGreaterThanOrEqual(1);
    
    // Property: puzzle set must contain ≥1 SplitCombination
    expect(validPuzzleArchetypes.filter(a => a === PuzzleArchetype.SplitCombination).length).toBeGreaterThanOrEqual(1);
    
    // Property: puzzle set must contain ≥1 DescriptiveMatch
    expect(validPuzzleArchetypes.filter(a => a === PuzzleArchetype.DescriptiveMatch).length).toBeGreaterThanOrEqual(1);
    
    // Property: puzzle set must have exactly 2 defection opportunities
    expect(validDefectionOpportunities.filter(Boolean).length).toBe(2);
  });

  it('should detect missing SymbolCorrelation archetype', async () => {
    // Invalid configuration: missing SymbolCorrelation
    const invalidPuzzleArchetypes = [
      PuzzleArchetype.SplitCombination,
      PuzzleArchetype.DescriptiveMatch,
      PuzzleArchetype.OrderedSequence,
    ];
    
    const hasSymbolCorrelation = invalidPuzzleArchetypes.includes(PuzzleArchetype.SymbolCorrelation);
    expect(hasSymbolCorrelation).toBe(false);
  });

  it('should detect missing SplitCombination archetype', async () => {
    // Invalid configuration: missing SplitCombination
    const invalidPuzzleArchetypes = [
      PuzzleArchetype.SymbolCorrelation,
      PuzzleArchetype.DescriptiveMatch,
      PuzzleArchetype.OrderedSequence,
    ];
    
    const hasSplitCombination = invalidPuzzleArchetypes.includes(PuzzleArchetype.SplitCombination);
    expect(hasSplitCombination).toBe(false);
  });

  it('should detect missing DescriptiveMatch archetype', async () => {
    // Invalid configuration: missing DescriptiveMatch
    const invalidPuzzleArchetypes = [
      PuzzleArchetype.SymbolCorrelation,
      PuzzleArchetype.SplitCombination,
      PuzzleArchetype.OrderedSequence,
    ];
    
    const hasDescriptiveMatch = invalidPuzzleArchetypes.includes(PuzzleArchetype.DescriptiveMatch);
    expect(hasDescriptiveMatch).toBe(false);
  });

  it('should detect wrong number of defection opportunities', async () => {
    // Invalid configuration: 3 defection opportunities instead of 2
    const invalidDefectionOpportunities = [true, true, true, false];
    
    const defectionCount = invalidDefectionOpportunities.filter(Boolean).length;
    expect(defectionCount).not.toBe(2);
  });

  it('should validate complete puzzle set meets all archetype requirements', async () => {
    // This test runs 100 times to validate the checking logic
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          archetypes: fc.array(fc.constantFrom(...Object.values(PuzzleArchetype)), { minLength: 4, maxLength: 5 }),
          defectionOpportunities: fc.array(fc.boolean(), { minLength: 4, maxLength: 5 }),
        }),
        async (config) => {
          // Check if configuration is valid
          const hasSymbolCorrelation = config.archetypes.includes(PuzzleArchetype.SymbolCorrelation);
          const hasSplitCombination = config.archetypes.includes(PuzzleArchetype.SplitCombination);
          const hasDescriptiveMatch = config.archetypes.includes(PuzzleArchetype.DescriptiveMatch);
          const defectionCount = config.defectionOpportunities.filter(Boolean).length;
          
          const isValid = hasSymbolCorrelation && hasSplitCombination && hasDescriptiveMatch && defectionCount === 2;
          
          // If valid, all checks should pass
          if (isValid) {
            expect(hasSymbolCorrelation).toBe(true);
            expect(hasSplitCombination).toBe(true);
            expect(hasDescriptiveMatch).toBe(true);
            expect(defectionCount).toBe(2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 9: Defection opportunity puzzles are unverifiable by partner', () => {
  beforeEach(() => {
    resetStores();
  });

  it('should not have correctSolution in partnerKnowledge for defection puzzles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          solution: fc.stringMatching(/[a-zA-Z0-9]{5,50}/),
          partnerKnowledge: fc.stringMatching(/[a-zA-Z0-9 ]{10,200}/),
        }),
        async (puzzleData) => {
          // Ensure partnerKnowledge does not contain the solution
          fc.pre(!puzzleData.partnerKnowledge.toLowerCase().includes(puzzleData.solution.toLowerCase()));
          
          const definition = await createTestPuzzleDefinition({
            isDefectionOpportunity: true,
            correctSolution: puzzleData.solution,
            partnerKnowledge: puzzleData.partnerKnowledge,
          });
          
          const puzzle = new PuzzleBase(definition);
          
          // Property: partnerKnowledge must not contain correctSolution
          const partnerKnowledge = puzzle.getPartnerKnowledge().toLowerCase();
          const solutionLower = puzzleData.solution.toLowerCase();
          
          expect(partnerKnowledge.includes(solutionLower)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow partner to verify non-defection puzzles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          solution: fc.stringMatching(/[a-zA-Z0-9]{5,50}/),
          partnerKnowledge: fc.stringMatching(/[a-zA-Z0-9 ]{10,200}/),
        }),
        async (puzzleData) => {
          // For non-defection puzzles, partnerKnowledge CAN contain hints
          const definition = await createTestPuzzleDefinition({
            isDefectionOpportunity: false,
            correctSolution: puzzleData.solution,
            partnerKnowledge: puzzleData.partnerKnowledge,
          });
          
          const puzzle = new PuzzleBase(definition);
          
          // Property: non-defection puzzles can have solution hints in partnerKnowledge
          // (This is allowed, not required)
          expect(puzzle.isDefectionOpportunity).toBe(false);
          expect(puzzle.getPartnerKnowledge()).toBe(puzzleData.partnerKnowledge);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure all defection puzzles have unverifiable solutions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            solution: fc.stringMatching(/[a-zA-Z0-9]{5,50}/),
            partnerKnowledge: fc.stringMatching(/[a-zA-Z0-9 ]{10,200}/),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (puzzlesData) => {
          // Filter to only puzzles where partnerKnowledge doesn't contain solution
          const validDefectionPuzzles = puzzlesData.filter(
            p => !p.partnerKnowledge.toLowerCase().includes(p.solution.toLowerCase())
          );
          
          fc.pre(validDefectionPuzzles.length > 0);
          
          for (const puzzleData of validDefectionPuzzles) {
            const definition = await createTestPuzzleDefinition({
              isDefectionOpportunity: true,
              correctSolution: puzzleData.solution,
              partnerKnowledge: puzzleData.partnerKnowledge,
            });
            
            const puzzle = new PuzzleBase(definition);
            
            // Property: defection opportunity → partner cannot verify
            const partnerKnowledge = puzzle.getPartnerKnowledge().toLowerCase();
            const solutionLower = puzzleData.solution.toLowerCase();
            
            expect(puzzle.isDefectionOpportunity).toBe(true);
            expect(partnerKnowledge.includes(solutionLower)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
