import { useMemo } from 'react';

const ROOM_WIDTH = 10;
const ROOM_DEPTH = 12;
const ROOM_HEIGHT = 4;
const DOOR_WIDTH = 2.4;
const DOOR_HEIGHT = 3;
const WALL_THICKNESS = 0.2;
const GAP = 2; // open corridor length between rooms
const ROOM_SPACING = ROOM_DEPTH + GAP;

const WALL_COLOR = '#4a4d5b';
const FLOOR_COLOR = '#2a2c35';
const CEILING_COLOR = '#32343e';

function Wall({
  position,
  size,
  color = WALL_COLOR,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
    </mesh>
  );
}

/**
 * A single room. Has a floor, ceiling, two full side walls, a back wall,
 * and a front wall with a door opening cut out. The opening faces +Z.
 */
function Room({
  index,
  accent,
  hasDoorFront,
  hasDoorBack,
}: {
  index: number;
  accent: string;
  hasDoorFront: boolean;
  hasDoorBack: boolean;
}) {
  const z = index * ROOM_SPACING;

  return (
    <group position={[0, 0, z]}>
      {/* Floor */}
      <Wall
        position={[0, -ROOM_HEIGHT / 2, 0]}
        size={[ROOM_WIDTH, WALL_THICKNESS, ROOM_DEPTH]}
        color={FLOOR_COLOR}
      />
      {/* Ceiling */}
      <Wall
        position={[0, ROOM_HEIGHT / 2, 0]}
        size={[ROOM_WIDTH, WALL_THICKNESS, ROOM_DEPTH]}
        color={CEILING_COLOR}
      />
      {/* Left wall */}
      <Wall
        position={[-ROOM_WIDTH / 2, 0, 0]}
        size={[WALL_THICKNESS, ROOM_HEIGHT, ROOM_DEPTH]}
      />
      {/* Right wall */}
      <Wall
        position={[ROOM_WIDTH / 2, 0, 0]}
        size={[WALL_THICKNESS, ROOM_HEIGHT, ROOM_DEPTH]}
      />

      {/* Back wall (-Z): either solid or with door opening */}
      {hasDoorBack ? (
        <>
          <Wall
            position={[
              -(ROOM_WIDTH / 4 + DOOR_WIDTH / 4),
              0,
              -ROOM_DEPTH / 2,
            ]}
            size={[ROOM_WIDTH / 2 - DOOR_WIDTH / 2, ROOM_HEIGHT, WALL_THICKNESS]}
          />
          <Wall
            position={[
              ROOM_WIDTH / 4 + DOOR_WIDTH / 4,
              0,
              -ROOM_DEPTH / 2,
            ]}
            size={[ROOM_WIDTH / 2 - DOOR_WIDTH / 2, ROOM_HEIGHT, WALL_THICKNESS]}
          />
          <Wall
            position={[0, (ROOM_HEIGHT - DOOR_HEIGHT) / 2 + DOOR_HEIGHT / 2, -ROOM_DEPTH / 2]}
            size={[DOOR_WIDTH, ROOM_HEIGHT - DOOR_HEIGHT, WALL_THICKNESS]}
          />
        </>
      ) : (
        <Wall
          position={[0, 0, -ROOM_DEPTH / 2]}
          size={[ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS]}
        />
      )}

      {/* Front wall (+Z): either solid or with door opening */}
      {hasDoorFront ? (
        <>
          <Wall
            position={[
              -(ROOM_WIDTH / 4 + DOOR_WIDTH / 4),
              0,
              ROOM_DEPTH / 2,
            ]}
            size={[ROOM_WIDTH / 2 - DOOR_WIDTH / 2, ROOM_HEIGHT, WALL_THICKNESS]}
          />
          <Wall
            position={[
              ROOM_WIDTH / 4 + DOOR_WIDTH / 4,
              0,
              ROOM_DEPTH / 2,
            ]}
            size={[ROOM_WIDTH / 2 - DOOR_WIDTH / 2, ROOM_HEIGHT, WALL_THICKNESS]}
          />
          <Wall
            position={[0, (ROOM_HEIGHT - DOOR_HEIGHT) / 2 + DOOR_HEIGHT / 2, ROOM_DEPTH / 2]}
            size={[DOOR_WIDTH, ROOM_HEIGHT - DOOR_HEIGHT, WALL_THICKNESS]}
          />
        </>
      ) : (
        <Wall
          position={[0, 0, ROOM_DEPTH / 2]}
          size={[ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS]}
        />
      )}

      {/* Room accent light marker — small emissive cube in the centre */}
      <mesh position={[0, -ROOM_HEIGHT / 2 + 0.4, 0]}>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  );
}

/**
 * 3 rooms connected linearly along +Z. Room 0 starts at z=0 (where the
 * camera spawns), rooms 1 and 2 follow. Doorways are always open in this
 * round; gating logic returns in a later round.
 */
export function RoomScene() {
  // Recreate room geometries only once.
  const rooms = useMemo(
    () => [
      { accent: '#38bdf8', hasDoorFront: true, hasDoorBack: false },
      { accent: '#fbbf24', hasDoorFront: true, hasDoorBack: true },
      { accent: '#ef4444', hasDoorFront: false, hasDoorBack: true },
    ],
    [],
  );

  return (
    <group>
      {rooms.map((r, i) => (
        <Room
          key={i}
          index={i}
          accent={r.accent}
          hasDoorFront={r.hasDoorFront}
          hasDoorBack={r.hasDoorBack}
        />
      ))}

      {/* Point lights sit at the centre of each room (brighter + wider). */}
      {rooms.map((r, i) => (
        <pointLight
          key={`light-${i}`}
          position={[0, 1.2, i * ROOM_SPACING]}
          intensity={1.4}
          distance={16}
          color={r.accent}
          castShadow
        />
      ))}

      {/* Global ambient — raised so walls and floor read clearly. */}
      <ambientLight intensity={0.7} />
      {/* Hemisphere light adds a soft top-down gradient for depth. */}
      <hemisphereLight args={['#cbd5e1', '#1a1b22', 0.5]} />

      {/* Fog hides distant walls for atmosphere. */}
      <fog attach="fog" args={['#05050a', 10, 60]} />
    </group>
  );
}
