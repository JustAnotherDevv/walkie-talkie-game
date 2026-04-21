import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { IInteractable, Prop } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';
import { interactableRegistry } from '../services/interactableRegistry';

// Default interaction range (must match PlayerController)
export const INTERACTION_RANGE = 3;

export interface InteractableHandle extends IInteractable {
  readonly id: string;
  isRevealed(): boolean;
  getRevealContent(): string;
  setPlayerInRange(inRange: boolean): void;
}

export interface CreatePropInteractableOptions {
  id: string;
  interactionPrompt: string;
  revealContent: string;
  isMidGameRevealProp: boolean;
  position: { x: number; y: number; z: number };
  onInteracted?: (revealContent: string) => void;
  onMidGameReveal?: () => void;
}

/**
 * Pure factory that produces an IInteractable handle for a prop.
 * Validates: Requirements 1.3, 1.4
 *
 * The returned handle is a plain object so it can be driven from
 * both the R3F component and from unit/property tests without a renderer.
 */
export function createPropInteractable(
  options: CreatePropInteractableOptions,
): InteractableHandle {
  let revealed = false;
  let inRange = false;

  const handle: InteractableHandle = {
    id: options.id,
    position: {
      x: options.position.x,
      y: options.position.y,
      z: options.position.z,
    },

    getPromptText: () => options.interactionPrompt,

    get isInteractable() {
      return inRange && !revealed;
    },

    interact() {
      if (revealed) return;
      revealed = true;

      options.onInteracted?.(options.revealContent);

      if (options.isMidGameRevealProp) {
        options.onMidGameReveal?.();
      }
    },

    isRevealed: () => revealed,
    getRevealContent: () => options.revealContent,
    setPlayerInRange: (val: boolean) => {
      inRange = val;
    },
  };

  return handle;
}

interface InteractablePropProps extends Prop {
  position: [number, number, number];
  onInteracted?: (revealContent: string) => void;
}

/**
 * InteractableProp - R3F component for interactable objects
 * Validates: Requirements 1.3, 1.4
 *
 * Renders a visible mesh, tracks player distance, and bridges the shared
 * IInteractable contract with the game state store so reveal content and
 * interaction prompts surface in the UI.
 */
export function InteractableProp({
  id,
  position,
  interactionPrompt,
  revealContent,
  isMidGameRevealProp,
  puzzleId,
  onInteracted,
}: InteractablePropProps) {
  void puzzleId;

  const triggerMidGameReveal = useGameStateStore((state) => state.triggerMidGameReveal);
  const setRevealedContent = useGameStateStore((state) => state.setRevealedContent);
  const setInteractionPrompt = useGameStateStore((state) => state.setInteractionPrompt);

  // Stable handle for the lifetime of this prop
  const handle = useMemo(
    () =>
      createPropInteractable({
        id,
        interactionPrompt,
        revealContent,
        isMidGameRevealProp,
        position: { x: position[0], y: position[1], z: position[2] },
        onInteracted: (content) => {
          setRevealedContent(content);
          onInteracted?.(content);
        },
        onMidGameReveal: () => {
          triggerMidGameReveal();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  const wasInRange = useRef(false);
  const propPosition = useMemo(
    () => new Vector3(position[0], position[1], position[2]),
    [position],
  );

  useFrame(({ camera }) => {
    if (!camera) return;
    const distance = camera.position.distanceTo(propPosition);
    const nowInRange = distance <= INTERACTION_RANGE;
    handle.setPlayerInRange(nowInRange);

    if (nowInRange !== wasInRange.current) {
      wasInRange.current = nowInRange;
      if (nowInRange && !handle.isRevealed()) {
        setInteractionPrompt(handle.getPromptText());
      } else {
        // Only clear if we were the active prompt
        const current = useGameStateStore.getState().currentInteractionPrompt;
        if (current === handle.getPromptText()) {
          setInteractionPrompt(null);
        }
      }
    }
  });

  useEffect(() => {
    interactableRegistry.register(handle);
    return () => {
      interactableRegistry.unregister(handle);
    };
  }, [handle]);

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial
          color={isMidGameRevealProp ? '#d97706' : '#38bdf8'}
          emissive={isMidGameRevealProp ? '#7c2d12' : '#0c4a6e'}
          emissiveIntensity={0.35}
        />
      </mesh>
    </group>
  );
}

/**
 * Helper retained for Property 1 tests.
 */
export function isPropInteractable(
  propPosition: [number, number, number],
  playerPosition: Vector3,
  range: number = INTERACTION_RANGE,
): boolean {
  const propPos = new Vector3(propPosition[0], propPosition[1], propPosition[2]);
  return playerPosition.distanceTo(propPos) <= range;
}
