import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStateStore } from '../stores/gameStateStore';
import { isDoorLocked } from '../puzzles/puzzleInstances';

// ── Layout constants ────────────────────────────────────────────────
// The world is laid out along +Z. Player spawns at z≈2 inside the starter
// closet, walks through a corridor (door 0 at z=7) into the main control
// hall, then through another corridor (door 1 at z=21) into the final room.

export const FLOOR_Y = -2;
export const EYE_HEIGHT = 2;

// Starter closet (room 0) — widened ~2× so the closet is a proper small
// room, not a cramped box. L-shape kept with an alcove on -X.
const R0_MIN_X = -6;
const R0_MAX_X = 6;
const R0_MIN_Z = -5;
const R0_MAX_Z = 6;
const R0_CEIL = 2.25;
// Alcove notch on -X side (shifted outward with the main body).
const R0_ALCOVE_MIN_X = -8;
const R0_ALCOVE_MAX_X = -6;
const R0_ALCOVE_MIN_Z = -5;
const R0_ALCOVE_MAX_Z = -2;

// Main control hall (room 1) — big industrial space modelled on the
// Firewatch-style reference: 20m wide × 30m long × 10m eave (13m peak)
// with pitched roof, windows + stairs on +X wall (player's screen-left
// when facing into the hall), control panels on the -X wall.
const R1_MIN_X = -10;
const R1_MAX_X = 10;
// Main hall starts at z=6, sharing its -Z wall with room 0's +Z wall
// (no corridor between them — player steps directly from closet to hall).
const R1_MIN_Z = 6;
const R1_MAX_Z = 38;
const R1_CEIL = 10; // eave height above floor
const R1_PEAK_EXTRA = 3; // peak rises this much above eave

// Mezzanine surface height (raised walkway at roughly half room height).
const MZ_SURFACE_Y = 2;

// Mezzanine — left-of-screen strip (world +X side). Starts at the top of
// the stairs (now roughly in the middle of the hall, not at the entrance).
const MZ_L_MIN_X = 7;
const MZ_L_MAX_X = 10;
const MZ_L_MIN_Z = 26;
const MZ_L_MAX_Z = 38;

// Mezzanine — back-wall strip (across the full width at the far end).
const MZ_B_MIN_X = -10;
const MZ_B_MAX_X = 10;
const MZ_B_MIN_Z = 35;
const MZ_B_MAX_Z = 38;

// Stairs on the +X side, rising from the middle of the room up to the
// mezzanine. Player walks ~halfway down the hall before turning to climb.
const STAIR_MIN_X = 7;
const STAIR_MAX_X = 10;
const STAIR_MIN_Z = 22;
const STAIR_MAX_Z = 26;

// Corridor 1 (shifted deeper due to longer main hall)
const C1_MIN_Z = 38;
const C1_MAX_Z = 40;
const C1_MIN_X = -1.5;
const C1_MAX_X = 1.5;
// Tuned so the corridor ceiling sits at y=2 (same as the final room), a
// tidy metre above the 3m-tall doorway's top (y=1). That gives a visible
// lintel on the corridor side matching what you see from the hall side.
const C1_CEIL = 1.9;

// Side room (formerly "final room") behind the always-open ground-floor
// door 1. Kept for exploration; NOT the final room anymore.
const R2_MIN_X = -5;
const R2_MAX_X = 5;
const R2_MIN_Z = 40;
const R2_MAX_Z = 52;
const R2_CEIL = 2;

// Raised central platform in the side room (shifted with the room).
const PLAT_MIN_X = -2;
const PLAT_MAX_X = 2;
const PLAT_MIN_Z = 46;
const PLAT_MAX_Z = 49;
const PLAT_SURFACE_Y = -1;

// ── Catwalk door + corridor leading to the actual final room ──────────
// Catwalk door: cut into main hall's -X wall on the mezzanine back strip.
const CD_WIDTH = 2; // door / opening width in Z
const CD_Z_CENTER = 36.5;
const CD_Z_MIN = CD_Z_CENTER - CD_WIDTH / 2; // 35.5
const CD_Z_MAX = CD_Z_CENTER + CD_WIDTH / 2; // 37.5

// Catwalk corridor segment A — goes -X from the door.
const C2A_MIN_X = -22;
const C2A_MAX_X = -10;
const C2A_MIN_Z = 35;
const C2A_MAX_Z = 38;
const C2_CEIL_Y = MZ_SURFACE_Y + 4; // 6 — ceilings for both corridor segments

// Catwalk corridor segment B — turns "left" and runs +Z along the -X side.
const C2B_MIN_X = -22;
const C2B_MAX_X = -19;
const C2B_MIN_Z = 38;
const C2B_MAX_Z = 55;

// Catwalk descent stairs — full corridor-width descent down to ground.
const S2_MIN_X = -22;
const S2_MAX_X = -19;
const S2_MIN_Z = 55;
const S2_MAX_Z = 60;

// ── Final room (the actual final room, past the stairs) ───────────────
const FR_MIN_X = -34;
const FR_MAX_X = -10;
const FR_MIN_Z = 60;
const FR_MAX_Z = 82;
const FR_CEIL_Y = FLOOR_Y + 11; // 9

/**
 * Floor height at a given world XZ. PlayerController uses this to auto-
 * elevate the camera over stairs and platforms. Geometry must render
 * surfaces at exactly these heights or the player will float or clip.
 */
export function getFloorY(x: number, z: number, currentY: number = 0): number {
  // Mezzanine ramp (stairs) — always applies; this is the transition. It
  // lerps eye height from floor to mezzanine as the player walks up, which
  // is also how `currentY` rises past the "onMezzanine" threshold below.
  if (x >= STAIR_MIN_X && x <= STAIR_MAX_X && z >= STAIR_MIN_Z && z <= STAIR_MAX_Z) {
    const t = (z - STAIR_MIN_Z) / (STAIR_MAX_Z - STAIR_MIN_Z);
    return FLOOR_Y + (MZ_SURFACE_Y - FLOOR_Y) * Math.max(0, Math.min(1, t));
  }

  // Mezzanine surfaces only lift the player if they're ALREADY elevated —
  // otherwise walking underneath the back strip toward the exit doorway
  // would teleport the player onto the catwalk. `currentY` is the
  // camera's current eye height; the threshold is halfway between floor
  // eye height (0) and mezzanine eye height (MZ_SURFACE_Y + EYE_HEIGHT).
  const onMezzanine = currentY > (MZ_SURFACE_Y + EYE_HEIGHT) * 0.5;
  if (onMezzanine) {
    if (x >= MZ_L_MIN_X && x <= MZ_L_MAX_X && z >= MZ_L_MIN_Z && z <= MZ_L_MAX_Z) {
      return MZ_SURFACE_Y;
    }
    if (x >= MZ_B_MIN_X && x <= MZ_B_MAX_X && z >= MZ_B_MIN_Z && z <= MZ_B_MAX_Z) {
      return MZ_SURFACE_Y;
    }
    // Catwalk corridor segment A (mezzanine level)
    if (x >= C2A_MIN_X && x <= C2A_MAX_X && z >= C2A_MIN_Z && z <= C2A_MAX_Z) {
      return MZ_SURFACE_Y;
    }
    // Catwalk corridor segment B (mezzanine level, runs +Z after the turn)
    if (x >= C2B_MIN_X && x <= C2B_MAX_X && z >= C2B_MIN_Z && z <= C2B_MAX_Z) {
      return MZ_SURFACE_Y;
    }
  }

  // Catwalk descent stairs — always apply (transition from mezzanine to
  // final-room ground level). Linear ramp down along z.
  if (x >= S2_MIN_X && x <= S2_MAX_X && z >= S2_MIN_Z && z <= S2_MAX_Z) {
    const t = (z - S2_MIN_Z) / (S2_MAX_Z - S2_MIN_Z);
    return MZ_SURFACE_Y + (FLOOR_Y - MZ_SURFACE_Y) * Math.max(0, Math.min(1, t));
  }

  // Raised platform in the SIDE room — gentle ramps on -Z and +Z edges.
  if (x >= PLAT_MIN_X && x <= PLAT_MAX_X) {
    if (z >= PLAT_MIN_Z && z <= PLAT_MAX_Z) return PLAT_SURFACE_Y;
    if (z >= PLAT_MIN_Z - 1 && z < PLAT_MIN_Z) {
      const t = (z - (PLAT_MIN_Z - 1));
      return FLOOR_Y + (PLAT_SURFACE_Y - FLOOR_Y) * t;
    }
    if (z > PLAT_MAX_Z && z <= PLAT_MAX_Z + 1) {
      const t = 1 - (z - PLAT_MAX_Z);
      return FLOOR_Y + (PLAT_SURFACE_Y - FLOOR_Y) * t;
    }
  }
  return FLOOR_Y;
}

// Palettes — dusty industrial. Main walls are warm concrete, trim is teal
// control-room green, accents are warm sodium-light orange.
const WALL_COLOR = '#7a7064';
const WALL_DARK = '#463f38';
const FLOOR_COLOR = '#4a4239';
const CEILING_COLOR = '#2d2823';
const METAL_COLOR = '#3a4046';

const WALL_THICKNESS = 0.2;

// ── Primitives ──────────────────────────────────────────────────────

function Box({
  position,
  size,
  color = WALL_COLOR,
  roughness = 0.85,
  metalness = 0.05,
  emissive,
  emissiveIntensity = 0,
  flatShading = true,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  flatShading?: boolean;
}) {
  return (
    <mesh position={position} castShadow={false} receiveShadow={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? '#000'}
        emissiveIntensity={emissiveIntensity}
        flatShading={flatShading}
      />
    </mesh>
  );
}

function Pipe({
  from,
  to,
  radius = 0.08,
  color = '#2b2723',
}: {
  from: [number, number, number];
  to: [number, number, number];
  radius?: number;
  color?: string;
}) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const dir = end.clone().sub(start);
  const length = dir.length();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return (
    <mesh position={mid.toArray() as [number, number, number]} rotation={[euler.x, euler.y, euler.z]}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.7} flatShading />
    </mesh>
  );
}

/**
 * Trim around a Z-perpendicular doorway opening: two vertical jambs and a
 * top lintel piece, all protruding a few cm off the wall face. Use one
 * per *side* of the doorway — the `z` argument is the centre of the frame
 * in world space (typically wall-face ± ~8cm).
 */
function DoorwayFrame({
  x = 0,
  floorY: fY,
  z,
  widthHalf = DOOR_WIDTH / 2,
  openingHeight = DOORWAY_HEIGHT,
  color = '#2a1f1b',
}: {
  x?: number;
  floorY: number;
  z: number;
  widthHalf?: number;
  openingHeight?: number;
  color?: string;
}) {
  const frameDepth = 0.16;
  const jambW = 0.14;
  const lintelH = 0.14;
  return (
    <group>
      {/* Left jamb */}
      <Box
        position={[x - widthHalf - jambW / 2 + 0.02, fY + openingHeight / 2, z]}
        size={[jambW, openingHeight, frameDepth]}
        color={color}
      />
      {/* Right jamb */}
      <Box
        position={[x + widthHalf + jambW / 2 - 0.02, fY + openingHeight / 2, z]}
        size={[jambW, openingHeight, frameDepth]}
        color={color}
      />
      {/* Top lintel trim */}
      <Box
        position={[x, fY + openingHeight + lintelH / 2, z]}
        size={[widthHalf * 2 + jambW * 2, lintelH, frameDepth]}
        color={color}
      />
    </group>
  );
}

