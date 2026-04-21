import { useEffect, useCallback, useRef } from 'react';
import { FinalChoice } from '../types';

// Vector2 type for movement and look input
export interface Vector2 {
  x: number;
  y: number;
}

// Input event callbacks
export interface InputEvents {
  onMoveInput: (input: Vector2) => void;
  onLookInput: (input: Vector2) => void;
  onInteractPressed: () => void;
  onPTTPressed: () => void;
  onPTTReleased: () => void;
  onFinalChoiceSelected: (choice: FinalChoice) => void;
}

// Key bindings
const PTT_KEY = 'KeyV'; // V key for push-to-talk
const INTERACT_KEY = 'KeyE'; // E key for interact
const MOVE_KEYS = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
};

/**
 * useInput hook - Handles all player input and routes it to appropriate callbacks
 * Validates: Requirements 2.1, 2.2, 8.1
 * 
 * Key bindings:
 * - V: Push-to-talk (PTT) - fires onPTTPressed on keydown, onPTTReleased on keyup
 * - E: Interact - fires onInteractPressed on keydown
 * - WASD: Movement - fires onMoveInput with normalized direction
 * - Mouse: Look - fires onLookInput with delta movement
 */
export function useInput(events: InputEvents): void {
  const {
    onMoveInput,
    onLookInput,
    onInteractPressed,
    onPTTPressed,
    onPTTReleased,
    onFinalChoiceSelected,
  } = events;

  // Track pressed keys for movement
  const keysPressed = useRef<Set<string>>(new Set());
  
  // Track PTT state to prevent duplicate events
  const pttActive = useRef(false);
  
  // Track if pointer is locked for mouse look
  const pointerLocked = useRef(false);

  // Calculate movement input from pressed keys
  const calculateMovementInput = useCallback((): Vector2 => {
    let x = 0;
    let y = 0;

    if (keysPressed.current.has(MOVE_KEYS.forward)) y += 1;
    if (keysPressed.current.has(MOVE_KEYS.backward)) y -= 1;
    if (keysPressed.current.has(MOVE_KEYS.left)) x -= 1;
    if (keysPressed.current.has(MOVE_KEYS.right)) x += 1;

    // Normalize diagonal movement
    const length = Math.sqrt(x * x + y * y);
    if (length > 0) {
      x /= length;
      y /= length;
    }

    return { x, y };
  }, []);

  // Handle keydown events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Prevent default for game keys
    if (
      event.code === PTT_KEY ||
      event.code === INTERACT_KEY ||
      Object.values(MOVE_KEYS).includes(event.code)
    ) {
      event.preventDefault();
    }

    // Handle PTT key
    if (event.code === PTT_KEY && !pttActive.current) {
      pttActive.current = true;
      onPTTPressed();
    }

    // Handle interact key
    if (event.code === INTERACT_KEY) {
      onInteractPressed();
    }

    // Track movement keys
    if (Object.values(MOVE_KEYS).includes(event.code)) {
      keysPressed.current.add(event.code);
      onMoveInput(calculateMovementInput());
    }
  }, [onPTTPressed, onInteractPressed, onMoveInput, calculateMovementInput]);

  // Handle keyup events
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    // Handle PTT key release
    if (event.code === PTT_KEY && pttActive.current) {
      pttActive.current = false;
      onPTTReleased();
    }

    // Track movement keys
    if (Object.values(MOVE_KEYS).includes(event.code)) {
      keysPressed.current.delete(event.code);
      onMoveInput(calculateMovementInput());
    }
  }, [onPTTReleased, onMoveInput, calculateMovementInput]);

  // Handle mouse movement for look input
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // Only process mouse look when pointer is locked
    if (!pointerLocked.current) return;

    const deltaX = event.movementX || 0;
    const deltaY = event.movementY || 0;

    if (deltaX !== 0 || deltaY !== 0) {
      onLookInput({ x: deltaX, y: deltaY });
    }
  }, [onLookInput]);

  // Handle pointer lock change
  const handlePointerLockChange = useCallback(() => {
    pointerLocked.current = document.pointerLockElement !== null;
  }, []);

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [handleKeyDown, handleKeyUp, handleMouseMove, handlePointerLockChange]);

  // Expose final choice selection as a manual call (not key-bound)
  // This is called from UI components
  useEffect(() => {
    // Store reference for external access if needed
    (window as unknown as { selectFinalChoice: (choice: FinalChoice) => void }).selectFinalChoice = onFinalChoiceSelected;
    
    return () => {
      delete (window as unknown as { selectFinalChoice?: (choice: FinalChoice) => void }).selectFinalChoice;
    };
  }, [onFinalChoiceSelected]);
}

/**
 * Helper function to request pointer lock for mouse look
 */
export function requestPointerLock(element: HTMLElement): void {
  element.requestPointerLock();
}

/**
 * Helper function to exit pointer lock
 */
export function exitPointerLock(): void {
  document.exitPointerLock();
}

/**
 * Check if pointer is currently locked
 */
export function isPointerLocked(): boolean {
  return document.pointerLockElement !== null;
}
