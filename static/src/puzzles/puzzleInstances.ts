import { NarrativeBeat } from '../types/narrative';
import { PuzzleArchetype, type PuzzleDefinition } from '../types/puzzle';
import type { Prop } from '../types/prop';

export const puzzles: PuzzleDefinition[] = [
  {
    id: 'puzzle_01_symbol_correlation',
    archetype: PuzzleArchetype.SymbolCorrelation,
    isDefectionOpportunity: false,
    partnerKnowledge:
      'I can see a control panel on my end with three keys labeled ALPHA, BETA, and GAMMA. A triangle-with-line glyph matches ALPHA, a circle-with-dot matches BETA, a square-with-waves matches GAMMA.',
    correctSolution: 'ALPHA',
    narrativeBeat: NarrativeBeat.Opening,
  },
  {
    id: 'puzzle_02_split_combination',
    archetype: PuzzleArchetype.SplitCombination,
    isDefectionOpportunity: true,
    partnerKnowledge:
      'I see half of a code on my terminal: XX-23. I need your half.',
    correctSolution: '47-23',
    narrativeBeat: NarrativeBeat.Rising,
  },
  {
    id: 'puzzle_03_descriptive_match',
    archetype: PuzzleArchetype.DescriptiveMatch,
    isDefectionOpportunity: false,
    partnerKnowledge:
      'The override component is cylindrical, crimson red, ~30cm tall. Find the red cylinder and input its label code.',
    correctSolution: 'RED_CYLINDER',
    narrativeBeat: NarrativeBeat.Rising,
  },
  {
    id: 'puzzle_04_ordered_sequence',
    archetype: PuzzleArchetype.OrderedSequence,
    isDefectionOpportunity: true,
    partnerKnowledge:
      'Activation sequence in order: colour of sky on a clear day, colour of grass, colour of autumn leaves, colour of a stop sign.',
    correctSolution: 'BLUE-GREEN-YELLOW-RED',
    narrativeBeat: NarrativeBeat.Climb,
  },
];

export function getPuzzle(id: string): PuzzleDefinition | undefined {
  return puzzles.find((p) => p.id === id);
}

/**
 * Case- and whitespace-tolerant solution check.
 */
export function checkSolution(puzzleId: string, raw: string): boolean {
  const p = getPuzzle(puzzleId);
  if (!p) return false;
  const normalize = (s: string) => s.trim().toLowerCase();
  return normalize(p.correctSolution) === normalize(raw);
}

/**
 * Props placed in the world. Positions match the 3-room layout from
 * RoomScene: each room is centred at z = i * 14, X in [-5, 5].
 */
export const props: Prop[] = [
  // ── Room 0 (Opening + Rising puzzles) ─────────────────────────────
  {
    id: 'prop_glyph_room1',
    roomIndex: 0,
    position: [-3, -1.2, -3],
    interactionPrompt: 'Examine the ancient glyph',
    revealContent:
      'A triangular glyph with a horizontal line etched through its centre, stamped into a metal plate.',
    puzzleId: 'puzzle_01_symbol_correlation',
    color: '#38bdf8',
  },
  {
    id: 'prop_note_room1',
    roomIndex: 0,
    position: [3, -1.2, -3],
    interactionPrompt: 'Read the torn note',
    revealContent:
      'A torn page: "47-" — the rest is missing. Partner probably has the other half.',
    puzzleId: 'puzzle_02_split_combination',
    color: '#f59e0b',
  },

  // ── Room 1 (Rising puzzle + start of Climb sequence) ──────────────
  {
    id: 'prop_object_room2',
    roomIndex: 1,
    position: [-3, -1.2, 14 - 3],
    interactionPrompt: 'Inspect the red cylinder',
    revealContent:
      'A cylindrical metal component, ~30cm tall, crimson red with a metallic sheen. Label: "RED_CYLINDER".',
    puzzleId: 'puzzle_03_descriptive_match',
    color: '#ef4444',
  },
  {
    id: 'prop_ordered_sequence_room2',
    roomIndex: 1,
    position: [3, -1.2, 14 - 3],
    interactionPrompt: 'Examine the colour switches',
    revealContent:
      'Four switches labelled BLUE, GREEN, YELLOW, RED. The partner can tell you the correct activation order — enter it separated by dashes, e.g. "BLUE-GREEN-YELLOW-RED".',
    puzzleId: 'puzzle_04_ordered_sequence',
    color: '#a855f7',
  },
  {
    id: 'prop_midgame_reveal',
    roomIndex: 1,
    position: [0, -1.2, 14 + 3],
    interactionPrompt: 'Read the classified memo',
    revealContent:
      'CLASSIFIED — Project Static · Exit Protocol. Only ONE of the two exit codes will function. The other is a decoy. The valid code is determined by the subject\'s trust index at the time of submission. Do not inform the test subject.',
    puzzleId: null,
    isMidGameRevealProp: true,
    color: '#fcd34d',
  },
];

export function getProp(id: string): Prop | undefined {
  return props.find((p) => p.id === id);
}
