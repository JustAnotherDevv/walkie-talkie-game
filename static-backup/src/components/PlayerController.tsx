import { useRef, useCallback, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Euler, Raycaster } from 'three';
import { useInput, Vector2 as InputVector2, requestPointerLock } from '../hooks/useInput';
import { IInteractable, FinalChoice } from '../types';
import { interactableRegistry } from '../services/interactableRegistry';
import { useGameStateStore } from '../stores/gameStateStore';

// Default values
const DEFAULT_MOVE_SPEED = 5;
const DEFAULT_LOOK_SENSITIVITY = 0.002;
const INTERACTION_RANGE = 3;

interface PlayerControllerProps {
  moveSpeed?: number;
  lookSensitivity?: number;
  onInteract?: (object: IInteractable) => void;
  onPTTStateChanged?: (active: boolean) => void;
  onFinalChoiceSelected?: (choice: FinalChoice) => void;
}

/**
 * PlayerController - First-person movement and interaction using React Three Fiber
 * Validates: Requirements 1.1
 * 
 * Features:
 * - WASD movement with configurable speed
 * - Mouse-look via useThree camera and useFrame
 * - Raycast interaction against IInteractable objects
 * - Movement enabled/disabled state
 */
export function PlayerController({
  moveSpeed = DEFAULT_MOVE_SPEED,
  lookSensitivity = DEFAULT_LOOK_SENSITIVITY,
  onInteract,
  onPTTStateChanged,
  onFinalChoiceSelected,
}: PlayerControllerProps): null {
  const { camera, gl } = useThree();

  // Player state
  const [movementEnabled, setMovementEnabled] = useState(false);
  const velocity = useRef(new Vector3());
  const rotation = useRef(new Euler(0, 0, 0, 'YXZ'));

  // Gate movement on hasStarted — the title screen blocks gameplay input.
  // Validates: Requirements 13.2, 13.3
  const hasStarted = useGameStateStore((s) => s.hasStarted);
  const gameEnded = useGameStateStore((s) => s.gameEnded);
  useEffect(() => {
    setMovementEnabled(hasStarted && !gameEnded);
  }, [hasStarted, gameEnded]);
  
  // Interaction state
  const currentInteractable = useRef<IInteractable | null>(null);
  const raycaster = useRef(new Raycaster());

  // Interactable registration lives in the shared module registry so the order
  // of child/parent useEffects cannot drop registrations.
  const registerInteractable = useCallback((obj: IInteractable) => {
    interactableRegistry.register(obj);
  }, []);

  const unregisterInteractable = useCallback((obj: IInteractable) => {
    interactableRegistry.unregister(obj);
  }, []);

  // Handle movement input
  const handleMoveInput = useCallback((input: InputVector2) => {
    if (!movementEnabled) return;
    
    // Store input for use in useFrame
    velocity.current.x = input.x * moveSpeed;
    velocity.current.z = -input.y * moveSpeed; // Negative because forward is -Z
  }, [movementEnabled, moveSpeed]);

  // Handle look input (mouse movement)
  const handleLookInput = useCallback((input: InputVector2) => {
    if (!movementEnabled) return;
    
    // Update rotation
    rotation.current.y -= input.x * lookSensitivity;
    rotation.current.x -= input.y * lookSensitivity;
    
    // Clamp vertical rotation to prevent over-rotation
    rotation.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.current.x));
  }, [movementEnabled, lookSensitivity]);

  // Handle interact key press
  const handleInteractPressed = useCallback(() => {
    if (currentInteractable.current && currentInteractable.current.isInteractable) {
      currentInteractable.current.interact();
      onInteract?.(currentInteractable.current);
    }
  }, [onInteract]);

  // Handle PTT pressed
  const handlePTTPressed = useCallback(() => {
    onPTTStateChanged?.(true);
  }, [onPTTStateChanged]);

  // Handle PTT released
  const handlePTTReleased = useCallback(() => {
    onPTTStateChanged?.(false);
  }, [onPTTStateChanged]);

  // Handle final choice selection
  const handleFinalChoiceSelected = useCallback((choice: FinalChoice) => {
    onFinalChoiceSelected?.(choice);
  }, [onFinalChoiceSelected]);

  // Set up input handling
  useInput({
    onMoveInput: handleMoveInput,
    onLookInput: handleLookInput,
    onInteractPressed: handleInteractPressed,
    onPTTPressed: handlePTTPressed,
    onPTTReleased: handlePTTReleased,
    onFinalChoiceSelected: handleFinalChoiceSelected,
  });

  // Try to interact with the nearest object in view
  const tryInteract = useCallback(() => {
    if (currentInteractable.current && currentInteractable.current.isInteractable) {
      currentInteractable.current.interact();
      onInteract?.(currentInteractable.current);
      return true;
    }
    return false;
  }, [onInteract]);

  // Find the nearest interactable in range and in view
  const findInteractableInView = useCallback((): IInteractable | null => {
    if (!camera) return null;

    const cameraPosition = camera.position.clone();
    const cameraDirection = new Vector3();
    camera.getWorldDirection(cameraDirection);

    raycaster.current.set(cameraPosition, cameraDirection);
    raycaster.current.far = INTERACTION_RANGE;

    let closestInteractable: IInteractable | null = null;
    let closestDistance = INTERACTION_RANGE;

    for (const interactable of interactableRegistry.getAll()) {
      if (!interactable.isInteractable) continue;

      const distance = cameraPosition.distanceTo(
        new Vector3(
          interactable.position.x,
          interactable.position.y,
          interactable.position.z,
        ),
      );

      if (distance <= INTERACTION_RANGE && distance < closestDistance) {
        const toInteractable = new Vector3(
          interactable.position.x - cameraPosition.x,
          interactable.position.y - cameraPosition.y,
          interactable.position.z - cameraPosition.z,
        ).normalize();

        const dot = cameraDirection.dot(toInteractable);

        if (dot > 0.5) {
          closestInteractable = interactable;
          closestDistance = distance;
        }
      }
    }

    return closestInteractable;
  }, [camera]);

  // Main update loop
  useFrame((_, delta) => {
    if (!camera) return;

    // Update camera rotation
    camera.rotation.copy(rotation.current);

    // Apply movement
    if (movementEnabled && (velocity.current.x !== 0 || velocity.current.z !== 0)) {
      const moveVector = new Vector3(velocity.current.x, 0, velocity.current.z);
      
      // Transform movement to camera's local space
      moveVector.applyQuaternion(camera.quaternion);
      moveVector.y = 0; // Keep movement on the XZ plane
      moveVector.normalize().multiplyScalar(moveSpeed * delta);

      camera.position.add(moveVector);
    }

    // Update current interactable
    currentInteractable.current = findInteractableInView();
  });

  // Request pointer lock on click
  useEffect(() => {
    const handleClick = () => {
      if (!document.pointerLockElement) {
        requestPointerLock(gl.domElement);
      }
    };

    gl.domElement.addEventListener('click', handleClick);
    return () => {
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [gl.domElement]);

  // Expose methods for external use
  useEffect(() => {
    const playerController = {
      tryInteract,
      setMovementEnabled,
      getMovementEnabled: () => movementEnabled,
      registerInteractable,
      unregisterInteractable,
    };

    // Store reference globally for access by other systems
    (window as unknown as { playerController: typeof playerController }).playerController = playerController;

    return () => {
      delete (window as unknown as { playerController?: typeof playerController }).playerController;
    };
  }, [tryInteract, movementEnabled, registerInteractable, unregisterInteractable]);

  // This component doesn't render anything
  return null;
}

/**
 * Hook to access the PlayerController from other components
 */
export function usePlayerController() {
  return (window as unknown as { playerController?: {
    tryInteract: () => boolean;
    setMovementEnabled: (enabled: boolean) => void;
    getMovementEnabled: () => boolean;
    registerInteractable: (obj: IInteractable) => void;
    unregisterInteractable: (obj: IInteractable) => void;
  } }).playerController;
}
