import { Canvas } from '@react-three/fiber';
import { PlayerController } from './PlayerController';
import { RoomScene } from './RoomScene';
import { InteractableProp } from './InteractableProp';
import { WalkieTalkie } from './WalkieTalkie';
import { DustParticles } from './DustParticles';
import { props as propInstances } from '../puzzles/puzzleInstances';
import type { LightingMode } from '../stores/gameStateStore';

interface SceneProps {
  movementEnabled: boolean;
  lightingMode: LightingMode;
}

export function Scene({ movementEnabled, lightingMode }: SceneProps) {
  const bg =
    lightingMode === 'cut'
      ? '#000000'
      : lightingMode === 'dim'
      ? '#0e0a06'
      : '#1a120a';

  return (
    <Canvas
      camera={{ position: [0, 0, 2], fov: 68 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={[bg]} />
      <PlayerController enabled={movementEnabled} />
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
