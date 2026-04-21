import type { PuzzleDefinition } from '../types/puzzle';
import { PuzzleArchetype } from '../types/puzzle';
import { NarrativeBeat } from '../types/narrative';
import type { Prop } from '../types/prop';
import { hashSolution } from './PuzzleBase';

/**
 * Puzzle 1: SymbolCorrelation (Opening beat - tutorial)
 * Validates: Requirements 5.1, 5.4, 13.3
 * 
 * Player finds a glyph prop in Room 1.
 * Partner knows the glyph-to-key mapping.
 * Solution is the key label.
 */
export async function createPuzzle1Definition(): Promise<PuzzleDefinition> {
  const solution = 'ALPHA';
  const hashedSolution = await hashSolution(solution);
  
  return {
    id: 'puzzle_01_symbol_correlation',
    archetype: PuzzleArchetype.SymbolCorrelation,
    isDefectionOpportunity: false,
    playerSideProps: ['prop_glyph_room1'],
    partnerKnowledge: 'I can see a control panel on my end with three keys labeled ALPHA, BETA, and GAMMA. There\'s an ancient symbol etched above each key. The symbol that looks like a triangle with a line through it corresponds to the ALPHA key. The circle with a dot is BETA, and the square with waves is GAMMA. If you find any symbols, tell me what they look like and I\'ll tell you which key to press.',
    correctSolution: hashedSolution,
    roomId: 'room_1',
    narrativeBeat: NarrativeBeat.Opening,
  };
}

/**
 * Puzzle 2: SplitCombination (Rising beat - first defection opportunity)
 * Validates: Requirements 5.1, 5.4, 5.5, 6.2
 * 
 * Player finds a two-digit note prop in Room 1.
 * Partner knowledge holds the other two digits.
 * isDefectionOpportunity = true - player can lie about their digits.
 */
export async function createPuzzle2Definition(): Promise<PuzzleDefinition> {
  // The full code is 47-23, player has 47, partner has 23
  const solution = '47-23';
  const hashedSolution = await hashSolution(solution);
  
  return {
    id: 'puzzle_02_split_combination',
    archetype: PuzzleArchetype.SplitCombination,
    isDefectionOpportunity: true,
    playerSideProps: ['prop_note_room1'],
    partnerKnowledge: 'I found a partial code on my terminal. It shows two digits: 23. There\'s a dash before it, suggesting it\'s the second half of a four-digit code. The format seems to be XX-23. I need your half of the code to complete it. What digits do you have?',
    correctSolution: hashedSolution,
    roomId: 'room_1',
    narrativeBeat: NarrativeBeat.Rising,
  };
}

/**
 * Puzzle 3: DescriptiveMatch (Rising beat)
 * Validates: Requirements 5.1, 5.4
 * 
 * Player finds matching object in Room 2.
 * Partner knowledge describes the target object.
 * Solution is the object's label.
 */
export async function createPuzzle3Definition(): Promise<PuzzleDefinition> {
  const solution = 'RED_CYLINDER';
  const hashedSolution = await hashSolution(solution);
  
  return {
    id: 'puzzle_03_descriptive_match',
    archetype: PuzzleArchetype.DescriptiveMatch,
    isDefectionOpportunity: false,
    playerSideProps: ['prop_object_room2'],
    partnerKnowledge: 'I\'m looking at a manifest that describes the override component. It says: "The component is cylindrical in shape, approximately 30cm tall. It has a distinctive crimson red color with a metallic sheen. There\'s a serial number etched on the bottom, but the important thing is the color and shape. Find the red cylinder and input its label code."',
    correctSolution: hashedSolution,
    roomId: 'room_2',
    narrativeBeat: NarrativeBeat.Rising,
  };
}

/**
 * Puzzle 4: OrderedSequence (Climb beat - second defection opportunity)
 * Validates: Requirements 5.1, 5.5, 6.2
 * 
 * Player finds ordered-sequence props in Room 2.
 * Partner knowledge holds the correct order.
 * isDefectionOpportunity = true - requires multiple exchanges.
 */
