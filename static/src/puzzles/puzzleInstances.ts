import { NarrativeBeat } from '../types/narrative';
import { PuzzleArchetype, type PuzzleDefinition } from '../types/puzzle';
import type { Prop } from '../types/prop';

export const puzzles: PuzzleDefinition[] = [
  {
    id: 'puzzle_01_symbol_correlation',
    archetype: PuzzleArchetype.SymbolCorrelation,
    isDefectionOpportunity: false,
    partnerKnowledge:
      'I can see a control panel on my end with three keys labeled PRIMO, SECUNDO, and TERTIO. A triangle-with-line glyph matches SECUNDO, a circle-with-dot matches PRIMO, a square-with-waves matches TERTIO.',
    correctSolution: 'SECUNDO',
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
  // ── Room 0 (starter closet) ───────────────────────────────────────
  // Just a keycard to find and a door-reader to use it on.
  {
    id: 'prop_keycard',
    roomIndex: 0,
    // Sitting on a crate in the alcove (crate top at y=-1.2).
    position: [-7, -0.95, -3.5],
    interactionPrompt: 'Pick up the keycard',
    revealContent: '',
    puzzleId: null,
    isKeycard: true,
    color: '#fbbf24',
  },
  {
    id: 'prop_door0_reader',
    roomIndex: 0,
    // Mounted on the shared wall between room 0 and the main hall (at
    // z=5.9, with the reader protruding a little into room 0).
    position: [1.6, -0.6, 5.78],
    interactionPrompt: 'Use the door reader',
    revealContent: '',
    puzzleId: null,
    isKeycardDoor: true,
    color: '#ef4444',
  },

  // ── Room 1 (main control hall — all four puzzles live here) ────────
  {
    id: 'prop_glyph_room1',
    roomIndex: 1,
    // On the big wooden desk in the foreground (world -X / screen-right).
    position: [-7, -1.1, 11],
    interactionPrompt: 'Examine the ancient glyph',
    revealContent:
      'A triangular glyph with a horizontal line etched through its centre, stamped into a metal plate.',
    puzzleId: 'puzzle_01_symbol_correlation',
    color: '#38bdf8',
  },
  {
    id: 'prop_note_room1',
    roomIndex: 1,
    // On top of the back retro-machinery cabinet.
    position: [-9, 0.6, 30],
    interactionPrompt: 'Read the torn note',
    revealContent:
      'A torn page: "47-" — the rest is missing. Partner probably has the other half.',
    puzzleId: 'puzzle_02_split_combination',
    color: '#f59e0b',
  },
  {
    id: 'prop_object_room2',
    roomIndex: 1,
    // On top of the middle retro-machinery cabinet.
    position: [-9, 0.6, 22],
    interactionPrompt: 'Inspect the red cylinder',
    revealContent:
      'A cylindrical metal component, ~30cm tall, crimson red with a metallic sheen. Label: "RED_CYLINDER".',
    puzzleId: 'puzzle_03_descriptive_match',
    color: '#ef4444',
  },
  {
    id: 'prop_ordered_sequence_room2',
    roomIndex: 2,
    // In the side room (always-open ground-floor room behind door 1), on
    // top of the raised-platform pedestal (pedestal cap top at y≈0.1).
    position: [0, 0.45, 47.5],
    interactionPrompt: 'Examine the colour switches',
    revealContent:
      'Four switches labelled BLUE, GREEN, YELLOW, RED. The partner can tell you the correct activation order — enter it separated by dashes, e.g. "BLUE-GREEN-YELLOW-RED".',
    puzzleId: 'puzzle_04_ordered_sequence',
    color: '#a855f7',
  },
  // ── Final room: readable note + twin levers + commit button ─────────
  {
    id: 'prop_final_note',
    roomIndex: 2,
    // Flat card sitting on the console (desk top ≈ y=-1.55). Bob-animation
    // amplitude ±0.06, so we sit slightly above the surface so it doesn't
    // clip at its lowest.
    position: [-19.4, -1.48, 74],
    interactionPrompt: 'Read the note on the console',
    revealContent:
      'FACILITY RELEASE PROTOCOL — Two levers here, two in the security room. To unlock the facility both sides must be thrown at the same time.\n\nLEFT lever — releases YOUR side.\nRIGHT lever — releases THE OPERATOR\'S side.\n\nPress the red COMMIT button when you\'ve decided.',
    puzzleId: null,
    isFinalNote: true,
    color: '#fcd34d',
  },
  {
    id: 'prop_final_lever_left',
    roomIndex: 2,
    // Interaction volume roughly at the handle height of the lever, not
    // at the visual base (the base sits on the console; the handle
    // reaches up ~0.8m above it).
    position: [-22.9, -1.0, 74],
    interactionPrompt: 'Pull the LEFT lever down',
    revealContent: '',
    puzzleId: null,
    isFinalLever: 'left',
    color: '#fbbf24',
  },
  {
    id: 'prop_final_lever_right',
    roomIndex: 2,
    position: [-21.1, -1.0, 74],
    interactionPrompt: 'Pull the RIGHT lever down',
    revealContent: '',
    puzzleId: null,
    isFinalLever: 'right',
    color: '#38bdf8',
  },
  {
    id: 'prop_final_commit',
    roomIndex: 2,
    // Interaction volume near the commit button on the angled top panel.
    position: [-22, -1.3, 74.55],
    interactionPrompt: 'Press the red COMMIT button',
    revealContent: '',
    puzzleId: null,
    isFinalCommit: true,
    color: '#ef4444',
  },
  {
    id: 'prop_midgame_reveal',
    roomIndex: 1,
    // On the secondary desk in the middle of the hall (desk top ≈ y=-1.56).
    position: [1.5, -1.22, 22],
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

export function getPuzzlesForBeat(beat: PuzzleDefinition['narrativeBeat']) {
  return puzzles.filter((p) => p.narrativeBeat === beat);
}

/**
 * True iff every puzzle with narrativeBeat === beat is in solvedSet.
 * Beats with zero puzzles (e.g. Midpoint, Climax) are considered complete.
 */
export function allBeatPuzzlesSolved(
  beat: PuzzleDefinition['narrativeBeat'],
  solvedSet: Set<string>,
): boolean {
  const beatPuzzles = getPuzzlesForBeat(beat);
  if (beatPuzzles.length === 0) return true;
  return beatPuzzles.every((p) => solvedSet.has(p.id));
}

/**
 * Which gate applies to each doorway.
 * - Door 0: room 0 → main hall (opens once the keycard has been used on the reader)
 * - Door 1: main hall → "room below the catwalk" — ALWAYS OPEN now. The
 *   final room is reached via a separate closed-off door on the mezzanine
 *   upstairs; that door is visual-only so no entry in this table.
 *
 * Ending overrides (all-open / all-sealed) still handled by the caller.
 */
export function isDoorLocked(
  doorIndex: 0 | 1,
  solvedSet: Set<string>,
  door0Opened: boolean = false,
): boolean {
  void solvedSet;
  if (doorIndex === 0) return !door0Opened;
  if (doorIndex === 1) return false;
  return false;
}
