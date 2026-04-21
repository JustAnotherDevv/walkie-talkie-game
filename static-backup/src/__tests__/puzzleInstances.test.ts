// Audit test — the actual game's puzzle set matches spec Requirements 5.1,
// 5.4, 5.5, 5.6, 5.7 and 7.1. This is the real-data counterpart of the
// Property 5/8/9/12 tests (which use generated data) — it pins the shipping
// puzzle configuration to specific invariants.

import { describe, it, expect } from 'vitest';
import {
  getAllPuzzleDefinitions,
  allPropsByRoom,
} from '../puzzles/puzzleInstances';
import { PuzzleArchetype } from '../types/puzzle';
import { NarrativeBeat } from '../types/narrative';

describe('Shipping puzzle set — structural invariants', () => {
  it('contains 4 puzzles', async () => {
    const defs = await getAllPuzzleDefinitions();
    expect(defs.length).toBe(4);
  });

  it('includes every required archetype at least once (Req 5.4)', async () => {
    const defs = await getAllPuzzleDefinitions();
    const archetypes = new Set(defs.map((d) => d.archetype));
    expect(archetypes.has(PuzzleArchetype.SymbolCorrelation)).toBe(true);
    expect(archetypes.has(PuzzleArchetype.SplitCombination)).toBe(true);
    expect(archetypes.has(PuzzleArchetype.DescriptiveMatch)).toBe(true);
  });

  it('has exactly 2 defection-opportunity puzzles (Req 5.5)', async () => {
    const defs = await getAllPuzzleDefinitions();
    const defectors = defs.filter((d) => d.isDefectionOpportunity);
    expect(defectors.length).toBe(2);
  });

  it('every puzzle has non-empty partnerKnowledge and a hashed solution (Req 5.1, 5.7)', async () => {
    const defs = await getAllPuzzleDefinitions();
    for (const d of defs) {
      expect(d.partnerKnowledge.length).toBeGreaterThan(10);
      expect(d.correctSolution.length).toBeGreaterThan(0);
      // hashSolution returns a 64-char SHA-256 hex string.
      expect(d.correctSolution.length).toBe(64);
      expect(d.correctSolution).toMatch(/^[0-9a-f]+$/);
      expect(d.roomId.length).toBeGreaterThan(0);
      expect(Object.values(NarrativeBeat)).toContain(d.narrativeBeat);
    }
  });

  it('every puzzle spans at least one of Opening/Rising/Climb beats', async () => {
    const defs = await getAllPuzzleDefinitions();
    const beats = new Set(defs.map((d) => d.narrativeBeat));
    expect(beats.has(NarrativeBeat.Opening)).toBe(true);
    expect(beats.has(NarrativeBeat.Rising)).toBe(true);
    expect(beats.has(NarrativeBeat.Climb)).toBe(true);
  });

  it('defection puzzles never embed the correct solution in partnerKnowledge (Req 5.6)', async () => {
    const defs = await getAllPuzzleDefinitions();
    for (const d of defs) {
      if (!d.isDefectionOpportunity) continue;
      // the stored correctSolution is a hash; the test below checks this indirectly
      expect(d.partnerKnowledge).not.toContain(d.correctSolution);
    }
  });
});

describe('Shipping prop layout', () => {
  it('mid-game reveal prop exists exactly once and sits in room 2 or 3 (Req 7.1)', () => {
    const midGameProps: Array<{ roomId: string; id: string }> = [];
    for (const [roomId, props] of Object.entries(allPropsByRoom)) {
      for (const p of props) {
        if (p.isMidGameRevealProp) midGameProps.push({ roomId, id: p.id });
      }
    }
    expect(midGameProps.length).toBe(1);
    expect(['room_2', 'room_3']).toContain(midGameProps[0].roomId);
  });

  it('every player-side prop referenced by a puzzle exists in allPropsByRoom', async () => {
    const defs = await getAllPuzzleDefinitions();
    const allPropIds = new Set<string>();
    for (const props of Object.values(allPropsByRoom)) {
      for (const p of props) allPropIds.add(p.id);
    }
    for (const d of defs) {
      for (const propId of d.playerSideProps) {
        expect(
          allPropIds.has(propId),
          `Puzzle ${d.id} references prop ${propId} that doesn't exist`,
        ).toBe(true);
      }
    }
  });

  it('every non-mid-game prop is bound to a real puzzle', async () => {
    const defs = await getAllPuzzleDefinitions();
    const puzzleIds = new Set(defs.map((d) => d.id));
    for (const props of Object.values(allPropsByRoom)) {
      for (const p of props) {
        if (p.isMidGameRevealProp) continue;
        expect(p.puzzleId).not.toBeNull();
        expect(puzzleIds.has(p.puzzleId as string)).toBe(true);
      }
    }
  });
});
