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
 * World-space glowing cube you can approach and press E to inspect.
 * Registers itself with the interactableRegistry so PlayerController can
 * find it each frame.
 */
export function InteractableProp({
  id,
  position,
  interactionPrompt,
  revealContent,
  puzzleId,
  isMidGameRevealProp,
  color,
}: InteractablePropProps) {
  const meshRef = useRef<Mesh>(null);
  const openReveal = useGameStateStore((s) => s.openReveal);
  const triggerMidGameReveal = useGameStateStore((s) => s.triggerMidGameReveal);
  const solvedPuzzles = useGameStateStore((s) => s.solvedPuzzles);

  const isSolved =
    puzzleId != null ? solvedPuzzles.has(puzzleId) : false;

  const worldPos = useMemo(
    () => new Vector3(position[0], position[1], position[2]),
    [position],
  );

  // Register / unregister with the shared interactable registry.
  useEffect(() => {
    interactableRegistry.register({
      id,
      position: worldPos,
      prompt: interactionPrompt,
      onInteract: () => {
        audioBus.playSFX?.(SFXKey.ObjectInteract);
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
    isSolved,
    openReveal,
    triggerMidGameReveal,
  ]);

  // Gentle vertical bob + rotation so they read as interactable.
  useFrame((_, dt) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += dt * 0.6;
    meshRef.current.position.y = position[1] + Math.sin(performance.now() * 0.002) * 0.06;
  });

  return (
    <mesh ref={meshRef} position={position} castShadow>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial
        color={color ?? '#38bdf8'}
        emissive={color ?? '#38bdf8'}
        emissiveIntensity={isSolved ? 0.15 : 0.9}
        roughness={0.3}
        metalness={0.4}
      />
    </mesh>
  );
}
