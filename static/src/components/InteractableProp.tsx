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
 * panel; special flags swap in alternate behaviour. Final-room levers and
 * the commit button don't render any mesh here — their visuals live in
 * `FinalRoom` and react to the store state directly — they only register
 * an interaction volume.
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
  isFinalNote,
  isFinalLever,
  isFinalCommit,
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
  const leverLeftPulled = useGameStateStore((s) => s.leverLeftPulled);
  const leverRightPulled = useGameStateStore((s) => s.leverRightPulled);
  const toggleLever = useGameStateStore((s) => s.toggleLever);
  const triggerFinalCutscene = useGameStateStore((s) => s.triggerFinalCutscene);
  const finalCutscenePlaying = useGameStateStore((s) => s.finalCutscenePlaying);

  const isSolved =
    puzzleId != null ? solvedPuzzles.has(puzzleId) : false;

  // A keycard is "consumed" once picked up; the door-reader stops being
  // interactable once the door is open. Final-room interactables stay
  // available until the cutscene starts (at which point we freeze them).
  const isConsumed =
    (isKeycard && hasKeycard) ||
    (isKeycardDoor && door0Opened) ||
    ((isFinalLever || isFinalCommit) && finalCutscenePlaying);

  const worldPos = useMemo(
    () => new Vector3(position[0], position[1], position[2]),
    [position],
  );

  // The lever's prompt reflects whether it's currently pulled.
  const dynamicPrompt =
    isFinalLever === 'left'
      ? leverLeftPulled
        ? 'Push the LEFT lever back up'
        : 'Pull the LEFT lever down'
      : isFinalLever === 'right'
      ? leverRightPulled
        ? 'Push the RIGHT lever back up'
        : 'Pull the RIGHT lever down'
      : interactionPrompt;

  useEffect(() => {
    if (isConsumed) {
      interactableRegistry.unregister(id);
      return;
    }
    interactableRegistry.register({
      id,
      position: worldPos,
      prompt: dynamicPrompt,
      onInteract: () => {
        audioBus.playSFX?.(SFXKey.ObjectInteract);

        if (isKeycard) {
          pickUpKeycard();
          return;
        }

        if (isKeycardDoor) {
          const ok = openDoor0WithKeycard();
          if (!ok) {
            openReveal('The reader blinks red. You need a keycard.', null);
          }
          return;
        }

        if (isFinalLever) {
          toggleLever(isFinalLever);
          return;
        }

        if (isFinalCommit) {
          // Commit whatever lever state is set. The orchestration
          // (context injection, partner decision, ending resolution) is
          // driven from App.tsx by watching `finalCutscenePlaying`.
          triggerFinalCutscene();
          return;
        }

        if (isFinalNote) {
          openReveal(revealContent, null);
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
    dynamicPrompt,
    revealContent,
    puzzleId,
    isMidGameRevealProp,
    isKeycard,
    isKeycardDoor,
    isFinalNote,
    isFinalLever,
    isFinalCommit,
    isConsumed,
    isSolved,
    openReveal,
    triggerMidGameReveal,
    pickUpKeycard,
    openDoor0WithKeycard,
    toggleLever,
    triggerFinalCutscene,
  ]);

  useFrame((_, dt) => {
    void dt;
    if (!meshRef.current || isConsumed) return;
    meshRef.current.rotation.y += 0.01;
    meshRef.current.position.y = position[1] + Math.sin(performance.now() * 0.002) * 0.06;
  });

  // Levers + commit button have their visuals rendered in FinalRoom; we
  // only register the interaction volume, so skip the mesh here.
  if (isFinalLever || isFinalCommit) return null;
  if (isConsumed) return null;

  // Keycard gets a flatter card-shaped mesh, the door-reader a small panel,
  // the note a flat card.
  const geom =
    isKeycard ? ([0.45, 0.28, 0.04] as const)
    : isKeycardDoor ? ([0.4, 0.55, 0.08] as const)
    : isFinalNote ? ([0.35, 0.02, 0.45] as const)
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
