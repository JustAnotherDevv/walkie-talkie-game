import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useInput } from '../hooks/useInput';
import { interactableRegistry } from '../services/interactableRegistry';
import { useGameStateStore } from '../stores/gameStateStore';

const MOVE_SPEED = 4;
const LOOK_SENSITIVITY = 0.0025;
const PITCH_CLAMP = Math.PI / 2 - 0.05;
const INTERACTION_RANGE = 3;

interface PlayerControllerProps {
  enabled: boolean;
}

export function PlayerController({ enabled }: PlayerControllerProps) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  const currentInteractableId = useRef<string | null>(null);
  const setInteractionPrompt = useGameStateStore((s) => s.setInteractionPrompt);

  const { input } = useInput(
    {
      onLook: (dx, dy) => {
        yaw.current -= dx * LOOK_SENSITIVITY;
        pitch.current -= dy * LOOK_SENSITIVITY;
        pitch.current = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, pitch.current));
      },
      onInteract: () => {
        if (!currentInteractableId.current) return;
        const item = interactableRegistry.get(currentInteractableId.current);
        item?.onInteract();
      },
    },
    enabled,
  );

  // Pointer lock on canvas click.
  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;
    const handler = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    };
    canvas.addEventListener('click', handler);
    return () => canvas.removeEventListener('click', handler);
  }, [enabled, gl.domElement]);

  useFrame((_, dt) => {
    if (!enabled) return;

    // Orientation
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

    forward.current.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    right.current.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

    move.current.set(0, 0, 0);
    if (input.current.forward) move.current.add(forward.current);
    if (input.current.back) move.current.sub(forward.current);
    if (input.current.right) move.current.add(right.current);
    if (input.current.left) move.current.sub(right.current);

    if (move.current.lengthSq() > 0) {
      move.current.normalize().multiplyScalar(MOVE_SPEED * dt);
      camera.position.add(move.current);
    }

    // Scan for nearest interactable in range. Writes interactionPrompt only
    // when the focused target actually changes — not every frame.
    let nearestId: string | null = null;
    let nearestDist = INTERACTION_RANGE;
    let nearestPrompt: string | null = null;

    for (const item of interactableRegistry.getAll()) {
      if (item.isRevealed()) continue;
      const dist = camera.position.distanceTo(item.position);
      if (dist <= nearestDist) {
        nearestDist = dist;
        nearestId = item.id;
        nearestPrompt = item.prompt;
      }
    }

    if (nearestId !== currentInteractableId.current) {
      currentInteractableId.current = nearestId;
      setInteractionPrompt(nearestPrompt);
    }
  });

  return null;
}
