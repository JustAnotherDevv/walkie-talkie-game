import { useRef, useMemo } from 'react';
import * as THREE from 'three';
// import { Suspense } from 'react';
// import { useGLTF } from '@react-three/drei';
// import { ErrorBoundary } from './ErrorBoundary';
import type { Room } from '../types/room';
import { useRoomManager } from '../hooks/useRoomManager';

// GLB loading disabled while diagnosing the frozen-tab issue.
// const FACTORY_KIT_URL = '/models/factory_kit.glb';

// Room dimensions
const ROOM_WIDTH = 10;
const ROOM_DEPTH = 12;
const ROOM_HEIGHT = 4;
const DOOR_WIDTH = 2;
const DOOR_HEIGHT = 3;

// Colors for room materials
const WALL_COLOR = '#3a3a3a';
const FLOOR_COLOR = '#2a2a2a';
const CEILING_COLOR = '#4a4a4a';
const DOOR_LOCKED_COLOR = '#8b0000';
const DOOR_UNLOCKED_COLOR = '#228b22';

/**
 * PlaceholderRoom - A simple room geometry with walls, floor, ceiling, and a door
 * This is a placeholder until the Factory Modular Kit GLB is loaded
 * Validates: Requirements 1.2
 */
function PlaceholderRoom({
  position,
  isDoorUnlocked,
  onDoorInteract,
}: {
  room: Room;
  position: [number, number, number];
  isDoorUnlocked: boolean;
  onDoorInteract: () => void;
}) {
  const doorRef = useRef<THREE.Mesh>(null);
  
  // Door color based on lock state
  const doorColor = isDoorUnlocked ? DOOR_UNLOCKED_COLOR : DOOR_LOCKED_COLOR;
  
  // Create room geometries
  const wallGeometry = useMemo(() => new THREE.BoxGeometry(ROOM_WIDTH, ROOM_HEIGHT, 0.2), []);
  const floorGeometry = useMemo(() => new THREE.BoxGeometry(ROOM_WIDTH, 0.2, ROOM_DEPTH), []);
  const doorGeometry = useMemo(() => new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, 0.3), []);
  
  return (
    <group position={position}>
      {/* Floor */}
      <mesh geometry={floorGeometry} position={[0, -ROOM_HEIGHT / 2, 0]}>
        <meshStandardMaterial color={FLOOR_COLOR} />
      </mesh>
      
      {/* Ceiling */}
      <mesh geometry={floorGeometry} position={[0, ROOM_HEIGHT / 2, 0]}>
        <meshStandardMaterial color={CEILING_COLOR} />
      </mesh>
      
      {/* Back wall */}
      <mesh geometry={wallGeometry} position={[0, 0, -ROOM_DEPTH / 2]}>
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
      
      {/* Left wall */}
      <mesh 
        geometry={wallGeometry} 
        position={[-ROOM_WIDTH / 2, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
      
      {/* Right wall */}
      <mesh 
        geometry={wallGeometry} 
        position={[ROOM_WIDTH / 2, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
      
      {/* Front wall with door opening - left part */}
      <mesh 
        position={[-ROOM_WIDTH / 4 - DOOR_WIDTH / 4, 0, ROOM_DEPTH / 2]}
        geometry={new THREE.BoxGeometry(ROOM_WIDTH / 2 - DOOR_WIDTH / 2, ROOM_HEIGHT, 0.2)}
      >
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
      
      {/* Front wall with door opening - right part */}
      <mesh 
        position={[ROOM_WIDTH / 4 + DOOR_WIDTH / 4, 0, ROOM_DEPTH / 2]}
        geometry={new THREE.BoxGeometry(ROOM_WIDTH / 2 - DOOR_WIDTH / 2, ROOM_HEIGHT, 0.2)}
      >
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
      
      {/* Front wall with door opening - top part */}
      <mesh 
        position={[0, (ROOM_HEIGHT - DOOR_HEIGHT) / 2, ROOM_DEPTH / 2]}
        geometry={new THREE.BoxGeometry(DOOR_WIDTH, ROOM_HEIGHT - DOOR_HEIGHT, 0.2)}
      >
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
      
      {/* Door */}
      <mesh 
        ref={doorRef}
        geometry={doorGeometry}
        position={[0, -ROOM_HEIGHT / 2 + DOOR_HEIGHT / 2, ROOM_DEPTH / 2]}
        onClick={onDoorInteract}
      >
        <meshStandardMaterial color={doorColor} />
      </mesh>
      
      {/* Room label */}
      <mesh position={[0, ROOM_HEIGHT / 2 - 0.5, -ROOM_DEPTH / 2 + 0.2]}>
        <planeGeometry args={[3, 0.5]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

/*
 * FactoryKitBackdrop — temporarily disabled. Re-enable by uncommenting the
 * imports above and the <FactoryKitBackdrop /> render below.
 *
 * function FactoryKitBackdrop() {
 *   const { scene } = useGLTF(FACTORY_KIT_URL);
 *   const cloned = useMemo(() => scene.clone(), [scene]);
 *   return (
 *     <group position={[16, -4, 14]} scale={0.01} rotation={[0, -Math.PI / 2, 0]}>
 *       <primitive object={cloned} />
 *     </group>
 *   );
 * }
 */

/**
 * RoomScene - Manages all rooms in the game
 * Validates: Requirements 1.2, 1.5, 1.6, 11.3
 *
 * Assembles 3 connected rooms with doors at each transition, plus a
 * Factory Modular Kit backdrop loaded from a Draco-compressed GLB.
 * Doors are gated by puzzles — locked until puzzle is solved.
 */
export function RoomScene() {
  const { rooms, tryUnlockDoor, isDoorUnlocked } = useRoomManager();

  const handleDoorInteract = (roomIndex: number) => {
    tryUnlockDoor(roomIndex);
  };

  const getRoomPosition = (index: number): [number, number, number] => {
    const spacing = ROOM_DEPTH + 2;
    return [0, 0, index * spacing];
  };

  return (
    <group>
      {rooms.map((room, index) => (
        <PlaceholderRoom
          key={room.id}
          room={room}
          position={getRoomPosition(index)}
          isDoorUnlocked={isDoorUnlocked(index)}
          onDoorInteract={() => handleDoorInteract(index)}
        />
      ))}
      {/* <ErrorBoundary label="factory-kit-backdrop" fallback={() => null}>
        <Suspense fallback={null}>
          <FactoryKitBackdrop />
        </Suspense>
      </ErrorBoundary> */}
    </group>
  );
}

/**
 * Create initial rooms for the game
 * This function creates the default room configuration
 */
export function createInitialRooms(): Room[] {
  return [
    {
      id: 'room_1',
      displayName: 'Security Office',
      props: [],
      gatingPuzzleId: 'puzzle_01_symbol_correlation',
      isUnlocked: true, // First room is always unlocked
    },
    {
      id: 'room_2',
      displayName: 'Maintenance Bay',
      props: [],
      gatingPuzzleId: 'puzzle_02_split_combination',
      isUnlocked: false,
    },
    {
      id: 'room_3',
      displayName: 'Control Center',
      props: [],
      gatingPuzzleId: 'puzzle_03_descriptive_match',
      isUnlocked: false,
    },
  ];
}

export { ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT, DOOR_WIDTH, DOOR_HEIGHT };
