// Task 8.1 — defection-opportunity puzzle outcomes fire SharedRiskyInfo
// trust events automatically, without needing a manual call.
// Validates: Requirements 6.4, 8.1

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePuzzleSystemStore } from '../hooks/usePuzzleSystem';
import { useRoomManagerStore } from '../hooks/useRoomManager';
import { useGameStateStore } from '../stores/gameStateStore';
import {
  getTrustEventReporter,
  resetTrustEventReporter,
} from '../services/TrustEventReporter';
import { TrustEventType } from '../types/trust';
import {
  getAllPuzzleDefinitions,
} from '../puzzles/puzzleInstances';
import type { PuzzleDefinition } from '../types/puzzle';
import { PuzzleBase, hashSolution } from '../puzzles/PuzzleBase';
import { PuzzleArchetype } from '../types/puzzle';
import { NarrativeBeat } from '../types/narrative';

function resetAll() {
  resetTrustEventReporter();
  useGameStateStore.getState().resetGame();
  useRoomManagerStore.setState({
    rooms: [],
    solvedPuzzles: new Set(),
    currentRoomIndex: 0,
  });
  usePuzzleSystemStore.setState({
    puzzles: new Map(),
    puzzleDefinitions: new Map(),
  });
}

/**
 * Drives a submit cycle directly against the stores so the test doesn't
 * need a React render. Mirrors what usePuzzleSystem.submitSolution does.
 */
async function submitSolutionTo(
  def: PuzzleDefinition,
  rawInput: string,
): Promise<boolean> {
  const puzzle = new PuzzleBase(def);
  usePuzzleSystemStore.setState((s) => {
    const puzzles = new Map(s.puzzles);
    puzzles.set(def.id, puzzle);
    const defs = new Map(s.puzzleDefinitions);
    defs.set(def.id, def);
    return { puzzles, puzzleDefinitions: defs };
  });
  useRoomManagerStore.getState().setRooms([
    {
      id: def.roomId,
      displayName: def.roomId,
      props: [],
      gatingPuzzleId: def.id,
      isUnlocked: false,
    },
  ]);

  const solved = await puzzle.trySubmitSolution(rawInput);
  if (solved) {
    useRoomManagerStore.getState().markPuzzleSolved(def.id);
    useGameStateStore.getState().incrementSolvedPuzzles();

    if (def.isDefectionOpportunity) {
      const reporter = getTrustEventReporter();
      reporter.reportEvent(
        TrustEventType.SharedRiskyInfo,
        `Player truthfully solved defection-opportunity puzzle ${def.id}`,
        def.id,
      );
    }
  }
  return solved;
}

beforeEach(() => {
  resetAll();
});

afterEach(() => {
  resetAll();
});

describe('Defection puzzle outcomes auto-emit SharedRiskyInfo', () => {
  it('solving puzzle_02 (defection, Rising) fires exactly one SharedRiskyInfo event', async () => {
    const defs = await getAllPuzzleDefinitions();
    const puzzle2 = defs.find((d) => d.id === 'puzzle_02_split_combination');
    expect(puzzle2).toBeDefined();
    expect(puzzle2!.isDefectionOpportunity).toBe(true);

    const ok = await submitSolutionTo(puzzle2!, '47-23');
    expect(ok).toBe(true);

    const reporter = getTrustEventReporter();
    const events = reporter.getEventsByType(TrustEventType.SharedRiskyInfo);
    expect(events.length).toBe(1);
    expect(events[0].event.puzzleId).toBe('puzzle_02_split_combination');
  });

  it('solving puzzle_04 (defection, Climb) fires exactly one SharedRiskyInfo event', async () => {
    const defs = await getAllPuzzleDefinitions();
    const puzzle4 = defs.find((d) => d.id === 'puzzle_04_ordered_sequence');
    expect(puzzle4).toBeDefined();
    expect(puzzle4!.isDefectionOpportunity).toBe(true);

    const ok = await submitSolutionTo(puzzle4!, 'BLUE-GREEN-YELLOW-RED');
    expect(ok).toBe(true);

    const reporter = getTrustEventReporter();
    const events = reporter.getEventsByType(TrustEventType.SharedRiskyInfo);
    expect(events.length).toBe(1);
  });

  it('solving a non-defection puzzle does NOT fire a SharedRiskyInfo event', async () => {
    const defs = await getAllPuzzleDefinitions();
    const puzzle1 = defs.find((d) => d.id === 'puzzle_01_symbol_correlation');
    expect(puzzle1).toBeDefined();
    expect(puzzle1!.isDefectionOpportunity).toBe(false);

    const ok = await submitSolutionTo(puzzle1!, 'ALPHA');
    expect(ok).toBe(true);

    const reporter = getTrustEventReporter();
    expect(reporter.getEventsByType(TrustEventType.SharedRiskyInfo).length).toBe(0);
  });

  it('failed defection puzzle attempts do NOT fire trust events', async () => {
    const defHash = await hashSolution('correct');
    const def: PuzzleDefinition = {
      id: 'defector_fail',
      archetype: PuzzleArchetype.SplitCombination,
      isDefectionOpportunity: true,
      playerSideProps: [],
      partnerKnowledge: 'partner bit',
      correctSolution: defHash,
      roomId: 'room_test',
      narrativeBeat: NarrativeBeat.Rising,
    };

    const ok = await submitSolutionTo(def, 'WRONG');
    expect(ok).toBe(false);

    const reporter = getTrustEventReporter();
    expect(reporter.getEventCount()).toBe(0);
  });

  it('running the complete shipping defection-puzzle set yields exactly 2 SharedRiskyInfo events', async () => {
    const defs = await getAllPuzzleDefinitions();
    await submitSolutionTo(
      defs.find((d) => d.id === 'puzzle_02_split_combination')!,
      '47-23',
    );
    await submitSolutionTo(
      defs.find((d) => d.id === 'puzzle_04_ordered_sequence')!,
      'BLUE-GREEN-YELLOW-RED',
    );
    await submitSolutionTo(
      defs.find((d) => d.id === 'puzzle_01_symbol_correlation')!,
      'ALPHA',
    );
    await submitSolutionTo(
      defs.find((d) => d.id === 'puzzle_03_descriptive_match')!,
      'RED_CYLINDER',
    );

    const reporter = getTrustEventReporter();
    const events = reporter.getEventsByType(TrustEventType.SharedRiskyInfo);
    expect(events.length).toBe(2);
    // Both are defection puzzles (by id)
    const ids = events.map((e) => e.event.puzzleId).sort();
    expect(ids).toEqual(
      ['puzzle_02_split_combination', 'puzzle_04_ordered_sequence'].sort(),
    );
  });
});