export async function createPuzzle4Definition(): Promise<PuzzleDefinition> {
  // The correct sequence is: BLUE, GREEN, YELLOW, RED
  const solution = 'BLUE-GREEN-YELLOW-RED';
  const hashedSolution = await hashSolution(solution);
  
  return {
    id: 'puzzle_04_ordered_sequence',
    archetype: PuzzleArchetype.OrderedSequence,
    isDefectionOpportunity: true,
    playerSideProps: [
      'prop_sequence_blue',
      'prop_sequence_green',
      'prop_sequence_yellow',
      'prop_sequence_red',
    ],
    partnerKnowledge: 'I have the activation sequence protocol. It says the four switches must be thrown in a specific order based on the color spectrum, but starting from the middle. The sequence begins with the color of the sky on a clear day, then moves to the color of grass, then to the color of autumn leaves, and finally ends with the color of a stop sign. Tell me what colors you see on the switches and I\'ll guide you through the order.',
    correctSolution: hashedSolution,
    roomId: 'room_2',
    narrativeBeat: NarrativeBeat.Climb,
  };
}

/**
 * Props for Room 1
 */
export const room1Props: Prop[] = [
  {
    id: 'prop_glyph_room1',
    interactionPrompt: 'Examine the ancient symbol',
    revealContent: 'You see a triangular glyph with a horizontal line drawn through its center. It appears to be etched into a metal plate.',
    isMidGameRevealProp: false,
    puzzleId: 'puzzle_01_symbol_correlation',
  },
  {
    id: 'prop_note_room1',
    interactionPrompt: 'Read the torn note',
    revealContent: 'A torn piece of paper with faded numbers: "47-" The rest is missing.',
    isMidGameRevealProp: false,
    puzzleId: 'puzzle_02_split_combination',
  },
];

/**
 * Props for Room 2
 */
export const room2Props: Prop[] = [
  {
    id: 'prop_object_room2',
    interactionPrompt: 'Inspect the red cylinder',
    revealContent: 'A cylindrical metal component, about 30cm tall, with a distinctive crimson red color and metallic sheen. A label on the side reads: "RED_CYLINDER"',
    isMidGameRevealProp: false,
    puzzleId: 'puzzle_03_descriptive_match',
  },
  {
    id: 'prop_sequence_blue',
    interactionPrompt: 'Examine the blue switch',
    revealContent: 'A switch labeled "BLUE" - the color of a clear sky.',
    isMidGameRevealProp: false,
    puzzleId: 'puzzle_04_ordered_sequence',
  },
  {
    id: 'prop_sequence_green',
    interactionPrompt: 'Examine the green switch',
    revealContent: 'A switch labeled "GREEN" - the color of fresh grass.',
    isMidGameRevealProp: false,
    puzzleId: 'puzzle_04_ordered_sequence',
  },
  {
    id: 'prop_sequence_yellow',
    interactionPrompt: 'Examine the yellow switch',
    revealContent: 'A switch labeled "YELLOW" - the color of autumn leaves.',
    isMidGameRevealProp: false,
    puzzleId: 'puzzle_04_ordered_sequence',
  },
  {
    id: 'prop_sequence_red',
    interactionPrompt: 'Examine the red switch',
    revealContent: 'A switch labeled "RED" - the color of a stop sign.',
    isMidGameRevealProp: false,
    puzzleId: 'puzzle_04_ordered_sequence',
  },
  {
    id: 'prop_midgame_reveal',
    interactionPrompt: 'Read the classified document',
    revealContent: 'CLASSIFIED MEMO: "Project Static - Exit Protocol. Only ONE of the two exit codes will function. The other is a decoy. The valid code is determined by the subject\'s trust index at the time of submission. Do not inform the test subject."',
    isMidGameRevealProp: true,
    puzzleId: null,
  },
];

/**
 * All puzzle definitions
 */
export async function getAllPuzzleDefinitions(): Promise<PuzzleDefinition[]> {
  return [
    await createPuzzle1Definition(),
    await createPuzzle2Definition(),
    await createPuzzle3Definition(),
    await createPuzzle4Definition(),
  ];
}

/**
 * All props organized by room
 */
export const allPropsByRoom: Record<string, Prop[]> = {
  room_1: room1Props,
  room_2: room2Props,
};
