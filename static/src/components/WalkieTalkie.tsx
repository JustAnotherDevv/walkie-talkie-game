import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useInput } from '../hooks/useInput';

/**
 * First-person held walkie-talkie. The group is declared as a child of the
 * camera via `<primitive object={camera}>` — this makes its world transform
 * a function of the camera's matrix, updated during three.js's scene
 * traversal (after all useFrame callbacks, before render). That eliminates
 * the one-frame lag a separate useFrame-driven world-space update had.
 *
 * Rendered with depthTest off and renderOrder 999 so world geometry never
 * clips through it — classic FPS weapon trick.
 */
export function WalkieTalkie({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const ledRef = useRef<THREE.Mesh>(null);
  const bobPhase = useRef(0);
  const movingAmount = useRef(0);

  const { input } = useInput({}, enabled);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;

    const isMoving =
      input.current.forward ||
      input.current.back ||
      input.current.left ||
      input.current.right;

    const target = isMoving ? 1 : 0;
    movingAmount.current += (target - movingAmount.current) * Math.min(1, dt * 6);
    bobPhase.current += dt * (isMoving ? 8 : 2);

    const bobY = Math.sin(bobPhase.current) * 0.012 * movingAmount.current;
    const bobX = Math.cos(bobPhase.current * 0.5) * 0.008 * movingAmount.current;
    const idleY = Math.sin(performance.now() * 0.0015) * 0.004;

    // Local-space offset relative to the camera. No world-space math needed
    // — the parent camera's matrix handles that during scene traversal.
    g.position.set(-0.28 + bobX, -0.26 + bobY + idleY, -0.42);
    g.rotation.set(-0.05, 0.22, -0.08);

    if (ledRef.current) {
      const mat = ledRef.current.material as THREE.MeshStandardMaterial;
      const pulse = 0.7 + Math.sin(performance.now() * 0.004) * 0.5;
      mat.emissiveIntensity = Math.max(0.2, pulse);
    }
  });

  return (
    <primitive object={camera}>
      <group ref={groupRef} renderOrder={999}>
        {/* Main yellow body */}
        <mesh renderOrder={999}>
          <boxGeometry args={[0.11, 0.22, 0.045]} />
          <meshStandardMaterial
            color={'#e8b83a'}
            roughness={0.6}
            metalness={0.1}
            depthTest={false}
            flatShading
          />
        </mesh>
        {/* Top bevel / speaker housing */}
        <mesh position={[0, 0.09, 0.005]} renderOrder={999}>
          <boxGeometry args={[0.1, 0.06, 0.048]} />
          <meshStandardMaterial
            color={'#1a1a1a'}
            roughness={0.8}
            depthTest={false}
            flatShading
          />
        </mesh>
        {/* Speaker grille detail */}
        <mesh position={[0, 0.09, 0.028]} renderOrder={999}>
          <boxGeometry args={[0.07, 0.04, 0.003]} />
          <meshStandardMaterial
            color={'#0a0a0a'}
            roughness={1.0}
            depthTest={false}
          />
        </mesh>
        {/* Antenna base */}
        <mesh position={[0.03, 0.13, 0]} renderOrder={999}>
          <boxGeometry args={[0.025, 0.04, 0.025]} />
          <meshStandardMaterial color={'#111'} depthTest={false} flatShading />
        </mesh>
        {/* Antenna rod */}
        <mesh position={[0.03, 0.22, 0]} renderOrder={999}>
          <cylinderGeometry args={[0.006, 0.008, 0.14, 6]} />
          <meshStandardMaterial
            color={'#0a0a0a'}
            roughness={0.4}
            metalness={0.4}
            depthTest={false}
            flatShading
          />
        </mesh>
        {/* PTT side button */}
        <mesh position={[0.056, 0.02, 0]} renderOrder={999}>
          <boxGeometry args={[0.012, 0.035, 0.02]} />
          <meshStandardMaterial color={'#333'} depthTest={false} flatShading />
        </mesh>
        {/* Front panel dark inset */}
        <mesh position={[0, -0.02, 0.023]} renderOrder={999}>
          <boxGeometry args={[0.08, 0.1, 0.005]} />
          <meshStandardMaterial
            color={'#0f0f0f'}
            roughness={0.9}
            depthTest={false}
            flatShading
          />
        </mesh>
        {/* Red LED */}
        <mesh ref={ledRef} position={[-0.028, -0.06, 0.024]} renderOrder={999}>
          <boxGeometry args={[0.012, 0.012, 0.004]} />
          <meshStandardMaterial
            color={'#ef4444'}
            emissive={'#ef4444'}
            emissiveIntensity={0.8}
            depthTest={false}
          />
        </mesh>
        {/* Dial knob */}
        <mesh position={[0, 0.04, 0.025]} renderOrder={999}>
          <cylinderGeometry args={[0.018, 0.018, 0.006, 12]} />
          <meshStandardMaterial color={'#2a2a2a'} depthTest={false} flatShading />
        </mesh>
      </group>
    </primitive>
  );
}
