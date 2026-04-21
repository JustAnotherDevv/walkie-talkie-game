// UI state transition tests (Task 14.5)
// Validates: Requirements 2.3, 8.1, 8.5
// - PTT indicator shown on PTT press, hidden on release
// - Final choice UI shown when Climax beat reached (with all puzzles solved)
// - Ending screen shown after both choices collected

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';
import { PTTIndicator } from '../components/PTTIndicator';
import { FinalChoiceUI } from '../components/FinalChoiceUI';
import { EndingScreen } from '../components/EndingScreen';
import { TitleScreen } from '../components/TitleScreen';
import { PTTState } from '../hooks/usePTT';
import { FinalChoice, EndingType, NarrativeBeat } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';

afterEach(() => {
  cleanup();
  useGameStateStore.getState().resetGame();
});

describe('PTTIndicator visibility', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      React.createElement(PTTIndicator, { pttState: PTTState.Idle, visible: false }),
    );
    expect(container.textContent).toBe('');
  });

  it('renders the transmitting label when visible and active', () => {
    const { container } = render(
      React.createElement(PTTIndicator, {
        pttState: PTTState.Transmitting,
        visible: true,
      }),
    );
    expect(container.textContent).toContain('TRANSMITTING');
  });

  it('transitions from hidden → visible when PTT press starts, visible → hidden on release', () => {
    const { container, rerender } = render(
      React.createElement(PTTIndicator, { pttState: PTTState.Idle, visible: false }),
    );
    // Idle / not visible → empty output
    expect(container.textContent).toBe('');

    // Press → visible + transmitting
    rerender(
      React.createElement(PTTIndicator, {
        pttState: PTTState.Transmitting,
        visible: true,
      }),
    );
    expect(container.textContent).toContain('TRANSMITTING');

    // Release → idle + hidden again
    rerender(
      React.createElement(PTTIndicator, { pttState: PTTState.Idle, visible: false }),
    );
    expect(container.textContent).toBe('');
  });

  it('shows the signal-lost label when PTT state is Error', () => {
    const { container } = render(
      React.createElement(PTTIndicator, {
        pttState: PTTState.Error,
        visible: true,
      }),
    );
    expect(container.textContent).toContain('SIGNAL LOST');
  });
});

describe('FinalChoiceUI visibility', () => {
  beforeEach(() => {
    useGameStateStore.getState().resetGame();
  });

  it('renders nothing before the final choice is triggered', () => {
    const { container } = render(React.createElement(FinalChoiceUI));
    expect(container.textContent).toBe('');
  });

  it('renders COOPERATE and DEFECT buttons once final choice is active', () => {
    const store = useGameStateStore.getState();
    // Advance to Climax
    store.advanceBeat();
    store.advanceBeat();
    store.advanceBeat();
    store.advanceBeat();
    // Mark puzzles complete
    for (let i = 0; i < store.totalPuzzles; i++) {
      store.incrementSolvedPuzzles();
    }
    store.triggerFinalChoice();

    const { container } = render(React.createElement(FinalChoiceUI));
    expect(container.textContent).toContain('COOPERATE');
    expect(container.textContent).toContain('DEFECT');
  });

  it('is not shown until the Climax beat has been reached', () => {
    const store = useGameStateStore.getState();
    for (let i = 0; i < store.totalPuzzles; i++) {
      store.incrementSolvedPuzzles();
    }
    // Climax not reached yet
    store.triggerFinalChoice();
    const { container } = render(React.createElement(FinalChoiceUI));
    expect(container.textContent).toBe('');

    expect(useGameStateStore.getState().currentBeat).not.toBe(NarrativeBeat.Climax);
  });

  it('hides itself once the game has ended', () => {
    const store = useGameStateStore.getState();
    store.advanceBeat();
    store.advanceBeat();
    store.advanceBeat();
    store.advanceBeat();
    for (let i = 0; i < store.totalPuzzles; i++) {
      store.incrementSolvedPuzzles();
    }
    store.triggerFinalChoice();

    const { container, rerender } = render(React.createElement(FinalChoiceUI));
    expect(container.textContent).toContain('COOPERATE');

    // Simulate both choices made & game ended
    act(() => {
      store.setPlayerFinalChoice(FinalChoice.Cooperate);
      store.setPartnerFinalChoice(FinalChoice.Cooperate);
      store.resolveEnding();
    });
    rerender(React.createElement(FinalChoiceUI));
    expect(container.textContent).toBe('');
  });
});

