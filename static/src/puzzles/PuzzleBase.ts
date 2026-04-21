import type { IPuzzle, PuzzleDefinition } from '../types/puzzle';
import { PuzzleArchetype } from '../types/puzzle';
import type { NarrativeBeat } from '../types/narrative';

/**
 * Simple hash function for solution comparison
 * Uses SHA-256 for secure comparison
 */
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * PuzzleBase class - Base implementation of IPuzzle
 * Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7
 * 
 * Core puzzle behavior:
 * - Hash-based solution comparison for security
 * - Immutable puzzle definition
 * - State tracking for solved status
 */
export class PuzzleBase implements IPuzzle {
  readonly puzzleId: string;
  readonly isDefectionOpportunity: boolean;
  readonly archetype: PuzzleArchetype;
  readonly roomId: string;
  readonly narrativeBeat: NarrativeBeat;
  
  private _isSolved: boolean = false;
  private readonly correctSolutionHash: string;
  private readonly _partnerKnowledge: string;
  
  constructor(definition: PuzzleDefinition) {
    this.puzzleId = definition.id;
    this.isDefectionOpportunity = definition.isDefectionOpportunity;
    this.archetype = definition.archetype;
    this.roomId = definition.roomId;
    this.narrativeBeat = definition.narrativeBeat;
    this.correctSolutionHash = definition.correctSolution; // Already hashed
    this._partnerKnowledge = definition.partnerKnowledge;
  }
  
  get isSolved(): boolean {
    return this._isSolved;
  }
  
  /**
   * Attempt to submit a solution
   * Compares the hash of the input against the stored correct solution hash
   * Validates: Requirements 5.2, 5.3
   * 
   * @param input - The solution string to check
   * @returns true if correct (and marks puzzle as solved), false otherwise
   */
  async trySubmitSolution(input: string): Promise<boolean> {
    // If already solved, return true
    if (this._isSolved) {
      return true;
    }
    
    // Hash the input and compare
    const inputHash = await hashString(input);
    
    if (inputHash === this.correctSolutionHash) {
      this._isSolved = true;
      return true;
    }
    
    // Incorrect solution - no state penalty
    // Validates: Requirement 5.3
    return false;
  }
  
  /**
   * Get the partner's knowledge for this puzzle
   * Validates: Requirements 5.1, 5.6
   * 
   * @returns The knowledge string the partner has access to
   */
  getPartnerKnowledge(): string {
    return this._partnerKnowledge;
  }
}

/**
 * Helper function to pre-hash a solution for storage in PuzzleDefinition
 * Use this when creating puzzle definitions
 */
export async function hashSolution(solution: string): Promise<string> {
  return hashString(solution);
}
