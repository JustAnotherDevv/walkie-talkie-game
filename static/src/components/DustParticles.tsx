import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DustParticlesProps {
  count?: number;
  /** World-space AABB the dust fills. */
  min?: [number, number, number];
  max?: [number, number, number];
  size?: number;
  color?: string;
  opacity?: number;
  /** Additive blending reads as bright "motes in sun"; normal reads as fog. */
  additive?: boolean;
}

/**
 * Soft circular sprite with a radial alpha gradient — the classic dust /
 * fog particle look. Generated once on module load and shared across all
 * DustParticles instances.
 */
// Pure white radial falloff so the `color` prop fully controls the tint.
const SPRITE_TEXTURE: THREE.CanvasTexture = (() => {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
  g.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
})();

/**
 * A field of slow-drifting dust motes rendered as soft circular sprites.
 * Positions are random within a bounding box; each mote gets its own phase
 * so the drift reads as individual floating particles, not a uniform sweep.
 */
export function DustParticles({
  count = 800,
  min = [-7, -2, -6],
  max = [7, 6, 34],
  size = 0.14,
  color = '#fef3c7',
  opacity = 0.55,
  additive = false,
}: DustParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);

  // Destructure to primitives so deps are compared by value, not by array
  // reference — otherwise every parent re-render (of which there are many
  // during live audio) allocates fresh [x,y,z] literals and the memo
  // re-runs, re-randomizing every particle each frame.
  const [minX, minY, minZ] = min;
  const [maxX, maxY, maxZ] = max;
  const { positions, phases, basePositions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const basePositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      const z = minZ + Math.random() * (maxZ - minZ);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, phases, basePositions };
  }, [count, minX, minY, minZ, maxX, maxY, maxZ]);

  useFrame(({ clock }) => {
    const geo = pointsRef.current?.geometry as THREE.BufferGeometry | undefined;
    if (!geo) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const p = phases[i];
      // Tiny drift + a touch of upward bias so dust feels like it's rising
      // in the warm air, not sloshing side-to-side.
      arr[i * 3] = basePositions[i * 3] + Math.sin(t * 0.15 + p) * 0.12;
      arr[i * 3 + 1] =
        basePositions[i * 3 + 1] +
        Math.sin(t * 0.18 + p * 1.3) * 0.08 +
        Math.sin(t * 0.05 + p) * 0.05;
      arr[i * 3 + 2] = basePositions[i * 3 + 2] + Math.cos(t * 0.12 + p) * 0.12;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={SPRITE_TEXTURE}
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        alphaTest={0.001}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}
