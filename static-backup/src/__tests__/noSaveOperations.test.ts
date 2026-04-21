/// <reference types="node" />
// Task 22.3 — no save operations anywhere in runtime code.
// Validates: Requirements 11.4, 11.7
// Each playthrough must be a single continuous session. The codebase must
// never touch localStorage / sessionStorage / indexedDB, and a simulated
// session must not invoke any of those APIs.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === 'assets') continue;
      walk(abs, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(abs);
    }
  }
  return out;
}

// Banned patterns — match as word boundaries so comments mentioning them
// still fail, consistent with "must not exist anywhere in the codebase".
const BANNED_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'localStorage', re: /\blocalStorage\b/ },
  { label: 'sessionStorage', re: /\bsessionStorage\b/ },
  { label: 'indexedDB', re: /\bindexedDB\b/ },
  { label: 'IDBDatabase', re: /\bIDBDatabase\b/ },
  { label: 'IDBFactory', re: /\bIDBFactory\b/ },
  { label: 'Storage.prototype', re: /\bStorage\.prototype\b/ },
];

describe('No persistent-storage APIs in runtime source', () => {
  const files = walk(SRC_ROOT);

  it('discovers the expected top-level source tree (sanity check)', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.endsWith('App.tsx'))).toBe(true);
    expect(files.some((f) => f.includes('/stores/'))).toBe(true);
  });

  for (const { label, re } of BANNED_PATTERNS) {
    it(`no runtime file references ${label}`, () => {
      const hits: string[] = [];
      for (const file of files) {
        const src = readFileSync(file, 'utf8');
        if (re.test(src)) {
          hits.push(path.relative(SRC_ROOT, file));
        }
      }
      expect(hits, `Forbidden token ${label} found in: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

describe('No persistent-storage APIs invoked at runtime', () => {
  // Spies live across a simulated session; restore after each test.
  const originalLocalGet = Storage.prototype.getItem;
  const originalLocalSet = Storage.prototype.setItem;
  const originalLocalRemove = Storage.prototype.removeItem;
  let localGetSpy: ReturnType<typeof vi.spyOn>;
  let localSetSpy: ReturnType<typeof vi.spyOn>;
  let localRemoveSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    localGetSpy?.mockRestore();
    localSetSpy?.mockRestore();
    localRemoveSpy?.mockRestore();
    Storage.prototype.getItem = originalLocalGet;
    Storage.prototype.setItem = originalLocalSet;
    Storage.prototype.removeItem = originalLocalRemove;
  });

  it('simulates a full session through store actions and sees zero Storage calls', async () => {
    localGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    localSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    localRemoveSpy = vi.spyOn(Storage.prototype, 'removeItem');

    // Import modules that together represent the runtime game flow.
    const { useGameStateStore } = await import('../stores/gameStateStore');
    const { getTrustEventReporter, resetTrustEventReporter } = await import(
      '../services/TrustEventReporter'
    );
    const { TrustEventType } = await import('../types/trust');
    const { FinalChoice, NarrativeBeat } = await import('../types');

    resetTrustEventReporter();
    const reporter = getTrustEventReporter();
    const store = useGameStateStore.getState();
    store.resetGame();

    // Simulate a full arc: start, solve puzzles, reveal, final choice, ending.
    store.startGame();
    reporter.reportEvent(TrustEventType.VerbalReassurance, 'Stay with me.');
    store.incrementSolvedPuzzles();
    store.advanceBeat(); // Opening → Rising
    store.incrementSolvedPuzzles();
    store.incrementSolvedPuzzles();
    store.advanceBeat(); // Rising → Midpoint
    reporter.reportEvent(TrustEventType.SharedRiskyInfo, 'I lied earlier.');
    store.triggerMidGameReveal();
    // triggerMidGameReveal auto-advances to Climb in Midpoint.
    expect(useGameStateStore.getState().currentBeat).toBe(NarrativeBeat.Climb);
    store.incrementSolvedPuzzles();
    store.advanceBeat(); // Climb → Climax
    store.triggerFinalChoice();
    store.setPlayerFinalChoice(FinalChoice.Cooperate);
    store.setPartnerFinalChoice(FinalChoice.Cooperate);
    store.resolveEnding();

    expect(localGetSpy).not.toHaveBeenCalled();
    expect(localSetSpy).not.toHaveBeenCalled();
    expect(localRemoveSpy).not.toHaveBeenCalled();
  });
});