describe('EndingScreen visibility', () => {
  beforeEach(() => {
    useGameStateStore.getState().resetGame();
  });

  it('renders nothing while the game has not ended', () => {
    const { container } = render(React.createElement(EndingScreen));
    expect(container.textContent).toBe('');
  });

  it('does not show the ending screen when only one choice has been made', () => {
    const store = useGameStateStore.getState();
    store.setPlayerFinalChoice(FinalChoice.Cooperate);
    store.resolveEnding();
    const { container } = render(React.createElement(EndingScreen));
    expect(container.textContent).toBe('');
  });

  it('shows the RELEASE ending when both sides cooperate', () => {
    const store = useGameStateStore.getState();
    store.setPlayerFinalChoice(FinalChoice.Cooperate);
    store.setPartnerFinalChoice(FinalChoice.Cooperate);
    store.resolveEnding();
    const { container } = render(React.createElement(EndingScreen));
    expect(container.textContent).toContain('RELEASE');
  });

  it('shows the LEFT BEHIND ending when partner defects', () => {
    const store = useGameStateStore.getState();
    store.setPlayerFinalChoice(FinalChoice.Cooperate);
    store.setPartnerFinalChoice(FinalChoice.Defect);
    store.resolveEnding();
    const { container } = render(React.createElement(EndingScreen));
    expect(container.textContent).toContain('LEFT BEHIND');
  });

  it('shows the ALONE ending when player defects and partner cooperates', () => {
    const store = useGameStateStore.getState();
    store.setPlayerFinalChoice(FinalChoice.Defect);
    store.setPartnerFinalChoice(FinalChoice.Cooperate);
    store.resolveEnding();
    const { container } = render(React.createElement(EndingScreen));
    expect(container.textContent).toContain('ALONE');
  });

  it('shows the RESET ending when both defect', () => {
    const store = useGameStateStore.getState();
    store.setPlayerFinalChoice(FinalChoice.Defect);
    store.setPartnerFinalChoice(FinalChoice.Defect);
    store.resolveEnding();
    const { container } = render(React.createElement(EndingScreen));
    expect(container.textContent).toContain('RESET');
  });

  it('ending screen mirrors the routed endingType in the store', () => {
    const store = useGameStateStore.getState();
    store.setPlayerFinalChoice(FinalChoice.Cooperate);
    store.setPartnerFinalChoice(FinalChoice.Defect);
    store.resolveEnding();
    expect(useGameStateStore.getState().endingType).toBe(EndingType.LeftBehind);
    const { container } = render(React.createElement(EndingScreen));
    expect(container.textContent).toContain('LEFT BEHIND');
  });
});

describe('TitleScreen gating', () => {
  beforeEach(() => {
    useGameStateStore.getState().resetGame();
  });

  it('is shown by default on a fresh game', () => {
    const { container } = render(React.createElement(TitleScreen));
    expect(container.textContent).toContain('STATIC');
    expect(container.textContent).toContain('Begin transmission');
  });

  it('hides itself once hasStarted flips to true', () => {
    const { container, rerender } = render(React.createElement(TitleScreen));
    expect(container.textContent).toContain('STATIC');
    act(() => {
      useGameStateStore.getState().startGame();
    });
    rerender(React.createElement(TitleScreen));
    expect(container.textContent).toBe('');
  });
});
