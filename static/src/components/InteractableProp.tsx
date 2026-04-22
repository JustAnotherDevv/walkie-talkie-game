import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Mesh } from 'three';
import type { Prop } from '../types/prop';
import { interactableRegistry } from '../services/interactableRegistry';
import { useGameStateStore } from '../stores/gameStateStore';
import { audioBus } from '../services/audioBus';
import { SFXKey } from '../types/audio';

interface InteractablePropProps extends Prop {}

/**
 * World-space glowing interactable. Default behaviour is to open a reveal
 * panel; special flags (`isKeycard`, `isKeycardDoor`, `isMidGameRevealProp`)
 * swap in alternate behaviour and — for the keycard / door pair — hide the
 * prop after it's been "used".
 */
export function InteractableProp({
  id,
  position,
  interactionPrompt,
  revealContent,
  puzzleId,
  isMidGameRevealProp,
  isKeycard,
  isKeycardDoor,
  color,
}: InteractablePropProps) {
  const meshRef = useRef<Mesh>(null);
  const openReveal = useGameStateStore((s) => s.openReveal);
  const triggerMidGameReveal = useGameStateStore((s) => s.triggerMidGameReveal);
  const solvedPuzzles = useGameStateStore((s) => s.solvedPuzzles);
  const hasKeycard = useGameStateStore((s) => s.hasKeycard);
  const door0Opened = useGameStateStore((s) => s.door0Opened);
  const pickUpKeycard = useGameStateStore((s) => s.pickUpKeycard);
  const openDoor0WithKeycard = useGameStateStore((s) => s.openDoor0WithKeycard);

  const isSolved =
    puzzleId != null ? solvedPuzzles.has(puzzleId) : false;

  // A keycard is "consumed" once picked up; the door-reader stops being
  // interactable once the door is open.
  const isConsumed =
    (isKeycard && hasKeycard) || (isKeycardDoor && door0Opened);

  const worldPos = useMemo(
    () => new Vector3(position[0], position[1], position[2]),
    [position],
  );

  useEffect(() => {
    if (isConsumed) {
      interactableRegistry.unregister(id);
      return;
    }
    interactableRegistry.register({
      id,
      position: worldPos,
      prompt: interactionPrompt,
      onInteract: () => {
        audioBus.playSFX?.(SFXKey.ObjectInteract);

        if (isKeycard) {
          pickUpKeycard();
          return;
        }

        if (isKeycardDoor) {
          const ok = openDoor0WithKeycard();
          // No reveal on success — the door swings open and that is the
          // feedback. Only show a reveal when the player tries without a
          // keycard so the failure isn't silent.
          if (!ok) {
            openReveal('The reader blinks red. You need a keycard.', null);
          }
          return;
        }

        openReveal(revealContent, puzzleId);
        if (isMidGameRevealProp) {
          triggerMidGameReveal();
          audioBus.playSFX?.(SFXKey.StaticBurst);
        }
      },
      isRevealed: () => isSolved,
    });
    return () => interactableRegistry.unregister(id);
  }, [
    id,
    worldPos,
    interactionPrompt,
    revealContent,
    puzzleId,
    isMidGameRevealProp,
    isKeycard,
    isKeycardDoor,
    isConsumed,
    isSolved,
    openReveal,
    triggerMidGameReveal,
    pickUpKeycard,
    openDoor0WithKeycard,
  ]);

  useFrame((_, dt) => {
    void dt;
    if (!meshRef.current || isConsumed) return;
    meshRef.current.rotation.y += 0.01;
    meshRef.current.position.y = position[1] + Math.sin(performance.now() * 0.002) * 0.06;
  });

  if (isConsumed) return null;

  // Keycard gets a flatter card-shaped mesh, the door-reader a small panel.
  const geom =
    isKeycard ? ([0.45, 0.28, 0.04] as const)
    : isKeycardDoor ? ([0.4, 0.55, 0.08] as const)
    : ([0.5, 0.5, 0.5] as const);

  const accent = color ?? '#38bdf8';

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[...geom]} />
      <meshStandardMaterial
        color={accent}
        emissive={accent}
        emissiveIntensity={isSolved ? 0.15 : 0.9}
        roughness={0.3}
        metalness={0.4}
      />
    </mesh>
  );
}
