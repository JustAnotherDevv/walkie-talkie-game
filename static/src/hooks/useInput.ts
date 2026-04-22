import { useEffect, useRef } from 'react';

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

export interface InputCallbacks {
  /** Called every mousemove while pointer is locked. */
  onLook?: (dx: number, dy: number) => void;
  /** Called when the user presses V (push-to-talk). */
  onPTTPressed?: () => void;
  onPTTReleased?: () => void;
  /** Called on E key press. */
  onInteract?: () => void;
}

/**
 * Centralized keyboard + mouse input. Movement keys are tracked on a
 * ref you can read from useFrame so we don't re-render every keypress.
 * Mouse deltas fire via onLook (pointer-lock only).
 */
export function useInput(
  callbacks: InputCallbacks = {},
  enabled: boolean = true,
): { input: React.RefObject<InputState>; pointerLocked: React.RefObject<boolean> } {
  const input = useRef<InputState>({
    forward: false,
    back: false,
    left: false,
    right: false,
  });
  const pointerLocked = useRef(false);
  const pttActive = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Seed pointer-lock state from the current document. Without this,
    // if the lock was acquired while `enabled` was false (e.g. during an
    // intro cutscene where input was temporarily disabled), the
    // `pointerlockchange` event has already fired and we'd miss it —
    // leaving this ref stale at `false` and silently dropping mouse-look
    // deltas until the player manually releases + re-acquires lock.
    pointerLocked.current = document.pointerLockElement !== null;

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': input.current.forward = true; break;
        case 'KeyS': input.current.back = true; break;
        case 'KeyA': input.current.left = true; break;
        case 'KeyD': input.current.right = true; break;
        case 'KeyE':
          callbacks.onInteract?.();
          break;
        case 'KeyV':
          if (!pttActive.current) {
            pttActive.current = true;
            callbacks.onPTTPressed?.();
          }
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': input.current.forward = false; break;
        case 'KeyS': input.current.back = false; break;
        case 'KeyA': input.current.left = false; break;
        case 'KeyD': input.current.right = false; break;
        case 'KeyV':
          if (pttActive.current) {
            pttActive.current = false;
            callbacks.onPTTReleased?.();
          }
          break;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!pointerLocked.current) return;
      if (e.movementX || e.movementY) {
        callbacks.onLook?.(e.movementX, e.movementY);
      }
    };

    const onPointerLockChange = () => {
      pointerLocked.current = document.pointerLockElement !== null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
    // Callbacks intentionally excluded from deps — they're read on each
    // event, so re-attaching listeners per render is wasteful. Pass stable
    // references (e.g. via useRef-wrapped closures) if they change often.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { input, pointerLocked };
}
