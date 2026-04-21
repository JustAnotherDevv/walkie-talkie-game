import type { NarrativeBeat } from './narrative';

// Puzzle archetype enum - different puzzle types
// Validates: Requirements 5.4
export enum PuzzleArchetype {
  SymbolCorrelation = 'SymbolCorrelation', // match symbols to keys
  SplitCombination = 'SplitCombination',   // player and partner each have part of code
  DescriptiveMatch = 'DescriptiveMatch',   // partner describes, player finds object
  OrderedSequence = 'OrderedSequence',     // multi-turn sequence puzzle
}

// Puzzle definition interface
// Validates: Requirements 5.1, 5.5, 5.6, 5.7
export interface PuzzleDefinition {
  id: string                        // e.g. "puzzle_01_symbol_correlation"
  archetype: PuzzleArchetype        // SymbolCorrelation | SplitCombination | DescriptiveMatch | ...
  isDefectionOpportunity: boolean   // can player lie/withhold info?
  playerSideProps: string[]         // prop IDs visible to player
  partnerKnowledge: string          // injected into agent system prompt
  correctSolution: string           // hashed; compared on submission
  roomId: string                    // which room this puzzle gates
  narrativeBeat: NarrativeBeat      // which beat this puzzle belongs to
}

/**
 * IPuzzle interface - runtime puzzle instance
 * Validates: Requirements 5.1, 5.2, 5.3
 */
export interface IPuzzle {
  /** Unique puzzle identifier */
  readonly puzzleId: string;
  
  /** Whether this puzzle allows player to lie/withhold info */
  readonly isDefectionOpportunity: boolean;
  
  /** Whether the puzzle has been solved */
  readonly isSolved: boolean;
  
  /** The archetype of this puzzle */
  readonly archetype: PuzzleArchetype;
  
  /** The room this puzzle is associated with */
  readonly roomId: string;
  
  /** The narrative beat this puzzle belongs to */
  readonly narrativeBeat: NarrativeBeat;
  
  /**
   * Attempt to submit a solution
   * @param input - The solution string to check
   * @returns true if correct, false otherwise
   * Validates: Requirements 5.2, 5.3
   */
  trySubmitSolution(input: string): Promise<boolean>;
  
  /**
   * Get the partner's knowledge for this puzzle
   * @returns The knowledge string the partner has access to
   * Validates: Requirements 5.1, 5.6
   */
  getPartnerKnowledge(): string;
}