// Shader used on the rectangular beam box. Local axes after orientation:
// X = cross-section width (window width direction), Y = along beam length
// (source at -halfL, floor at +halfL), Z = cross-section depth (window
// height direction).
const BEAM_VERT = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform vec3 uHalfSize; // (halfW, halfL, halfD)
  varying vec3 vLocal;

  void main() {
    // Normalised cross-section coords, each in [-1, 1].
    float u = vLocal.x / uHalfSize.x;
    float v = vLocal.z / uHalfSize.z;
    // Radial distance from the beam axis, scaled so corners = 1 and axis = 0.
    float radial = length(vec2(u, v)) / sqrt(2.0);
    // Soft rectangular cross-section fade — edges go to zero.
    float crossAlpha = pow(1.0 - clamp(radial, 0.0, 1.0), 2.2);

    // Along-beam position. 0 = at the window, 1 = at the floor end.
    float normY = clamp((vLocal.y + uHalfSize.y) / (2.0 * uHalfSize.y), 0.0, 1.0);

    // Asymmetric bell. Fades in from zero at the window, peaks ~30% in.
    // The fade-out is wider and finishes early so that by the time the
    // beam hits the floor plane its alpha is ~0 — no visible contact line.
    float fadeIn = smoothstep(0.0, 0.28, normY);
    float fadeOut = 1.0 - smoothstep(0.5, 0.85, normY);
    float along = fadeIn * fadeOut;

    // Subtle two-octave shimmer — dust drifting through the beam.
    float s1 = sin(normY * 24.0 + uTime * 0.85);
    float s2 = sin(normY * 7.0 - uTime * 0.4);
    float shimmer = 0.88 + 0.08 * s1 + 0.05 * s2;

    float alpha = crossAlpha * along * shimmer * uIntensity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/**
 * Volumetric god ray as a STATIC rectangular box matching the window
 * opening. Local X = window width, Z = window height, Y = beam length.
 * The shader fades to zero at the cross-section edges and at both ends
 * along the beam, so the box's silhouette reads as a soft window-shaped
 * shaft of light — no billboard rotation, no camera-tracking.
 */
function GodRay({
  at,
  towards,
  sourceSize,
  color = '#fff2cf',
  intensity = 0.85,
}: {
  at: [number, number, number];
  towards: [number, number, number];
  /** Rectangular cross-section at the source (window opening) in world
      units: [width, height]. */
  sourceSize: [number, number];
  color?: string;
  intensity?: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const data = useMemo(() => {
    const start = new THREE.Vector3(at[0], at[1], at[2]);
    const end = new THREE.Vector3(towards[0], towards[1], towards[2]);
    const beamDir = end.clone().sub(start).normalize();
    const length = start.distanceTo(end);
    const mid = start.clone().add(end).multiplyScalar(0.5);

    // Static basis for the box:
    //   local +Y = beamDir (along length, source at -halfL, floor at +halfL)
    //   local +X = horizontal perpendicular (world Z projected)
    //   local +Z = vertical perpendicular (roughly world Y component)
    const localY = beamDir.clone();
    const worldZ = new THREE.Vector3(0, 0, 1);
    const localX = worldZ
      .clone()
      .sub(localY.clone().multiplyScalar(worldZ.dot(localY)))
      .normalize();
    const localZ = new THREE.Vector3().crossVectors(localX, localY).normalize();

    const rot = new THREE.Matrix4().makeBasis(localX, localY, localZ);
    const euler = new THREE.Euler().setFromRotationMatrix(rot);
    return { mid, length, euler };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at[0], at[1], at[2], towards[0], towards[1], towards[2]]);

  const halfW = sourceSize[0] / 2;
  const halfD = sourceSize[1] / 2;

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uTime: { value: 0 },
      uHalfSize: { value: new THREE.Vector3(halfW, data.length / 2, halfD) },
    }),
    [color, intensity, halfW, halfD, data.length],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uIntensity.value = intensity * (1 + Math.sin(t * 0.4) * 0.07);
    }
  });

  return (
    <mesh
      position={data.mid.toArray() as [number, number, number]}
      rotation={[data.euler.x, data.euler.y, data.euler.z]}
      renderOrder={5}
    >
      <boxGeometry args={[sourceSize[0], data.length, sourceSize[1]]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={BEAM_VERT}
        fragmentShader={BEAM_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

// ── Retro machinery cabinet ─────────────────────────────────────────

/**
 * Bulky freestanding control-console cabinet. Faces +X (designed to stand
 * against the -X wall), base sits at y=0 in local space so `position.y`
 * should be the floor y. Width along Z (along the wall), depth 0.9m off
 * the wall, height 2.2m. Covered in retro dials, switches and a glowing
 * display.
 */
function RetroCabinet({
  position,
}: {
  position: [number, number, number];
}) {
  const body = '#3a4d47';
  const bodyDark = '#2f3e39';
  const trim = '#242f2c';
  const panelInset = '#4a5d57';
  const metal = '#141414';
  const lightOn = '#fbbf24';
  const lightDim = '#1a1f2a';
  const screenGlow = '#7cf0c4';

  // Deterministic-ish "dial lit?" pattern driven by position so each
  // cabinet ends up with a slightly different pattern.
  const seed = Math.floor(position[2] * 31 + position[0] * 7);
  const isOn = (i: number) => ((seed + i * 13 + i * i * 5) % 9) < 3;

  return (
    <group position={position}>
      {/* Plinth */}
      <Box position={[0, 0.1, 0]} size={[1.0, 0.2, 2.0]} color={metal} />
      {/* Main cabinet body */}
      <Box position={[0, 1.2, 0]} size={[0.9, 2.0, 1.8]} color={body} />
      {/* Bottom dark band */}
      <Box position={[0.02, 0.45, 0]} size={[0.92, 0.2, 1.85]} color={bodyDark} />
      {/* Top cap / crown */}
      <Box position={[0, 2.28, 0]} size={[1.05, 0.14, 1.95]} color={trim} />
      {/* Corner posts (vertical trim) */}
      {[-0.85, 0.85].map((dz, i) => (
        <Box
          key={`post-${i}`}
          position={[0.02, 1.2, dz]}
          size={[0.94, 2.0, 0.08]}
          color={trim}
        />
      ))}

      {/* Recessed upper display panel on the +X face */}
      <Box position={[0.46, 1.65, 0]} size={[0.04, 0.9, 1.5]} color={panelInset} />
      {/* Mid panel with screen & label strip */}
      <Box position={[0.46, 1.0, 0]} size={[0.04, 0.45, 1.5]} color={panelInset} />
      {/* Lower vent panel */}
      <Box position={[0.46, 0.55, 0]} size={[0.04, 0.25, 1.5]} color={bodyDark} />

      {/* 3x5 dial grid on the upper panel (round dials, facing +X) */}
      {[-0.55, -0.3, -0.05, 0.2, 0.45].map((dz, zi) =>
        [1.85, 1.6, 1.35].map((dy, yi) => {
          const on = isOn(zi * 3 + yi);
          return (
            <mesh
              key={`dial-${zi}-${yi}`}
              position={[0.49, dy, dz]}
              rotation={[0, -Math.PI / 2, 0]}
            >
              <cylinderGeometry args={[0.055, 0.055, 0.025, 16]} />
              <meshStandardMaterial
                color={on ? lightOn : lightDim}
                emissive={on ? lightOn : '#000'}
                emissiveIntensity={on ? 0.55 : 0}
                flatShading
              />
            </mesh>
          );
        }),
      )}
      {/* Dial pointers (tiny black rectangle on each dial) */}
      {[-0.55, -0.3, -0.05, 0.2, 0.45].map((dz, zi) =>
        [1.85, 1.6, 1.35].map((dy, yi) => (
          <Box
            key={`ptr-${zi}-${yi}`}
            position={[0.508, dy, dz]}
            size={[0.005, 0.04, 0.004]}
            color={metal}
          />
        )),
      )}

      {/* Centred rectangular screen (CRT-ish, glows teal) */}
      <Box
        position={[0.49, 1.0, 0.55]}
        size={[0.02, 0.3, 0.4]}
        color={'#0d2524'}
        emissive={screenGlow}
        emissiveIntensity={0.5}
      />
      {/* Label strip beside the screen */}
      <Box position={[0.49, 1.0, 0.03]} size={[0.02, 0.12, 0.8]} color={'#d4c199'} />

      {/* Row of stubby toggle switches below the screen area */}
      {[-0.65, -0.45, -0.25, -0.05, 0.15, 0.35, 0.55].map((dz, i) => (
        <group key={`sw-${i}`}>
          <Box position={[0.48, 0.68, dz]} size={[0.04, 0.04, 0.06]} color={bodyDark} />
          <Box position={[0.48, 0.75, dz]} size={[0.02, 0.1, 0.02]} color={'#c5a64b'} />
        </group>
      ))}

      {/* Louvered vent slats on the lower panel */}
      {[-0.55, -0.35, -0.15, 0.05, 0.25, 0.45].map((dz, i) => (
        <Box
          key={`vent-${i}`}
          position={[0.47, 0.55, dz]}
          size={[0.02, 0.14, 0.11]}
          color={metal}
        />
      ))}

      {/* Red warning light on the top corner */}
      <mesh position={[0.49, 2.2, -0.78]} rotation={[0, -Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.08, 12]} />
        <meshStandardMaterial
          color={'#ef4444'}
          emissive={'#ef4444'}
          emissiveIntensity={0.85}
          flatShading
        />
      </mesh>
      {/* Green status LED near the screen */}
      <Box
        position={[0.505, 0.88, 0.95]}
        size={[0.01, 0.03, 0.03]}
        color={'#22c55e'}
        emissive={'#22c55e'}
        emissiveIntensity={0.9}
      />
    </group>
  );
}

// ── Room 0: starter closet ──────────────────────────────────────────

function StarterRoom() {
  const floorY = FLOOR_Y;
  const ceilY = floorY + 2 + R0_CEIL + 0.1;
  const height = ceilY - floorY;
  const midY = (floorY + ceilY) / 2;

  const w = R0_MAX_X - R0_MIN_X;
  const d = R0_MAX_Z - R0_MIN_Z;
  const cx = (R0_MAX_X + R0_MIN_X) / 2;
  const cz = (R0_MAX_Z + R0_MIN_Z) / 2;

  const aw = R0_ALCOVE_MAX_X - R0_ALCOVE_MIN_X;
  const ad = R0_ALCOVE_MAX_Z - R0_ALCOVE_MIN_Z;
  const acx = (R0_ALCOVE_MAX_X + R0_ALCOVE_MIN_X) / 2;
  const acz = (R0_ALCOVE_MAX_Z + R0_ALCOVE_MIN_Z) / 2;

  return (
    <group>
      {/* Floor (main) */}
      <Box position={[cx, floorY - WALL_THICKNESS / 2, cz]} size={[w, WALL_THICKNESS, d]} color={FLOOR_COLOR} />
      {/* Floor (alcove) */}
      <Box position={[acx, floorY - WALL_THICKNESS / 2, acz]} size={[aw, WALL_THICKNESS, ad]} color={FLOOR_COLOR} />
      {/* Ceiling (main) */}
      <Box position={[cx, ceilY + WALL_THICKNESS / 2, cz]} size={[w, WALL_THICKNESS, d]} color={CEILING_COLOR} />
      {/* Ceiling (alcove) */}
      <Box position={[acx, ceilY + WALL_THICKNESS / 2, acz]} size={[aw, WALL_THICKNESS, ad]} color={CEILING_COLOR} />

      {/* Back wall (-Z) */}
      <Box position={[cx, midY, R0_MIN_Z]} size={[w, height, WALL_THICKNESS]} color={WALL_COLOR} />
      <Box
        position={[acx, midY, R0_ALCOVE_MIN_Z]}
        size={[aw, height, WALL_THICKNESS]}
        color={WALL_COLOR}
      />

      {/* Right wall (+X) */}
      <Box position={[R0_MAX_X, midY, cz]} size={[WALL_THICKNESS, height, d]} color={WALL_COLOR} />
      {/* Left wall of main body (-X) — only exists beyond alcove */}
      <Box
        position={[R0_MIN_X, midY, (R0_ALCOVE_MAX_Z + R0_MAX_Z) / 2]}
        size={[WALL_THICKNESS, height, R0_MAX_Z - R0_ALCOVE_MAX_Z]}
        color={WALL_COLOR}
      />
      {/* Alcove far-left wall */}
      <Box
        position={[R0_ALCOVE_MIN_X, midY, acz]}
        size={[WALL_THICKNESS, height, ad]}
        color={WALL_COLOR}
      />
      {/* Alcove inside-corner wall (connects alcove to main room top) */}
      <Box
        position={[acx, midY, R0_ALCOVE_MAX_Z]}
        size={[aw, height, WALL_THICKNESS]}
        color={WALL_COLOR}
      />

      {/* Front wall (+Z, z=R0_MAX_Z=6) is shared with the main hall's -Z
          wall — main hall renders that wall + doorway, so we don't repeat
          the geometry here (would otherwise z-fight). */}

      {/* Door-0 outer frame — room-0 side of the shared wall */}
      <DoorwayFrame floorY={floorY} z={R1_MIN_Z - WALL_THICKNESS / 2 - 0.08} />

      {/* Clutter: stacked crates in alcove (alcove at x∈[-8,-6]) */}
      <Box position={[-7, floorY + 0.4, -3.5]} size={[0.8, 0.8, 0.8]} color={'#6a4a30'} />
      <Box position={[-7, floorY + 1.0, -4.3]} size={[0.7, 0.4, 0.7]} color={'#5a4128'} />
      <Box position={[-6.5, floorY + 0.25, -4.4]} size={[0.6, 0.5, 0.6]} color={'#6a4a30'} />

      {/* Shelves on the +X wall (wall at x=6) */}
      <Box position={[5.9, floorY + 0.6, -2]} size={[0.15, 0.05, 2]} color={'#3a2e22'} />
      <Box position={[5.9, floorY + 1.3, -2]} size={[0.15, 0.05, 2]} color={'#3a2e22'} />
      {/* Items on shelves */}
      <Box position={[5.6, floorY + 0.8, -2.5]} size={[0.25, 0.3, 0.25]} color={'#a87a3d'} />
      <Box position={[5.6, floorY + 0.8, -1.6]} size={[0.2, 0.35, 0.2]} color={'#5d8277'} />
      <Box position={[5.6, floorY + 1.55, -2.2]} size={[0.3, 0.25, 0.3]} color={'#8a6236'} />

      {/* Dim overhead light (warm) */}
      <pointLight position={[0, ceilY - 0.4, 0]} intensity={0.6} distance={8} color={'#ffb87a'} />
      <Box position={[0, ceilY - 0.2, 0]} size={[0.4, 0.1, 0.4]} color={'#121014'} emissive={'#ffb87a'} emissiveIntensity={0.8} />
    </group>
  );
}

// ── Main control hall (room 1) ──────────────────────────────────────

function ControlHall() {
  const floorY = FLOOR_Y;
  const eaveY = floorY + R1_CEIL;
  const peakY = eaveY + R1_PEAK_EXTRA;
  const eaveMidY = (floorY + eaveY) / 2;
  const gableMidY = (floorY + peakY) / 2;
  const gableHeight = peakY - floorY;
  const eaveHeight = eaveY - floorY;
  const w = R1_MAX_X - R1_MIN_X;
  const d = R1_MAX_Z - R1_MIN_Z;
  const cz = (R1_MAX_Z + R1_MIN_Z) / 2;

  // Pitch geometry — half-width is R1_MAX_X (room is symmetric around x=0).
  const halfW = R1_MAX_X;
  const slopeAngle = Math.atan2(R1_PEAK_EXTRA, halfW);
  const slopeLength = Math.hypot(halfW, R1_PEAK_EXTRA);

  // Fluorescent tube rows strung along the hall length.
  const tubeRows = [11, 15, 19, 23, 27, 31, 35];

  // Tall +X-wall windows, at the entrance end.
  const windowSillY = 2.0;
  const windowTopY = eaveY - 0.4;

  // Roof truss/beam positions along z.
  const trussZ = [10, 14, 18, 22, 26, 30, 34, 38];

  return (
    <group>
      {/* Floor */}
      <Box position={[0, floorY - WALL_THICKNESS / 2, cz]} size={[w, WALL_THICKNESS, d]} color={FLOOR_COLOR} />

      {/* -Z gable wall (entry from room 0) — doorway opening x∈[-1,1],
          y∈[floor, floor+DOOR_HEIGHT]. Lintel covers from door top to peak. */}
      <Box position={[-5.5, gableMidY, R1_MIN_Z]} size={[9, gableHeight, WALL_THICKNESS]} color={WALL_COLOR} />
      <Box position={[5.5, gableMidY, R1_MIN_Z]} size={[9, gableHeight, WALL_THICKNESS]} color={WALL_COLOR} />
      <Box
        position={[0, (floorY + DOORWAY_HEIGHT + peakY) / 2, R1_MIN_Z]}
        size={[2, peakY - floorY - DOORWAY_HEIGHT, WALL_THICKNESS]}
        color={WALL_COLOR}
      />

      {/* +Z gable wall (back, exit to corridor 1) — same approach. */}
      <Box position={[-5.5, gableMidY, R1_MAX_Z]} size={[9, gableHeight, WALL_THICKNESS]} color={WALL_COLOR} />
      <Box position={[5.5, gableMidY, R1_MAX_Z]} size={[9, gableHeight, WALL_THICKNESS]} color={WALL_COLOR} />
      <Box
        position={[0, (floorY + DOORWAY_HEIGHT + peakY) / 2, R1_MAX_Z]}
        size={[2, peakY - floorY - DOORWAY_HEIGHT, WALL_THICKNESS]}
        color={WALL_COLOR}
      />

      {/* Door-0 inner frame — main-hall side of the shared -Z wall */}
      <DoorwayFrame floorY={floorY} z={R1_MIN_Z + WALL_THICKNESS / 2 + 0.08} />

      {/* Door-1 outer frame — main-hall side of the +Z wall */}
      <DoorwayFrame floorY={floorY} z={R1_MAX_Z - WALL_THICKNESS / 2 - 0.08} />

      {/* +X wall (player's screen-LEFT side) — three window bays spaced
          along the length of the hall. Solid front, inter-bay pillars and
          back closure are rendered as separate wall segments. */}
      {/* Front solid section (z=6→8) */}
      <Box
        position={[R1_MAX_X, eaveMidY, 7]}
        size={[WALL_THICKNESS, eaveHeight, 2]}
        color={WALL_COLOR}
      />
      {/* Solid wall segments between and after the bays. Each spans a z
          range that falls between two bays (or after the last bay). */}
      {[
        { min: 14, max: 18 },
        { min: 24, max: 28 },
        { min: 34, max: R1_MAX_Z },
      ].map((seg, i) => (
        <Box
          key={`rwall-gap-${i}`}
          position={[R1_MAX_X, eaveMidY, (seg.min + seg.max) / 2]}
          size={[WALL_THICKNESS, eaveHeight, seg.max - seg.min]}
          color={WALL_COLOR}
        />
      ))}
      {/* Per-bay geometry: solid bands above/below the glass + piers +
          horizontal mullions. Each bay is 6m wide. */}
      {[11, 21, 31].map((centerZ) => {
        const bayW = 6;
        const bayMinZ = centerZ - bayW / 2;
        const bayMaxZ = centerZ + bayW / 2;
        return (
          <group key={`rbay-${centerZ}`}>
            {/* Lower solid band under the glass (floor → sill) */}
            <Box
              position={[R1_MAX_X, floorY + (windowSillY - floorY) / 2, centerZ]}
              size={[WALL_THICKNESS, windowSillY - floorY, bayW]}
              color={WALL_COLOR}
            />
            {/* Upper solid band above the glass (windowTop → eave) */}
            <Box
              position={[R1_MAX_X, (windowTopY + eaveY) / 2, centerZ]}
              size={[WALL_THICKNESS, eaveY - windowTopY, bayW]}
              color={WALL_COLOR}
            />
            {/* Vertical piers splitting the bay into 3 panes */}
            {[bayMinZ + 0.2, bayMinZ + 2.1, bayMinZ + 4.0, bayMaxZ - 0.1].map(
              (zpos, i) => (
                <Box
                  key={`pier-${i}`}
                  position={[R1_MAX_X - 0.05, (windowSillY + windowTopY) / 2, zpos]}
                  size={[WALL_THICKNESS + 0.1, windowTopY - windowSillY, 0.3]}
                  color={WALL_DARK}
                />
              ),
            )}
            {/* Horizontal mullions across the bay */}
            {[3.5, 5.0, 6.5].map((y, i) => (
              <Box
                key={`mullion-${i}`}
                position={[R1_MAX_X - 0.05, y, centerZ]}
                size={[WALL_THICKNESS + 0.05, 0.08, bayW]}
                color={WALL_DARK}
              />
            ))}
          </group>
        );
      })}

      {/* -X wall (player's screen-RIGHT side) — plain concrete, broken up
          to leave an opening at mezzanine level for the catwalk door that
          leads to the final room. */}
      {(() => {
        const lowerH = MZ_SURFACE_Y - floorY;
        const upperH = eaveY - MZ_SURFACE_Y;
        const lintelH = eaveY - (MZ_SURFACE_Y + DOOR_HEIGHT);
        return (
          <>
            {/* Full-length band below mezzanine */}
            <Box
              position={[R1_MIN_X, floorY + lowerH / 2, cz]}
              size={[WALL_THICKNESS, lowerH, d]}
              color={WALL_COLOR}
            />
            {/* Upper band left of the catwalk opening (most of the wall) */}
            <Box
              position={[R1_MIN_X, MZ_SURFACE_Y + upperH / 2, (R1_MIN_Z + CD_Z_MIN) / 2]}
              size={[WALL_THICKNESS, upperH, CD_Z_MIN - R1_MIN_Z]}
              color={WALL_COLOR}
            />
            {/* Upper band right of the catwalk opening (small sliver) */}
            <Box
              position={[R1_MIN_X, MZ_SURFACE_Y + upperH / 2, (CD_Z_MAX + R1_MAX_Z) / 2]}
              size={[WALL_THICKNESS, upperH, R1_MAX_Z - CD_Z_MAX]}
              color={WALL_COLOR}
            />
            {/* Lintel above the catwalk opening */}
            <Box
              position={[R1_MIN_X, MZ_SURFACE_Y + DOOR_HEIGHT + lintelH / 2, CD_Z_CENTER]}
              size={[WALL_THICKNESS, lintelH, CD_WIDTH]}
              color={WALL_COLOR}
            />
          </>
        );
      })()}

      {/* Bulky retro machinery cabinets along the -X wall */}
      <RetroCabinet position={[R1_MIN_X + 0.5, floorY, 14]} />
      <RetroCabinet position={[R1_MIN_X + 0.5, floorY, 22]} />
      <RetroCabinet position={[R1_MIN_X + 0.5, floorY, 30]} />

      {/* Doorframe trim on BOTH sides of the catwalk doorway, at
          mezzanine level. The X-perpendicular wall means the frame must
          be rotated 90° around Y compared to the Z-perpendicular
          DoorwayFrame; we inline thin box trim instead. */}
      {(() => {
        const doorCenterY = MZ_SURFACE_Y + DOOR_HEIGHT / 2;
        const doorTopY = MZ_SURFACE_Y + DOOR_HEIGHT;
        const frameDepth = 0.16;
        const jambW = 0.14;
        const lintelH = 0.14;
        const color = '#2a1f1b';
        return (
          <>
            {/* Hall-side frame (at x = R1_MIN_X + 0.18) */}
            {[-1, 1].map((side) => {
              const xIn = R1_MIN_X + WALL_THICKNESS / 2 + 0.08; // inside the hall
              const xOut = R1_MIN_X - WALL_THICKNESS / 2 - 0.08; // inside the corridor
              const zFor = (s: number) =>
                s < 0 ? CD_Z_MIN + jambW / 2 - 0.02 : CD_Z_MAX - jambW / 2 + 0.02;
              return (
                <group key={`cdjambs-${side}`}>
                  {/* Hall-side jamb */}
                  <Box
                    position={[xIn, doorCenterY, zFor(side)]}
                    size={[frameDepth, DOOR_HEIGHT, jambW]}
                    color={color}
                  />
                  {/* Corridor-side jamb */}
                  <Box
                    position={[xOut, doorCenterY, zFor(side)]}
                    size={[frameDepth, DOOR_HEIGHT, jambW]}
                    color={color}
                  />
                </group>
              );
            })}
            {/* Hall-side lintel trim */}
            <Box
              position={[
                R1_MIN_X + WALL_THICKNESS / 2 + 0.08,
                doorTopY + lintelH / 2,
                CD_Z_CENTER,
              ]}
              size={[frameDepth, lintelH, CD_WIDTH + jambW * 2]}
              color={color}
            />
            {/* Corridor-side lintel trim */}
            <Box
              position={[
                R1_MIN_X - WALL_THICKNESS / 2 - 0.08,
                doorTopY + lintelH / 2,
                CD_Z_CENTER,
              ]}
              size={[frameDepth, lintelH, CD_WIDTH + jambW * 2]}
              color={color}
            />
          </>
        );
      })()}

      {/* ── Mezzanine (L-shape on +X + back) ── */}
      {/* Left strip surface */}
      <Box
        position={[(MZ_L_MIN_X + MZ_L_MAX_X) / 2, MZ_SURFACE_Y - 0.1, (MZ_L_MIN_Z + MZ_L_MAX_Z) / 2]}
        size={[MZ_L_MAX_X - MZ_L_MIN_X, 0.2, MZ_L_MAX_Z - MZ_L_MIN_Z]}
        color={'#55483a'}
      />
      {/* Back strip surface */}
      <Box
        position={[(MZ_B_MIN_X + MZ_B_MAX_X) / 2, MZ_SURFACE_Y - 0.1, (MZ_B_MIN_Z + MZ_B_MAX_Z) / 2]}
        size={[MZ_B_MAX_X - MZ_B_MIN_X, 0.2, MZ_B_MAX_Z - MZ_B_MIN_Z]}
        color={'#55483a'}
      />

      {/* Mezzanine railing on the inner edges (where the drop is). */}
      {/* Left-strip inner edge: x = MZ_L_MIN_X, z ∈ [MZ_L_MIN_Z, MZ_B_MIN_Z] */}
      <Box
        position={[MZ_L_MIN_X - 0.02, MZ_SURFACE_Y + 0.5, (MZ_L_MIN_Z + MZ_B_MIN_Z) / 2]}
        size={[0.05, 0.05, MZ_B_MIN_Z - MZ_L_MIN_Z]}
        color={METAL_COLOR}
      />
      <Box
        position={[MZ_L_MIN_X - 0.02, MZ_SURFACE_Y + 1.0, (MZ_L_MIN_Z + MZ_B_MIN_Z) / 2]}
        size={[0.05, 0.05, MZ_B_MIN_Z - MZ_L_MIN_Z]}
        color={METAL_COLOR}
      />
      {[27, 29, 31, 33].map((z, i) => (
        <Box
          key={`lrpost-${i}`}
          position={[MZ_L_MIN_X - 0.02, MZ_SURFACE_Y + 0.55, z]}
          size={[0.05, 1.1, 0.05]}
          color={METAL_COLOR}
        />
      ))}
      {/* Back-strip inner edge: z = MZ_B_MIN_Z, x ∈ [-10, 7] */}
      <Box
        position={[(-10 + 7) / 2, MZ_SURFACE_Y + 0.5, MZ_B_MIN_Z - 0.02]}
        size={[7 - (-10), 0.05, 0.05]}
        color={METAL_COLOR}
      />
      <Box
        position={[(-10 + 7) / 2, MZ_SURFACE_Y + 1.0, MZ_B_MIN_Z - 0.02]}
        size={[7 - (-10), 0.05, 0.05]}
        color={METAL_COLOR}
      />
      {[-9, -6, -3, 0, 3, 6].map((x, i) => (
        <Box
          key={`brpost-${i}`}
          position={[x, MZ_SURFACE_Y + 0.55, MZ_B_MIN_Z - 0.02]}
          size={[0.05, 1.1, 0.05]}
          color={METAL_COLOR}
        />
      ))}

      {/* Support posts under the mezzanine */}
      {[[7, 28], [7, 32], [7, 36], [-2, 35], [4, 35], [-9, 35]].map(([x, z], i) => (
        <Box
          key={`mzpost-${i}`}
          position={[x as number, (FLOOR_Y + MZ_SURFACE_Y) / 2, z as number]}
          size={[0.15, MZ_SURFACE_Y - FLOOR_Y, 0.15]}
          color={'#2a241e'}
        />
      ))}

      {/* Stairs — 8 steps, on +X side */}
      {Array.from({ length: 8 }).map((_, i) => {
        const steps = 8;
        const stepDepth = (STAIR_MAX_Z - STAIR_MIN_Z) / steps;
        const stepRise = (MZ_SURFACE_Y - FLOOR_Y) / steps;
        const z = STAIR_MIN_Z + stepDepth * i + stepDepth / 2;
        const yTop = FLOOR_Y + stepRise * (i + 1);
        const thickness = stepRise;
        return (
          <Box
            key={`step-${i}`}
            position={[(STAIR_MIN_X + STAIR_MAX_X) / 2, yTop - thickness / 2, z]}
            size={[STAIR_MAX_X - STAIR_MIN_X, thickness, stepDepth]}
            color={'#3a2f24'}
          />
        );
      })}
      {/* Stair stringer (diagonal side beam on the open / -X edge) */}
      <mesh
        position={[STAIR_MIN_X, (FLOOR_Y + MZ_SURFACE_Y) / 2, (STAIR_MIN_Z + STAIR_MAX_Z) / 2]}
        rotation={[Math.atan2(MZ_SURFACE_Y - FLOOR_Y, STAIR_MAX_Z - STAIR_MIN_Z), 0, 0]}
      >
        <boxGeometry args={[
          0.12,
          0.3,
          Math.hypot(STAIR_MAX_Z - STAIR_MIN_Z, MZ_SURFACE_Y - FLOOR_Y),
        ]} />
        <meshStandardMaterial color={METAL_COLOR} flatShading />
      </mesh>
      {/* Stair handrail */}
      <Box
        position={[STAIR_MIN_X, (FLOOR_Y + MZ_SURFACE_Y) / 2 + 1.0, (STAIR_MIN_Z + STAIR_MAX_Z) / 2]}
        size={[0.05, 0.05, STAIR_MAX_Z - STAIR_MIN_Z]}
        color={METAL_COLOR}
      />

      {/* Large wooden desk (on the -X / screen-right foreground). */}
      <Box position={[-7, FLOOR_Y + 0.45, 11]} size={[2.2, 0.1, 1.4]} color={'#3e3227'} />
      <Box position={[-7, FLOOR_Y + 0.2, 11]} size={[2.2, 0.4, 1.4]} color={'#2e261e'} />
      <Box position={[-5.95, FLOOR_Y + 0.25, 11]} size={[0.1, 0.5, 1.4]} color={'#251e17'} />
      <Box position={[-8.05, FLOOR_Y + 0.25, 11]} size={[0.1, 0.5, 1.4]} color={'#251e17'} />
      {/* Desk drawer detail */}
      <Box position={[-7.7, FLOOR_Y + 0.25, 11.71]} size={[0.8, 0.25, 0.03]} color={'#1a140f'} />
      <Box position={[-7.9, FLOOR_Y + 0.25, 11.74]} size={[0.08, 0.04, 0.02]} color={'#6a5a3d'} />

      {/* Secondary desk and chair in the centre */}
      <Box position={[1.5, FLOOR_Y + 0.4, 22]} size={[2, 0.08, 1.2]} color={'#3e3227'} />
      <Box position={[1.5, FLOOR_Y + 0.2, 22 + 0.55]} size={[2, 0.4, 0.1]} color={'#2e261e'} />
      <Box position={[0.5, FLOOR_Y + 0.2, 22]} size={[0.1, 0.4, 1]} color={'#2e261e'} />
      <Box position={[2.5, FLOOR_Y + 0.2, 22]} size={[0.1, 0.4, 1]} color={'#2e261e'} />
      {/* Chair */}
      <Box position={[1.4, FLOOR_Y + 0.25, 23.3]} size={[0.5, 0.05, 0.5]} color={'#251a14'} />
      <Box position={[1.4, FLOOR_Y + 0.55, 23.55]} size={[0.5, 0.6, 0.05]} color={'#251a14'} />

      {/* Extra chair by the control panel */}
      <Box position={[-7, FLOOR_Y + 0.25, 18]} size={[0.5, 0.05, 0.5]} color={'#251a14'} />
      <Box position={[-7, FLOOR_Y + 0.55, 18.25]} size={[0.5, 0.6, 0.05]} color={'#251a14'} />

      {/* Scattered papers across the floor */}
      {[
        [2.5, 11], [-2, 13.5], [0.8, 17], [1.2, 20], [-1.4, 15], [3.5, 22],
        [-3, 24], [5, 14], [-6.2, 20], [-5, 27], [0, 30], [-4, 33], [6, 29],
        [2, 36], [-2, 37],
      ].map(([x, z], i) => (
        <Box key={`paper-${i}`} position={[x as number, FLOOR_Y + 0.005, z as number]} size={[0.22, 0.01, 0.3]} color={'#c9b88c'} />
      ))}

      {/* Debris boxes */}
      <Box position={[6, FLOOR_Y + 0.3, 26]} size={[0.6, 0.6, 0.6]} color={'#5c4229'} />
      <Box position={[6.2, FLOOR_Y + 0.8, 26.2]} size={[0.5, 0.4, 0.5]} color={'#6d4d34'} />
      <Box position={[-5, FLOOR_Y + 0.2, 30]} size={[0.8, 0.4, 0.5]} color={'#3e3227'} />
      <Box position={[4, FLOOR_Y + 0.15, 11]} size={[0.4, 0.3, 0.4]} color={'#5c4229'} />

      {/* ── Pitched roof (inverted-V ceiling) ── */}
      {/* +X-side slope (world +X → peak) */}
      <mesh
        position={[halfW / 2, (eaveY + peakY) / 2, cz]}
        rotation={[0, 0, -slopeAngle]}
      >
        <boxGeometry args={[slopeLength, 0.15, d]} />
        <meshStandardMaterial color={'#2a231d'} roughness={0.8} flatShading />
      </mesh>
      {/* -X-side slope (peak → world -X) */}
      <mesh
        position={[-halfW / 2, (eaveY + peakY) / 2, cz]}
        rotation={[0, 0, slopeAngle]}
      >
        <boxGeometry args={[slopeLength, 0.15, d]} />
        <meshStandardMaterial color={'#2a231d'} roughness={0.8} flatShading />
      </mesh>

      {/* Ridge beam running along the peak */}
      <Box
        position={[0, peakY - 0.15, cz]}
        size={[0.25, 0.3, d]}
        color={'#1e1812'}
      />

      {/* Roof trusses — each is a horizontal tie-beam + two angled rafters
          forming an "A" shape, visible from below against the slopes. */}
      {trussZ.map((z, i) => (
        <group key={`truss-${i}`}>
          {/* Horizontal tie-beam at eave height */}
          <Box
            position={[0, eaveY + 0.1, z]}
            size={[w - 0.4, 0.18, 0.18]}
            color={'#1e1812'}
          />
          {/* -X rafter (from world -X eave to peak) */}
          <mesh
            position={[-halfW / 2, (eaveY + peakY) / 2, z]}
            rotation={[0, 0, slopeAngle]}
          >
            <boxGeometry args={[slopeLength, 0.18, 0.18]} />
            <meshStandardMaterial color={'#1e1812'} flatShading />
          </mesh>
          {/* +X rafter */}
          <mesh
            position={[halfW / 2, (eaveY + peakY) / 2, z]}
            rotation={[0, 0, -slopeAngle]}
          >
            <boxGeometry args={[slopeLength, 0.18, 0.18]} />
            <meshStandardMaterial color={'#1e1812'} flatShading />
          </mesh>
          {/* King post (vertical from tie to peak) */}
          <Box
            position={[0, (eaveY + peakY) / 2 + 0.1, z]}
            size={[0.15, peakY - eaveY, 0.15]}
            color={'#1e1812'}
          />
        </group>
      ))}

      {/* Ceiling pipes — long runs along the length, below the eave */}
      <Pipe from={[-5, eaveY - 0.4, R1_MIN_Z]} to={[-5, eaveY - 0.4, R1_MAX_Z]} radius={0.1} color={'#2a2019'} />
      <Pipe from={[-4, eaveY - 0.25, R1_MIN_Z]} to={[-4, eaveY - 0.25, R1_MAX_Z]} radius={0.07} color={'#1f1812'} />
      <Pipe from={[5, eaveY - 0.4, R1_MIN_Z]} to={[5, eaveY - 0.4, R1_MAX_Z]} radius={0.09} color={'#2a2019'} />
      <Pipe from={[3, eaveY - 0.25, R1_MIN_Z]} to={[3, eaveY - 0.25, R1_MAX_Z]} radius={0.06} color={'#1f1812'} />

      {/* Hanging fluorescent tubes (suspended from the ridge beam) */}
      {tubeRows.map((z) => (
        <group key={`tube-${z}`}>
          <Box position={[-1, eaveY - 1.4, z]} size={[3, 0.08, 0.18]} color={'#0a0a0d'} emissive={'#fff4dc'} emissiveIntensity={0.4} />
          {/* Wires going up to ridge */}
          <Box position={[-2.4, (eaveY - 1.4 + peakY) / 2, z]} size={[0.02, peakY - (eaveY - 1.4), 0.02]} color={'#1a1a1a'} />
          <Box position={[0.4, (eaveY - 1.4 + peakY) / 2, z]} size={[0.02, peakY - (eaveY - 1.4), 0.02]} color={'#1a1a1a'} />
        </group>
      ))}

      {/* PRESERVE poster on the back wall, centred above the door */}
      <Box
        position={[0, eaveY - 2.8, R1_MAX_Z - WALL_THICKNESS / 2 - 0.02]}
        size={[1.3, 1.8, 0.03]}
        color={'#d4a766'}
        emissive={'#d4a766'}
        emissiveIntensity={0.2}
      />
      <Box
        position={[0, eaveY - 3.2, R1_MAX_Z - WALL_THICKNESS / 2 - 0.04]}
        size={[0.3, 0.7, 0.02]}
        color={'#3a2a1e'}
      />
      {/* Clock on the -X wall (upper area, near the back) */}
      <mesh position={[R1_MIN_X + WALL_THICKNESS / 2 + 0.02, eaveY - 2.0, 30]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.05, 20]} />
        <meshStandardMaterial color={'#e9e3d4'} roughness={0.6} flatShading />
      </mesh>

      {/* Warm sun lights outside each +X window bay, casting inward. */}
      {[11, 21, 31].flatMap((centerZ) =>
        [-2, 0, 2].map((dz) => (
          <pointLight
            key={`sun-${centerZ}-${dz}`}
            position={[R1_MAX_X + 1.5, (windowSillY + windowTopY) / 2, centerZ + dz]}
            intensity={2.0}
            distance={22}
            color={'#ffb070'}
          />
        )),
      )}

      {/* One god ray per window bay. Source cross-section matches the bay
          opening exactly; endpoint sits below the floor so the opaque
          floor depth-clips the tail and the beam blends smoothly into
          the concrete. */}
      {[11, 21, 31].map((centerZ) => (
        <GodRay
          key={`godray-${centerZ}`}
          at={[R1_MAX_X - 0.1, (windowSillY + windowTopY) / 2, centerZ]}
          towards={[-4, FLOOR_Y - 2, centerZ + 2.5]}
          sourceSize={[6, Math.max(0.1, windowTopY - windowSillY)]}
        />
      ))}

      {/* Dim fill across the longer hall so the back isn't pitch black. */}
      <pointLight position={[0, eaveY - 1.5, 15]} intensity={0.5} distance={18} color={'#fff0c8'} />
      <pointLight position={[0, eaveY - 1.5, 25]} intensity={0.45} distance={18} color={'#ffd9a8'} />
      <pointLight position={[0, eaveY - 1.5, 34]} intensity={0.35} distance={16} color={'#ffc187'} />
      <pointLight position={[-5, MZ_SURFACE_Y + 1, 36]} intensity={0.3} distance={8} color={'#ffc187'} />
    </group>
  );
}

// ── Corridor 1 ──────────────────────────────────────────────────────

function Corridor1() {
  const floorY = FLOOR_Y;
  const ceilY = floorY + 2 + C1_CEIL + 0.1;
  const height = ceilY - floorY;
  const midY = (floorY + ceilY) / 2;
  const w = C1_MAX_X - C1_MIN_X;
  const d = C1_MAX_Z - C1_MIN_Z;
  const cz = (C1_MAX_Z + C1_MIN_Z) / 2;

  return (
    <group>
      <Box position={[0, floorY - WALL_THICKNESS / 2, cz]} size={[w, WALL_THICKNESS, d]} color={FLOOR_COLOR} />
      <Box position={[0, ceilY + WALL_THICKNESS / 2, cz]} size={[w, WALL_THICKNESS, d]} color={CEILING_COLOR} />
      <Box position={[C1_MIN_X, midY, cz]} size={[WALL_THICKNESS, height, d]} color={WALL_DARK} />
      <Box position={[C1_MAX_X, midY, cz]} size={[WALL_THICKNESS, height, d]} color={WALL_DARK} />

      <Pipe from={[-1, ceilY - 0.25, C1_MIN_Z]} to={[-1, ceilY - 0.25, C1_MAX_Z]} radius={0.06} color={'#3a2a1e'} />
      <Pipe from={[0.8, ceilY - 0.4, C1_MIN_Z]} to={[0.8, ceilY - 0.4, C1_MAX_Z]} radius={0.05} color={'#2c2218'} />

      <pointLight position={[0, ceilY - 0.2, cz]} intensity={0.35} distance={4} color={'#ffa770'} />
      <Box position={[0, ceilY - 0.1, cz]} size={[0.3, 0.05, 0.3]} color={'#0a0a0d'} emissive={'#ffa770'} emissiveIntensity={0.6} />

      {/* Door-1 inner frame — corridor-1 side of the main hall's +Z wall */}
      <DoorwayFrame floorY={floorY} z={C1_MIN_Z + WALL_THICKNESS / 2 + 0.08} />
    </group>
  );
}

// ── Side room (formerly the final room) — behind the always-open door 1
//    on the ground floor. Just a small exploration space now. ──────────

function SideRoom() {
  const floorY = FLOOR_Y;
  const ceilY = floorY + R2_CEIL + 2; // 4m tall
  const height = ceilY - floorY;
  const midY = (floorY + ceilY) / 2;
  const w = R2_MAX_X - R2_MIN_X;
  const d = R2_MAX_Z - R2_MIN_Z;
  const cz = (R2_MAX_Z + R2_MIN_Z) / 2;

  return (
    <group>
      <Box position={[0, floorY - WALL_THICKNESS / 2, cz]} size={[w, WALL_THICKNESS, d]} color={FLOOR_COLOR} />
      <Box position={[0, ceilY + WALL_THICKNESS / 2, cz]} size={[w, WALL_THICKNESS, d]} color={CEILING_COLOR} />

      {/* Back wall (-Z, shared with corridor 1) with the doorway opening.
          Side pieces are sized so they span exactly from the room's side
          walls to the opening at x∈[-1,1] — no more extending past the
          room bounds. Opening height matches DOORWAY_HEIGHT. */}
      {(() => {
        const openingHalfW = DOOR_WIDTH / 2;
        const sideW = (w / 2) - openingHalfW;
        return (
          <>
            <Box
              position={[(R2_MIN_X - openingHalfW) / 2, midY, R2_MIN_Z]}
              size={[sideW, height, WALL_THICKNESS]}
              color={WALL_DARK}
            />
            <Box
              position={[(R2_MAX_X + openingHalfW) / 2, midY, R2_MIN_Z]}
              size={[sideW, height, WALL_THICKNESS]}
              color={WALL_DARK}
            />
            <Box
              position={[0, (floorY + DOORWAY_HEIGHT + ceilY) / 2, R2_MIN_Z]}
              size={[openingHalfW * 2, Math.max(0.01, ceilY - floorY - DOORWAY_HEIGHT), WALL_THICKNESS]}
              color={WALL_DARK}
            />
          </>
        );
      })()}

      {/* Doorframes on BOTH sides of the corridor→final-room wall */}
      <DoorwayFrame floorY={floorY} z={R2_MIN_Z - WALL_THICKNESS / 2 - 0.08} />
      <DoorwayFrame floorY={floorY} z={R2_MIN_Z + WALL_THICKNESS / 2 + 0.08} />

      {/* Solid far wall (+Z) */}
      <Box position={[0, midY, R2_MAX_Z]} size={[w, height, WALL_THICKNESS]} color={WALL_DARK} />
      <Box position={[R2_MIN_X, midY, cz]} size={[WALL_THICKNESS, height, d]} color={WALL_DARK} />
      <Box position={[R2_MAX_X, midY, cz]} size={[WALL_THICKNESS, height, d]} color={WALL_DARK} />

      {/* Central raised platform — steps on each side form the ramps */}
      <Box
        position={[0, PLAT_SURFACE_Y - 0.1, (PLAT_MIN_Z + PLAT_MAX_Z) / 2]}
        size={[PLAT_MAX_X - PLAT_MIN_X, 0.2, PLAT_MAX_Z - PLAT_MIN_Z]}
        color={'#58473a'}
      />
      {/* Ramp geometry (visual): -Z ramp */}
      <mesh
        position={[0, FLOOR_Y + 0.5, PLAT_MIN_Z - 0.5]}
        rotation={[-Math.PI / 4, 0, 0]}
      >
        <boxGeometry args={[PLAT_MAX_X - PLAT_MIN_X, 0.1, Math.SQRT2]} />
        <meshStandardMaterial color={'#58473a'} flatShading />
      </mesh>
      <mesh
        position={[0, FLOOR_Y + 0.5, PLAT_MAX_Z + 0.5]}
        rotation={[Math.PI / 4, 0, 0]}
      >
        <boxGeometry args={[PLAT_MAX_X - PLAT_MIN_X, 0.1, Math.SQRT2]} />
        <meshStandardMaterial color={'#58473a'} flatShading />
      </mesh>

      {/* Central pedestal / pillar on the raised platform (z centred on
          the actual platform, not stranded at the old z=29.5). */}
      <Box position={[0, PLAT_SURFACE_Y + 0.5, 47.5]} size={[0.6, 1, 0.6]} color={'#352a22'} />
      <Box position={[0, PLAT_SURFACE_Y + 1.05, 47.5]} size={[0.7, 0.1, 0.7]} color={'#4a3a2e'} />

      {/* Single warm emergency lamp — fixture in the ceiling above
          the raised platform. */}
      <pointLight position={[0, ceilY - 0.5, 47]} intensity={0.9} distance={10} color={'#ff784a'} />
      <Box position={[0, ceilY - 0.2, 47]} size={[0.3, 0.4, 0.3]} color={'#121014'} emissive={'#ff784a'} emissiveIntensity={0.8} />

      {/* Scattered debris on the side-room floor (z range [40, 52]). */}
      <Box position={[-3.5, FLOOR_Y + 0.25, 43]} size={[0.5, 0.5, 0.5]} color={'#5c4229'} />
      <Box position={[3.5, FLOOR_Y + 0.2, 44]} size={[0.4, 0.4, 0.4]} color={'#6d4d34'} />
      <Box position={[-2.8, FLOOR_Y + 0.1, 51]} size={[0.6, 0.2, 0.3]} color={'#3e3227'} />
    </group>
  );
}

// ── Catwalk corridor + descent stairs to the final room ──────────────

function CatwalkCorridor() {
  const ceilY = C2_CEIL_Y;
  const floor2A_Y = MZ_SURFACE_Y;
  const stepsCount = 10;

  return (
    <group>
      {/* Segment A: goes -X from the catwalk door; x∈[-22,-10], z∈[35,38] */}
      {/* Floor of A */}
      <Box
        position={[(C2A_MIN_X + C2A_MAX_X) / 2, floor2A_Y - WALL_THICKNESS / 2, (C2A_MIN_Z + C2A_MAX_Z) / 2]}
        size={[C2A_MAX_X - C2A_MIN_X, WALL_THICKNESS, C2A_MAX_Z - C2A_MIN_Z]}
        color={FLOOR_COLOR}
      />
      {/* Ceiling of A */}
      <Box
        position={[(C2A_MIN_X + C2A_MAX_X) / 2, ceilY + WALL_THICKNESS / 2, (C2A_MIN_Z + C2A_MAX_Z) / 2]}
        size={[C2A_MAX_X - C2A_MIN_X, WALL_THICKNESS, C2A_MAX_Z - C2A_MIN_Z]}
        color={CEILING_COLOR}
      />
      {/* -Z side wall of A (far side as you enter) */}
      <Box
        position={[(C2A_MIN_X + C2A_MAX_X) / 2, (floor2A_Y + ceilY) / 2, C2A_MIN_Z]}
        size={[C2A_MAX_X - C2A_MIN_X, ceilY - floor2A_Y, WALL_THICKNESS]}
        color={WALL_COLOR}
      />
      {/* +Z side wall of A — only the portion past the turn (between the
          main hall wall and where segment B takes over). */}
      <Box
        position={[(C2B_MAX_X + C2A_MAX_X) / 2, (floor2A_Y + ceilY) / 2, C2A_MAX_Z]}
        size={[C2A_MAX_X - C2B_MAX_X, ceilY - floor2A_Y, WALL_THICKNESS]}
        color={WALL_COLOR}
      />

      {/* Segment B: turns "left" (+Z), runs along -X side of the world */}
      {/* Floor */}
      <Box
        position={[(C2B_MIN_X + C2B_MAX_X) / 2, floor2A_Y - WALL_THICKNESS / 2, (C2B_MIN_Z + C2B_MAX_Z) / 2]}
        size={[C2B_MAX_X - C2B_MIN_X, WALL_THICKNESS, C2B_MAX_Z - C2B_MIN_Z]}
        color={FLOOR_COLOR}
      />
      {/* Ceiling */}
      <Box
        position={[(C2B_MIN_X + C2B_MAX_X) / 2, ceilY + WALL_THICKNESS / 2, (C2B_MIN_Z + C2B_MAX_Z) / 2]}
        size={[C2B_MAX_X - C2B_MIN_X, WALL_THICKNESS, C2B_MAX_Z - C2B_MIN_Z]}
        color={CEILING_COLOR}
      />
      {/* +X wall of B (the turn's inner wall) */}
      <Box
        position={[C2B_MAX_X, (floor2A_Y + ceilY) / 2, (C2B_MIN_Z + C2B_MAX_Z) / 2]}
        size={[WALL_THICKNESS, ceilY - floor2A_Y, C2B_MAX_Z - C2B_MIN_Z]}
        color={WALL_COLOR}
      />
      {/* -X wall spanning A and B's shared run at x=C2A_MIN_X */}
      <Box
        position={[C2A_MIN_X, (floor2A_Y + ceilY) / 2, (C2A_MIN_Z + C2B_MAX_Z) / 2]}
        size={[WALL_THICKNESS, ceilY - floor2A_Y, C2B_MAX_Z - C2A_MIN_Z]}
        color={WALL_COLOR}
      />

      {/* Wall sconces */}
      <pointLight position={[-16, ceilY - 0.3, 36.5]} intensity={0.45} distance={10} color={'#ffb070'} />
      <pointLight position={[-20.5, ceilY - 0.3, 44]} intensity={0.4} distance={10} color={'#ffb070'} />
      <pointLight position={[-20.5, ceilY - 0.3, 52]} intensity={0.4} distance={10} color={'#ffb070'} />
      {/* Light fixture visual bits */}
      <Box position={[-16, ceilY - 0.1, 36.5]} size={[0.3, 0.05, 0.3]} color={'#0a0a0d'} emissive={'#ffb070'} emissiveIntensity={0.6} />
      <Box position={[-20.5, ceilY - 0.1, 44]} size={[0.3, 0.05, 0.3]} color={'#0a0a0d'} emissive={'#ffb070'} emissiveIntensity={0.6} />
      <Box position={[-20.5, ceilY - 0.1, 52]} size={[0.3, 0.05, 0.3]} color={'#0a0a0d'} emissive={'#ffb070'} emissiveIntensity={0.6} />

      {/* Descent stairs — full corridor width, dropping from mezzanine to
          ground level over S2_MIN_Z → S2_MAX_Z. */}
      {Array.from({ length: stepsCount }).map((_, i) => {
        const stepDepth = (S2_MAX_Z - S2_MIN_Z) / stepsCount;
        const stepRise = (MZ_SURFACE_Y - FLOOR_Y) / stepsCount;
        const z = S2_MIN_Z + stepDepth * i + stepDepth / 2;
        const yTop = MZ_SURFACE_Y - stepRise * i;
        return (
          <Box
            key={`s2-step-${i}`}
            position={[(S2_MIN_X + S2_MAX_X) / 2, yTop - stepRise / 2, z]}
            size={[S2_MAX_X - S2_MIN_X, stepRise, stepDepth]}
            color={'#3a2f24'}
          />
        );
      })}
      {/* Stair handrails on both sides */}
      <Box
        position={[S2_MAX_X, (MZ_SURFACE_Y + FLOOR_Y) / 2 + 0.9, (S2_MIN_Z + S2_MAX_Z) / 2]}
        size={[0.05, 0.05, S2_MAX_Z - S2_MIN_Z]}
        color={METAL_COLOR}
      />
      <Box
        position={[S2_MIN_X, (MZ_SURFACE_Y + FLOOR_Y) / 2 + 0.9, (S2_MIN_Z + S2_MAX_Z) / 2]}
        size={[0.05, 0.05, S2_MAX_Z - S2_MIN_Z]}
        color={METAL_COLOR}
      />
      {/* Diagonal stringer along the +X (open/inner) side */}
      <mesh
        position={[S2_MAX_X, (MZ_SURFACE_Y + FLOOR_Y) / 2, (S2_MIN_Z + S2_MAX_Z) / 2]}
        rotation={[-Math.atan2(MZ_SURFACE_Y - FLOOR_Y, S2_MAX_Z - S2_MIN_Z), 0, 0]}
      >
        <boxGeometry args={[0.12, 0.3, Math.hypot(S2_MAX_Z - S2_MIN_Z, MZ_SURFACE_Y - FLOOR_Y)]} />
        <meshStandardMaterial color={METAL_COLOR} flatShading />
      </mesh>

      {/* Walls flanking the stairs — full-height slabs from the final-
          room floor up to the corridor ceiling, on both sides. */}
      {([S2_MIN_X, S2_MAX_X] as const).map((sx, i) => (
        <Box
          key={`s2-wall-${i}`}
          position={[sx, (FLOOR_Y + ceilY) / 2, (S2_MIN_Z + S2_MAX_Z) / 2]}
          size={[WALL_THICKNESS, ceilY - FLOOR_Y, S2_MAX_Z - S2_MIN_Z]}
          color={WALL_COLOR}
        />
      ))}
      {/* Stair ceiling — flat, matches corridor ceiling height */}
      <Box
        position={[(S2_MIN_X + S2_MAX_X) / 2, ceilY + WALL_THICKNESS / 2, (S2_MIN_Z + S2_MAX_Z) / 2]}
        size={[S2_MAX_X - S2_MIN_X, WALL_THICKNESS, S2_MAX_Z - S2_MIN_Z]}
        color={CEILING_COLOR}
      />
    </group>
  );
}

// ── Final room — huge spacious space past the stairs ──────────────────

function FinalRoom() {
  const floorY = FLOOR_Y;
  const ceilY = FR_CEIL_Y;
  const height = ceilY - floorY;
  const midY = (floorY + ceilY) / 2;
  const w = FR_MAX_X - FR_MIN_X;
  const d = FR_MAX_Z - FR_MIN_Z;
  const cx = (FR_MIN_X + FR_MAX_X) / 2;
  const cz = (FR_MIN_Z + FR_MAX_Z) / 2;

  // Opening where the stairs feed in (on the -Z wall at z=FR_MIN_Z)
  const openingMinX = S2_MIN_X;
  const openingMaxX = S2_MAX_X;

  return (
    <group>
      {/* Floor */}
      <Box position={[cx, floorY - WALL_THICKNESS / 2, cz]} size={[w, WALL_THICKNESS, d]} color={FLOOR_COLOR} />
      {/* Ceiling */}
      <Box position={[cx, ceilY + WALL_THICKNESS / 2, cz]} size={[w, WALL_THICKNESS, d]} color={CEILING_COLOR} />

      {/* -Z wall with opening where the stair corridor enters. The
          opening is deliberately 2.5× the standard doorway height — the
          final room is grand, so the entrance should feel that way. */}
      {(() => {
        const leftW = openingMinX - FR_MIN_X;
        const rightW = FR_MAX_X - openingMaxX;
        const leftCenter = (FR_MIN_X + openingMinX) / 2;
        const rightCenter = (openingMaxX + FR_MAX_X) / 2;
        const entranceHeight = Math.min(DOORWAY_HEIGHT * 1.4, height - 0.2);
        const lintelH = height - entranceHeight;
        const lintelY = floorY + entranceHeight + lintelH / 2;
        return (
          <>
            <Box position={[leftCenter, midY, FR_MIN_Z]} size={[leftW, height, WALL_THICKNESS]} color={WALL_COLOR} />
            <Box position={[rightCenter, midY, FR_MIN_Z]} size={[rightW, height, WALL_THICKNESS]} color={WALL_COLOR} />
            <Box
              position={[(openingMinX + openingMaxX) / 2, lintelY, FR_MIN_Z]}
              size={[openingMaxX - openingMinX, lintelH, WALL_THICKNESS]}
              color={WALL_COLOR}
            />
          </>
        );
      })()}
      {/* Doorframes on BOTH sides of the final-room entry, sized to the
          taller entrance opening. */}
      <DoorwayFrame
        floorY={floorY}
        x={(openingMinX + openingMaxX) / 2}
        z={FR_MIN_Z - WALL_THICKNESS / 2 - 0.08}
        widthHalf={(openingMaxX - openingMinX) / 2}
        openingHeight={Math.min(DOORWAY_HEIGHT * 1.4, height - 0.2)}
      />
      <DoorwayFrame
        floorY={floorY}
        x={(openingMinX + openingMaxX) / 2}
        z={FR_MIN_Z + WALL_THICKNESS / 2 + 0.08}
        widthHalf={(openingMaxX - openingMinX) / 2}
        openingHeight={Math.min(DOORWAY_HEIGHT * 1.4, height - 0.2)}
      />

      {/* +Z far wall */}
      <Box position={[cx, midY, FR_MAX_Z]} size={[w, height, WALL_THICKNESS]} color={WALL_COLOR} />
      {/* -X / +X side walls */}
      <Box position={[FR_MIN_X, midY, cz]} size={[WALL_THICKNESS, height, d]} color={WALL_COLOR} />
      <Box position={[FR_MAX_X, midY, cz]} size={[WALL_THICKNESS, height, d]} color={WALL_COLOR} />

      {/* Atmospheric lighting — a few warm pools scattered around */}
      <pointLight position={[cx - 6, ceilY - 1.0, cz]} intensity={0.8} distance={16} color={'#ffc08a'} />
      <pointLight position={[cx + 6, ceilY - 1.0, cz - 4]} intensity={0.7} distance={14} color={'#ffc08a'} />
      <pointLight position={[cx, ceilY - 1.0, cz + 6]} intensity={0.9} distance={18} color={'#ffb070'} />
      {/* Faint fill */}
      <pointLight position={[cx, ceilY - 3.0, cz]} intensity={0.35} distance={24} color={'#ffd9a8'} />

      {/* Pipes overhead + running along walls */}
      <Pipe from={[cx - 4, ceilY - 0.4, FR_MIN_Z]} to={[cx - 4, ceilY - 0.4, FR_MAX_Z]} radius={0.1} color={'#2a2019'} />
      <Pipe from={[cx + 4, ceilY - 0.4, FR_MIN_Z]} to={[cx + 4, ceilY - 0.4, FR_MAX_Z]} radius={0.1} color={'#2a2019'} />
      <Pipe from={[cx - 8, ceilY - 0.6, FR_MIN_Z]} to={[cx - 8, ceilY - 0.6, FR_MAX_Z]} radius={0.08} color={'#342a1f'} />
      <Pipe from={[cx + 8, ceilY - 0.6, FR_MIN_Z]} to={[cx + 8, ceilY - 0.6, FR_MAX_Z]} radius={0.08} color={'#342a1f'} />
      {/* Vertical pipes on -X wall */}
      <Pipe from={[FR_MIN_X + 0.3, floorY, cz - 4]} to={[FR_MIN_X + 0.3, ceilY, cz - 4]} radius={0.09} color={'#2a2019'} />
      <Pipe from={[FR_MIN_X + 0.3, floorY, cz + 4]} to={[FR_MIN_X + 0.3, ceilY, cz + 4]} radius={0.09} color={'#2a2019'} />
      {/* Horizontal pipes on -X wall */}
      <Pipe from={[FR_MIN_X + 0.3, 2.5, FR_MIN_Z]} to={[FR_MIN_X + 0.3, 2.5, FR_MAX_Z]} radius={0.1} color={'#2a2019'} />
      <Pipe from={[FR_MIN_X + 0.3, 5.5, FR_MIN_Z]} to={[FR_MIN_X + 0.3, 5.5, FR_MAX_Z]} radius={0.1} color={'#2a2019'} />
      {/* Horizontal pipes on +X wall */}
      <Pipe from={[FR_MAX_X - 0.3, 2.5, FR_MIN_Z]} to={[FR_MAX_X - 0.3, 2.5, FR_MAX_Z]} radius={0.1} color={'#2a2019'} />
      <Pipe from={[FR_MAX_X - 0.3, 5.5, FR_MIN_Z]} to={[FR_MAX_X - 0.3, 5.5, FR_MAX_Z]} radius={0.1} color={'#2a2019'} />

      {/* Valve wheels protruding from the -X wall pipes */}
      {[cz - 6, cz - 1, cz + 4].map((vz, i) => (
        <group key={`valve-${i}`} position={[FR_MIN_X + 0.6, 2.5, vz]}>
          {/* Stem */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
            <meshStandardMaterial color={'#3a2d20'} metalness={0.8} roughness={0.4} flatShading />
          </mesh>
          {/* Wheel */}
          <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.22, 0.04, 8, 18]} />
            <meshStandardMaterial color={'#7a1f1f'} metalness={0.6} roughness={0.5} flatShading />
          </mesh>
          {/* Spokes (cross) */}
          <mesh position={[0.22, 0, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.04, 0.4, 0.04]} />
            <meshStandardMaterial color={'#7a1f1f'} metalness={0.6} roughness={0.5} flatShading />
          </mesh>
          <mesh position={[0.22, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.04, 0.4, 0.04]} />
            <meshStandardMaterial color={'#7a1f1f'} metalness={0.6} roughness={0.5} flatShading />
          </mesh>
        </group>
      ))}

      {/* CRT monitor bank mounted on the +Z far wall */}
      {[cx - 6, cx - 2, cx + 2, cx + 6].map((mx, i) => {
        const screenColor = i % 2 === 0 ? '#66f0c0' : '#7ccfff';
        return (
          <group key={`crt-${i}`} position={[mx, 4.8, FR_MAX_Z - 0.4]}>
            {/* Bulky housing */}
            <mesh>
              <boxGeometry args={[1.6, 1.3, 0.7]} />
              <meshStandardMaterial color={'#bdb8a8'} roughness={0.7} flatShading />
            </mesh>
            {/* Screen bezel */}
            <mesh position={[0, 0, 0.36]}>
              <boxGeometry args={[1.3, 1.0, 0.02]} />
              <meshStandardMaterial color={'#3a3530'} roughness={0.9} flatShading />
            </mesh>
            {/* Glowing screen */}
            <mesh position={[0, 0, 0.37]}>
              <boxGeometry args={[1.15, 0.85, 0.01]} />
              <meshStandardMaterial
                color={'#0a2020'}
                emissive={screenColor}
                emissiveIntensity={0.55}
                roughness={0.6}
              />
            </mesh>
            {/* Power LED */}
            <mesh position={[-0.55, -0.55, 0.36]}>
              <boxGeometry args={[0.04, 0.04, 0.02]} />
              <meshStandardMaterial color={'#ef4444'} emissive={'#ef4444'} emissiveIntensity={0.9} />
            </mesh>
          </group>
        );
      })}

      {/* ── Central console with twin levers + commit button ─────────── */}
      {/* Console base (large angled desk) */}
      <Box position={[-22, floorY + 0.4, 74]} size={[3.4, 0.1, 1.6]} color={'#3e3227'} />
      <Box position={[-22, floorY + 0.2, 74]} size={[3.4, 0.4, 1.6]} color={'#2e261e'} />
      {/* Side panels */}
      <Box position={[-23.75, floorY + 0.25, 74]} size={[0.15, 0.5, 1.6]} color={'#1a140f'} />
      <Box position={[-20.25, floorY + 0.25, 74]} size={[0.15, 0.5, 1.6]} color={'#1a140f'} />
      {/* Angled top panel (recessed for levers + button) */}
      <Box position={[-22, floorY + 0.5, 74.4]} size={[3.2, 0.08, 0.7]} color={'#24201c'} />
      {/* Label plates next to each lever */}
      <Box position={[-22.9, floorY + 0.52, 74.75]} size={[0.7, 0.02, 0.18]} color={'#d4c199'} emissive={'#d4c199'} emissiveIntensity={0.15} />
      <Box position={[-21.1, floorY + 0.52, 74.75]} size={[0.7, 0.02, 0.18]} color={'#d4c199'} emissive={'#d4c199'} emissiveIntensity={0.15} />

      {/* Live lever visuals — rotation driven by store state */}
      <FinalLever position={[-22.9, floorY + 0.5, 74]} side="left" />
      <FinalLever position={[-21.1, floorY + 0.5, 74]} side="right" />

      {/* Commit button — glows when either lever is pulled */}
      {/* Button base sits flush on the angled-top panel surface (y≈-1.46). */}
      <FinalCommitButton position={[-22, floorY + 0.58, 74.4]} />

      {/* Note on the console (the orange flat card drawn by InteractableProp
          sits on top of the console surface). */}

      {/* Scattered debris */}
      <Box position={[cx - 8, floorY + 0.3, cz - 4]} size={[0.6, 0.6, 0.6]} color={'#5c4229'} />
      <Box position={[cx + 5, floorY + 0.2, cz + 2]} size={[0.5, 0.4, 0.8]} color={'#3e3227'} />
      <Box position={[cx - 2, floorY + 0.15, cz + 7]} size={[0.4, 0.3, 0.4]} color={'#5c4229'} />
      <Box position={[cx + 9, floorY + 0.3, cz - 6]} size={[0.8, 0.6, 0.8]} color={'#4a3a2e'} />

      {/* Scattered papers */}
      {[
        [cx - 5, cz - 2], [cx + 3, cz + 3], [cx - 1, cz - 6], [cx + 7, cz],
        [cx - 9, cz + 4], [cx, cz - 3],
      ].map(([x, z], i) => (
        <Box
          key={`fr-paper-${i}`}
          position={[x as number, FLOOR_Y + 0.005, z as number]}
          size={[0.22, 0.01, 0.3]}
          color={'#c9b88c'}
        />
      ))}
    </group>
  );
}

// ── Final lever (state-driven rotation) ──────────────────────────────

/**
 * A mechanical throw-lever sitting on the final-room console. Its handle
 * rotates forward as the player pulls it; "pulled" state lives in the
 * store (`leverLeftPulled` / `leverRightPulled`).
 */
function FinalLever({
  position,
  side,
}: {
  position: [number, number, number];
  side: 'left' | 'right';
}) {
  const handleRef = useRef<THREE.Group>(null);
  const leverLeftPulled = useGameStateStore((s) => s.leverLeftPulled);
  const leverRightPulled = useGameStateStore((s) => s.leverRightPulled);
  const pulled = side === 'left' ? leverLeftPulled : leverRightPulled;
  const targetRot = useRef(0);

  useFrame((_, dt) => {
    if (!handleRef.current) return;
    const target = pulled ? Math.PI / 3 : 0;
    targetRot.current += (target - targetRot.current) * Math.min(1, dt * 6);
    handleRef.current.rotation.x = targetRot.current;
  });

  const accent = side === 'left' ? '#fbbf24' : '#38bdf8';

  return (
    <group position={position}>
      {/* Mounting plate */}
      <mesh>
        <boxGeometry args={[0.35, 0.06, 0.35]} />
        <meshStandardMaterial color={'#2a241c'} roughness={0.8} flatShading />
      </mesh>
      {/* Hinge pin */}
      <mesh position={[0, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 10]} />
        <meshStandardMaterial color={'#1a1a1a'} metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Handle (this rotates forward on pull) */}
      <group ref={handleRef} position={[0, 0.04, 0]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.08, 0.6, 0.08]} />
          <meshStandardMaterial color={'#2a2a2a'} metalness={0.6} roughness={0.4} flatShading />
        </mesh>
        {/* Knob at the top */}
        <mesh position={[0, 0.65, 0]}>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={pulled ? 0.45 : 0.15}
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
      </group>
      {/* Status LED on the base */}
      <mesh position={[0.14, 0.03, 0.14]}>
        <boxGeometry args={[0.04, 0.02, 0.04]} />
        <meshStandardMaterial
          color={pulled ? '#22c55e' : '#7a1f1f'}
          emissive={pulled ? '#22c55e' : '#7a1f1f'}
          emissiveIntensity={0.85}
        />
      </mesh>
    </group>
  );
}

