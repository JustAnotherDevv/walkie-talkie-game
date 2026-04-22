import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useInput } from '../hooks/useInput';
import { interactableRegistry } from '../services/interactableRegistry';
import { useGameStateStore } from '../stores/gameStateStore';
import { isDoorLocked } from '../puzzles/puzzleInstances';
import { getFloorY, EYE_HEIGHT } from './RoomScene';

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

  // Door gating: derived every frame from the store so solving a puzzle
  // immediately unblocks the corridor.
  const doorsMode = useGameStateStore((s) => s.doorsMode);
  const solvedPuzzles = useGameStateStore((s) => s.solvedPuzzles);
  const door0Opened = useGameStateStore((s) => s.door0Opened);

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
      const prevX = camera.position.x;
      const prevZ = camera.position.z;
      camera.position.add(move.current);

      // Door-gating collision on the Z axis. Door 0 sits at z=6 (shared
      // wall between room 0 and main hall, no corridor between them).
      // Door 1 sits at z=38 (always open now). Clamp Z just before the
      // doorway plane when the door is locked.
      const door0Locked =
        doorsMode === 'all-sealed' ||
        (doorsMode !== 'all-open' && isDoorLocked(0, solvedPuzzles, door0Opened));
      const door1Locked =
        doorsMode === 'all-sealed' ||
        (doorsMode !== 'all-open' && isDoorLocked(1, solvedPuzzles, door0Opened));

      if (door0Locked && prevZ < 5.6 && camera.position.z >= 5.6) {
        camera.position.z = 5.4;
      } else if (!door0Locked && door1Locked && prevZ < 38.6 && camera.position.z >= 38.6) {
        camera.position.z = 38.4;
      } else if (door1Locked && prevZ > 38.6 && camera.position.z <= 38.6) {
        // Rare case: pushed backwards through a locked door.
        camera.position.z = 38.8;
      }

      // Catwalk door (main hall -X wall at mezzanine level, z ∈ [35.5,
      // 37.5]). Locked until puzzles 02 + 03 are solved. Player must be
      // near the mezzanine eye-height and within the doorway's Z range
      // for this to block them on the X axis.
      const catwalkLocked =
        doorsMode === 'all-sealed' ||
        (doorsMode !== 'all-open' &&
          !(solvedPuzzles.has('puzzle_02_split_combination') &&
            solvedPuzzles.has('puzzle_03_descriptive_match')));
      const atCatwalkDoor =
        camera.position.z >= 35.5 && camera.position.z <= 37.5 &&
        camera.position.y > 1.5; // above mezzanine floor (y=2) approximately
      if (catwalkLocked && atCatwalkDoor) {
        // Player crossing inward (mezzanine side → corridor): block at x=-9.8
        if (prevX > -9.8 && camera.position.x <= -9.8) {
          camera.position.x = -9.6;
        }
        // Rare backward push from corridor back into hall.
        if (prevX < -10.2 && camera.position.x >= -10.2) {
          camera.position.x = -10.4;
        }
      }
    }

    // Elevation: lift the camera onto ramps/stairs/platforms. Smoothed so
    // the transition isn't a teleport.
    const targetY = getFloorY(camera.position.x, camera.position.z, camera.position.y) + EYE_HEIGHT;
    camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 10);

    // Scan for nearest interactable in range. Writes interactionPrompt only
    // when the focused target actually changes — not every frame.
    let nearestId: string | null = null;
    let nearestDist = INTERACTION_RANGE;
    let nearestPrompt: string | null = null;

    for (const item of interactableRegistry.getAll()) {
      if (item.isRevealed()) continue;
      // Prop must be on roughly the same floor as the player — skip if
      // it's more than ~1.8m above or below the eye, otherwise a prop on
      // the mezzanine registers as "nearby" from the ground floor below.
      if (Math.abs(item.position.y - camera.position.y) > 1.8) continue;
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
