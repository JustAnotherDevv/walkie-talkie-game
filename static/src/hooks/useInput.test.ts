import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInput, Vector2 } from './useInput';
import { FinalChoice } from '../types';

describe('useInput', () => {
  // Mock callbacks
  const mockCallbacks = {
    onMoveInput: vi.fn(),
    onLookInput: vi.fn(),
    onInteractPressed: vi.fn(),
    onPTTPressed: vi.fn(),
    onPTTReleased: vi.fn(),
    onFinalChoiceSelected: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PTT state transitions', () => {
    it('should fire onPTTPressed when V key is pressed', () => {
      renderHook(() => useInput(mockCallbacks));

      // Simulate V key press
      act(() => {
        const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyV' });
        window.dispatchEvent(keydownEvent);
      });

      expect(mockCallbacks.onPTTPressed).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.onPTTPressed).toHaveBeenCalledWith();
    });

    it('should fire onPTTReleased when V key is released', () => {
      renderHook(() => useInput(mockCallbacks));

      // Simulate V key press
      act(() => {
        const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyV' });
        window.dispatchEvent(keydownEvent);
      });

      // Simulate V key release
      act(() => {
        const keyupEvent = new KeyboardEvent('keyup', { code: 'KeyV' });
        window.dispatchEvent(keyupEvent);
      });

      expect(mockCallbacks.onPTTPressed).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.onPTTReleased).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.onPTTReleased).toHaveBeenCalledWith();
    });

    it('should not fire onPTTPressed multiple times while V is held', () => {
      renderHook(() => useInput(mockCallbacks));

      // Simulate multiple V key press events (key repeat)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }));
      });

      // Should only fire once
      expect(mockCallbacks.onPTTPressed).toHaveBeenCalledTimes(1);
    });

    it('should allow PTT to be pressed again after release', () => {
      renderHook(() => useInput(mockCallbacks));

      // First press-release cycle
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }));
      });
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' }));
      });

      // Second press-release cycle
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }));
      });
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' }));
      });

      expect(mockCallbacks.onPTTPressed).toHaveBeenCalledTimes(2);
      expect(mockCallbacks.onPTTReleased).toHaveBeenCalledTimes(2);
    });

    it('should not fire onPTTReleased if V was not pressed first', () => {
      renderHook(() => useInput(mockCallbacks));

      // Simulate V key release without prior press
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' }));
      });

      expect(mockCallbacks.onPTTReleased).not.toHaveBeenCalled();
    });
  });

  describe('Interact key', () => {
    it('should fire onInteractPressed when E key is pressed', () => {
      renderHook(() => useInput(mockCallbacks));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
      });

      expect(mockCallbacks.onInteractPressed).toHaveBeenCalledTimes(1);
    });

    it('should fire onInteractPressed on each E key press', () => {
      renderHook(() => useInput(mockCallbacks));

      // Multiple presses should each trigger the callback
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
      });

      expect(mockCallbacks.onInteractPressed).toHaveBeenCalledTimes(2);
    });
  });

  describe('Movement input', () => {
    it('should fire onMoveInput with normalized diagonal movement', () => {
      renderHook(() => useInput(mockCallbacks));

      // Press W and D simultaneously
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      });
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      });

      expect(mockCallbacks.onMoveInput).toHaveBeenCalled();
      
      // Get the last call's argument
      const lastCall = mockCallbacks.onMoveInput.mock.calls[mockCallbacks.onMoveInput.mock.calls.length - 1];
      const input = lastCall[0] as Vector2;

      // Diagonal movement should be normalized
      const length = Math.sqrt(input.x * input.x + input.y * input.y);
      expect(length).toBeCloseTo(1, 5);
    });

    it('should fire onMoveInput with zero vector when no keys pressed', () => {
      renderHook(() => useInput(mockCallbacks));

      // Press and release W
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      });
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      });

      // Get the last call's argument (should be zero after release)
      const lastCall = mockCallbacks.onMoveInput.mock.calls[mockCallbacks.onMoveInput.mock.calls.length - 1];
      const input = lastCall[0] as Vector2;

      expect(input.x).toBe(0);
      expect(input.y).toBe(0);
    });

    it('should handle all movement keys correctly', () => {
      renderHook(() => useInput(mockCallbacks));

      // Test W (forward)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      });
      let lastCall = mockCallbacks.onMoveInput.mock.calls[mockCallbacks.onMoveInput.mock.calls.length - 1];
      let input = lastCall[0] as Vector2;
      expect(input.y).toBe(1);

      // Release W
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      });

      // Test S (backward)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
      });
      lastCall = mockCallbacks.onMoveInput.mock.calls[mockCallbacks.onMoveInput.mock.calls.length - 1];
      input = lastCall[0] as Vector2;
      expect(input.y).toBe(-1);

      // Release S
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
      });

      // Test A (left)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      });
      lastCall = mockCallbacks.onMoveInput.mock.calls[mockCallbacks.onMoveInput.mock.calls.length - 1];
      input = lastCall[0] as Vector2;
      expect(input.x).toBe(-1);

      // Release A
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
      });

      // Test D (right)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      });
      lastCall = mockCallbacks.onMoveInput.mock.calls[mockCallbacks.onMoveInput.mock.calls.length - 1];
      input = lastCall[0] as Vector2;
      expect(input.x).toBe(1);
    });
  });

  describe('Mouse look', () => {
    it('should fire onLookInput when mouse moves with pointer lock', () => {
      renderHook(() => useInput(mockCallbacks));

      // Simulate pointer lock
      Object.defineProperty(document, 'pointerLockElement', {
        value: document.body,
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('pointerlockchange'));
      });

      // Simulate mouse movement
      act(() => {
        const mouseEvent = new MouseEvent('mousemove', {
          movementX: 10,
          movementY: 5,
        });
        window.dispatchEvent(mouseEvent);
      });

      expect(mockCallbacks.onLookInput).toHaveBeenCalledWith({ x: 10, y: 5 });
    });

    it('should not fire onLookInput when pointer is not locked', () => {
      renderHook(() => useInput(mockCallbacks));

      // Ensure pointer is not locked
      Object.defineProperty(document, 'pointerLockElement', {
        value: null,
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('pointerlockchange'));
      });

      // Simulate mouse movement
      act(() => {
        const mouseEvent = new MouseEvent('mousemove', {
          movementX: 10,
          movementY: 5,
        });
        window.dispatchEvent(mouseEvent);
      });

      expect(mockCallbacks.onLookInput).not.toHaveBeenCalled();
    });
  });

  describe('Final choice selection', () => {
    it('should expose selectFinalChoice function on window', () => {
      renderHook(() => useInput(mockCallbacks));

      const windowWithChoice = window as unknown as { selectFinalChoice: (choice: FinalChoice) => void };
      
      act(() => {
        windowWithChoice.selectFinalChoice(FinalChoice.Cooperate);
      });

      expect(mockCallbacks.onFinalChoiceSelected).toHaveBeenCalledWith(FinalChoice.Cooperate);
    });
  });

  describe('Event cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useInput(mockCallbacks));

      // Trigger some events before unmount
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }));
      });
      expect(mockCallbacks.onPTTPressed).toHaveBeenCalledTimes(1);

      // Unmount
      unmount();

      // Clear mocks
      mockCallbacks.onPTTPressed.mockClear();

      // Trigger events after unmount
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }));
      });

      // Should not have been called after unmount
      expect(mockCallbacks.onPTTPressed).not.toHaveBeenCalled();
    });
  });
});
