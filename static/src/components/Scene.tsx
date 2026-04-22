import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { PlayerController } from './PlayerController';
import { RoomScene } from './RoomScene';
import { InteractableProp } from './InteractableProp';
import { WalkieTalkie } from './WalkieTalkie';
import { DustParticles } from './DustParticles';
import { IntroCamera, type IntroPhase } from './IntroCamera';
import { props as propInstances } from '../puzzles/puzzleInstances';
import type { LightingMode } from '../stores/gameStateStore';

interface SceneProps {
  movementEnabled: boolean;
  lightingMode: LightingMode;
  introPhase?: IntroPhase;
}

export function Scene({ movementEnabled, lightingMode, introPhase = 'off' }: SceneProps) {
  const introActive = introPhase !== 'off';
  // Memoised so R3F doesn't re-`applyProps` the camera every render —
  // that was snapping the camera back to (0, 0, 2) and cancelling the
  // intro lying pose / wake-up animation set by IntroCamera.
  const cameraConfig = useMemo(() => ({ position: [0, 0, 2] as [number, number, number], fov: 68 }), []);

  // Snap the camera into the lying-on-floor pose the moment R3F
  // finishes creating it — guarantees the first rendered frame shows
  // the intro pose, not the default eye-level pose. Scene is only ever
  // mounted after the player presses Play (which always triggers the
  // intro), so this is safe to run unconditionally.
  const onCanvasCreated = useMemo(
    () => ({ camera }: { camera: THREE.Camera }) => {
      camera.rotation.order = 'YXZ';
      camera.position.set(-0.6, -1.75, 2);
      camera.rotation.set(0.15, 0, Math.PI / 2);
    },
    [],
  );
  const bg =
    lightingMode === 'cut'
      ? '#000000'
      : lightingMode === 'dim'
      ? '#0e0a06'
      : '#1a120a';

  return (
    <Canvas
      camera={cameraConfig}
      onCreated={onCanvasCreated}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={[bg]} />
      {/* Camera wake-up animation drives the camera while the intro
          overlay fades out — PlayerController is disabled in the same
          window so the two don't fight over the camera transform. */}
      <IntroCamera phase={introPhase} />
      <PlayerController enabled={movementEnabled && !introActive} />
      <RoomScene />
      {propInstances.map((p) => (
        <InteractableProp key={p.id} {...p} />
      ))}
      {/* Dust — small gray motes. Additive in the main hall so they catch
          the warm god-ray light; normal blending elsewhere for subtle haze. */}
      <DustParticles
        count={500}
        min={[-10, -2, 8]}
        max={[10, 11, 38]}
        opacity={0.38}
        size={0.08}
        color={'#9a948a'}
        additive
      />
      {/* Extra dense bright motes confined to the god-ray volumes. Bounds
          cover the full window-wall swept toward the floor-kiss area —
          one continuous cloud across all three beams. */}
      <DustParticles
        count={420}
        min={[-4, -2, 8]}
        max={[10, 9, 35]}
        opacity={0.6}
        size={0.065}
        color={'#fff0cc'}
        additive
      />
      <DustParticles
        count={70}
        min={[-8, -2, -5]}
        max={[6, 2, 6]}
        opacity={0.32}
        size={0.09}
        color={'#5c574f'}
      />
      <DustParticles
        count={60}
        min={[-5, -2, 40]}
        max={[5, 3, 52]}
        opacity={0.35}
        size={0.09}
        color={'#4f4a42'}
      />
      {/* Held walkie-talkie — always on top of world geometry. */}
      <WalkieTalkie enabled={movementEnabled} />
    </Canvas>
  );
}
