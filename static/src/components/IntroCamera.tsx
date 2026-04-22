import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

type IntroPhase = 'off' | 'lying' | 'waking';

// Two-stage keyframes for the wake-up animation. Values below are world-
// space coordinates (camera position) and local rotations (radians).
//
//   LYING      — on the floor, rolled onto the right side, head turned
//                slightly toward the wall.
//   MID        — pushed up onto one elbow: torso vertical-ish, head at
//                ~sitting height, looking slightly down at the floor
//                in front of them.
//   STANDING   — fully upright, eye-level, facing forward.
const LYING_POS    = { x: -0.6, y: -1.75, z: 2 };
const MID_POS      = { x: -0.2, y: -1.0,  z: 2 };
const STANDING_POS = { x:  0,   y:  0,    z: 2 };

const LYING_ROLL   = Math.PI / 2;  // rotation.z
const LYING_PITCH  = 0.15;         // rotation.x (looking at floor)
const MID_PITCH    = -0.25;        // rotation.x (looking up slightly)
const STANDING_PITCH = 0;

// Fraction of total duration spent on stage 1 (roll + sit).
const STAGE1_END = 0.4;

/**
 * Camera wake-up animation. All pose control lives inside one useFrame
 * so the pose is re-asserted every frame during `lying` (nothing can
 * drift it) and the `waking` timer starts on the first frame the phase
 * flips — no reliance on useEffect timing.
 *
 * The waking animation is two-stage: first the camera rolls off its
 * side and rises to "sitting on one elbow", then it stands up to
 * eye-level. A small lateral sway is overlaid throughout so it reads
 * as a person regaining their balance, not a teleporting cube.
 */
export function IntroCamera({
  phase,
  durationMs = 2200,
}: {
  phase: IntroPhase;
  durationMs?: number;
}) {
  const { camera } = useThree();
  const startRef = useRef<number | null>(null);
  const prevPhase = useRef<IntroPhase>('off');

  // Set the lying pose synchronously the moment the phase becomes
  // 'lying' so the very first paint shows the player on the floor,
  // not at the default (0,0,2) origin. useFrame also re-asserts the
  // pose below — this effect just wins the first frame.
  useLayoutEffect(() => {
    if (phase === 'lying' || phase === 'waking') {
      camera.rotation.order = 'YXZ';
      camera.position.set(LYING_POS.x, LYING_POS.y, LYING_POS.z);
      camera.rotation.set(LYING_PITCH, 0, LYING_ROLL);
    }
  }, [phase, camera]);

  useFrame(() => {
    if (phase === 'off') {
      prevPhase.current = 'off';
      startRef.current = null;
      return;
    }

    if (phase === 'lying') {
      camera.rotation.order = 'YXZ';
      camera.position.set(LYING_POS.x, LYING_POS.y, LYING_POS.z);
      camera.rotation.set(LYING_PITCH, 0, LYING_ROLL);
      prevPhase.current = 'lying';
      startRef.current = null;
      return;
    }

    // phase === 'waking'
    if (prevPhase.current !== 'waking' || startRef.current === null) {
      startRef.current = performance.now();
      prevPhase.current = 'waking';
    }

    const t = Math.min(1, (performance.now() - startRef.current) / durationMs);

    let posX: number, posY: number, posZ: number;
    let rotX: number, rotZ: number;

    if (t < STAGE1_END) {
      // Stage 1: roll from side → sitting-up pose.
      const s = t / STAGE1_END;
      const e = 1 - Math.pow(1 - s, 3);         // easeOutCubic
      posX = LYING_POS.x + (MID_POS.x - LYING_POS.x) * e;
      posY = LYING_POS.y + (MID_POS.y - LYING_POS.y) * e;
      posZ = LYING_POS.z;
      rotX = LYING_PITCH + (MID_PITCH - LYING_PITCH) * e;
      rotZ = LYING_ROLL * (1 - e);              // roll goes fully flat in stage 1
    } else {
      // Stage 2: stand up.
      const s = (t - STAGE1_END) / (1 - STAGE1_END);
      const e = 1 - Math.pow(1 - s, 3);
      posX = MID_POS.x + (STANDING_POS.x - MID_POS.x) * e;
      posY = MID_POS.y + (STANDING_POS.y - MID_POS.y) * e;
      posZ = MID_POS.z;
      rotX = MID_PITCH + (STANDING_PITCH - MID_PITCH) * e;
      rotZ = 0;
    }

    // Slight lateral sway that fades out as the player "steadies" — sells
    // the balance-regaining feel. Amplitude decays with t.
    const sway = Math.sin(t * Math.PI * 2.1) * 0.035 * (1 - t);

    camera.rotation.order = 'YXZ';
    camera.position.set(posX, posY, posZ);
    camera.rotation.set(rotX, sway, rotZ);
  });

  return null;
}

export type { IntroPhase };
