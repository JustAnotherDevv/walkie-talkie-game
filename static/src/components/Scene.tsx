import { Canvas } from '@react-three/fiber';
import { PlayerController } from './PlayerController';
import { RoomScene } from './RoomScene';
import { InteractableProp } from './InteractableProp';
import { props as propInstances } from '../puzzles/puzzleInstances';

interface SceneProps {
  movementEnabled: boolean;
}

export function Scene({ movementEnabled }: SceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, 2], fov: 70 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#05050a']} />
      <PlayerController enabled={movementEnabled} />
      <RoomScene />
      {propInstances.map((p) => (
        <InteractableProp key={p.id} {...p} />
      ))}
    </Canvas>
  );
}
