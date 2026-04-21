import type { NarrativeBeat } from './narrative';

export enum PuzzleArchetype {
  SymbolCorrelation = 'SymbolCorrelation',
  SplitCombination = 'SplitCombination',
  DescriptiveMatch = 'DescriptiveMatch',
  OrderedSequence = 'OrderedSequence',
}

export interface PuzzleDefinition {
  id: string;
  archetype: PuzzleArchetype;
  isDefectionOpportunity: boolean;
  partnerKnowledge: string;
  /** Plain text solution; compared case-insensitively with trimmed input. */
  correctSolution: string;
  narrativeBeat: NarrativeBeat;
}