// ── Final commit button — fires the ending cutscene ─────────────────

function FinalCommitButton({
  position,
}: {
  position: [number, number, number];
}) {
  const leftPulled = useGameStateStore((s) => s.leverLeftPulled);
  const rightPulled = useGameStateStore((s) => s.leverRightPulled);
  const anyPulled = leftPulled || rightPulled;
  const btnRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!btnRef.current) return;
    const base = anyPulled ? 0.85 : 0.18;
    const pulse = anyPulled ? Math.sin(clock.elapsedTime * 3.5) * 0.15 : 0;
    btnRef.current.emissiveIntensity = base + pulse;
  });

  return (
    <group position={position}>
      {/* Base ring */}
      <mesh>
        <cylinderGeometry args={[0.2, 0.22, 0.08, 24]} />
        <meshStandardMaterial color={'#1a1a1a'} metalness={0.7} roughness={0.4} flatShading />
      </mesh>
      {/* Dome button */}
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.16, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          ref={btnRef}
          color={'#b91c1c'}
          emissive={'#ef4444'}
          emissiveIntensity={0.2}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

// ── Door (hinged, animated swing) ──────────────────────────────────

const DOOR_WIDTH = 2.0;
// 1.5× eye height so the doorway reads as a proper industrial door, not a
// crawl-through.
const DOOR_HEIGHT = EYE_HEIGHT * 1.5;
export const DOORWAY_HEIGHT = DOOR_HEIGHT;
// Swings 90° into +Z — that's away from the player approaching from -Z,
// i.e. the door opens forward into the next room, not back into the one
// they're leaving.
const DOOR_OPEN_ANGLE = -Math.PI / 2;

/**
 * A door that swings open on a hinge. `position` is the centre of the
 * doorway; the hinge sits at `position.x - DOOR_WIDTH/2`. When `open` goes
 * true the door lerps from 0 to DOOR_OPEN_ANGLE over ~0.8s. `sealed`
 * forces closed + dark / indicator-red visuals.
 */
function DoorSlab({
  position,
  sealed,
  open,
}: {
  position: [number, number, number];
  sealed: boolean;
  open: boolean;
}) {
  const pivotRef = useRef<THREE.Group>(null);
  const angleRef = useRef(0);

  useFrame((_, dt) => {
    if (!pivotRef.current) return;
    const target = open && !sealed ? DOOR_OPEN_ANGLE : 0;
    // Simple exponential lerp — looks like a door on a damper.
    angleRef.current += (target - angleRef.current) * Math.min(1, dt * 3);
    pivotRef.current.rotation.y = angleRef.current;
  });

  const hingeWorld: [number, number, number] = [
    position[0] - DOOR_WIDTH / 2,
    position[1],
    position[2],
  ];

  return (
    <group position={hingeWorld}>
      <group ref={pivotRef}>
        {/* Door mesh — offset so hinge aligns with pivot origin. */}
        <mesh position={[DOOR_WIDTH / 2, 0, 0]}>
          <boxGeometry args={[DOOR_WIDTH, DOOR_HEIGHT, 0.08]} />
          <meshStandardMaterial
            color={sealed ? '#0c0c12' : '#3a2b24'}
            roughness={0.6}
            metalness={0.35}
            flatShading
          />
        </mesh>
        {/* Centre panel detail */}
        <mesh position={[DOOR_WIDTH / 2, 0, 0.042]}>
          <boxGeometry args={[DOOR_WIDTH * 0.65, DOOR_HEIGHT * 0.65, 0.005]} />
          <meshStandardMaterial
            color={sealed ? '#080810' : '#26201a'}
            roughness={0.8}
            flatShading
          />
        </mesh>
        {/* Handle */}
        <mesh position={[DOOR_WIDTH - 0.2, -0.1, 0.08]}>
          <boxGeometry args={[0.18, 0.05, 0.05]} />
          <meshStandardMaterial color={'#8a7a4e'} roughness={0.5} metalness={0.7} flatShading />
        </mesh>
        {/* Hinge pins (visual only) */}
        <mesh position={[0.05, DOOR_HEIGHT / 2 - 0.25, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.12, 8]} />
          <meshStandardMaterial color={'#2a2520'} metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh position={[0.05, -DOOR_HEIGHT / 2 + 0.25, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.12, 8]} />
          <meshStandardMaterial color={'#2a2520'} metalness={0.8} roughness={0.4} />
        </mesh>
        {/* Small lock-status indicator */}
        <mesh position={[DOOR_WIDTH - 0.2, 0.25, 0.08]}>
          <boxGeometry args={[0.06, 0.06, 0.01]} />
          <meshStandardMaterial
            color={sealed ? '#7f1d1d' : open ? '#22c55e' : '#b91c1c'}
            emissive={sealed ? '#7f1d1d' : open ? '#22c55e' : '#b91c1c'}
            emissiveIntensity={0.9}
          />
        </mesh>
      </group>
    </group>
  );
}

// ── RoomScene ───────────────────────────────────────────────────────

export function RoomScene() {
  const solvedPuzzles = useGameStateStore((s) => s.solvedPuzzles);
  const doorsMode = useGameStateStore((s) => s.doorsMode);
  const lightingMode = useGameStateStore((s) => s.lightingMode);
  const door0Opened = useGameStateStore((s) => s.door0Opened);
  const lightScale = lightingMode === 'cut' ? 0.05 : lightingMode === 'dim' ? 0.4 : 1;

  const doorLocked: [boolean, boolean] =
    doorsMode === 'all-open'
      ? [false, false]
      : doorsMode === 'all-sealed'
      ? [true, true]
      : [isDoorLocked(0, solvedPuzzles, door0Opened), isDoorLocked(1, solvedPuzzles, door0Opened)];

  // Catwalk door — gates the actual final room. Unlocks as soon as the
  // player solves ANY puzzle (same trigger that fires the voice's
  // "machinery has come alive" interjection in App.tsx).
  const anySolved = solvedPuzzles.size >= 1;
  const catwalkLocked =
    doorsMode === 'all-sealed' ||
    (doorsMode !== 'all-open' && !anySolved);

  return (
    <group>
      <StarterRoom />
      <ControlHall />
      <Corridor1 />
      <SideRoom />
      <CatwalkCorridor />
      <FinalRoom />

      <DoorSlab
        position={[0, FLOOR_Y + DOOR_HEIGHT / 2, 6]}
        sealed={doorsMode === 'all-sealed'}
        open={!doorLocked[0]}
      />
      {/* Door 1 is now flush with the main hall's back wall (z=R1_MAX_Z)
          and connected to the doorframe trim on that wall, instead of
          floating mid-corridor. */}
      <DoorSlab
        position={[0, FLOOR_Y + DOOR_HEIGHT / 2, 38]}
        sealed={doorsMode === 'all-sealed'}
        open={!doorLocked[1]}
      />
      {/* Catwalk door — rotated 90° around Y because its wall is
          X-perpendicular (the main hall's -X wall at mezzanine height). */}
      <group
        position={[R1_MIN_X, MZ_SURFACE_Y + DOOR_HEIGHT / 2, CD_Z_CENTER]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <DoorSlab
          position={[0, 0, 0]}
          sealed={doorsMode === 'all-sealed'}
          open={!catwalkLocked}
        />
      </group>

      {/* Global lights — dim warm ambient so nothing is pitch black. */}
      <ambientLight intensity={0.35 * lightScale} color={'#c8a679'} />
      <hemisphereLight args={['#ffdcb0', '#1a1008', 0.35 * lightScale]} />

      {/* Warm directional sun angled across the hall, as if coming through
          the upper windows. */}
      <directionalLight
        position={[14, 10, 14]}
        intensity={0.9 * lightScale}
        color={'#ffc285'}
      />

      {/* Exponential warm haze for depth. */}
      <fogExp2 attach="fog" args={[lightingMode === 'cut' ? '#000' : '#3a2a1e', 0.045]} />
    </group>
  );
}
