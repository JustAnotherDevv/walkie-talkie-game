import { useRef, useCallback, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Euler, Raycaster } from 'three';
import { useInput, Vector2 as InputVector2, requestPointerLock } from '../hooks/useInput';
import { IInteractable, FinalChoice } from '../types';

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
  const [movementEnabled, setMovementEnabled] = useState(true);
  const velocity = useRef(new Vector3());
  const rotation = useRef(new Euler(0, 0, 0, 'YXZ'));
  
  // Interaction state
  const currentInteractable = useRef<IInteractable | null>(null);
  const raycaster = useRef(new Raycaster());
  
  // Track interactable objects in the scene
  const interactables = useRef<Set<IInteractable>>(new Set());

  // Register an interactable object
  const registerInteractable = useCallback((obj: IInteractable) => {
    interactables.current.add(obj);
  }, []);

  // Unregister an interactable object
  const unregisterInteractable = useCallback((obj: IInteractable) => {
    interactables.current.delete(obj);
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

    // Get camera position and direction
    const cameraPosition = camera.position.clone();
    const cameraDirection = new Vector3();
    camera.getWorldDirection(cameraDirection);

    // Set up raycaster
    raycaster.current.set(cameraPosition, cameraDirection);
    raycaster.current.far = INTERACTION_RANGE;

    // Find all objects in the scene that the ray hits
    const scene = gl.domElement.parentElement?.querySelector('canvas')?.parentElement;
    if (!scene) return null;

    // Check each registered interactable
    let closestInteractable: IInteractable | null = null;
    let closestDistance = INTERACTION_RANGE;

    for (const interactable of interactables.current) {
      if (!interactable.isInteractable) continue;

      const distance = cameraPosition.distanceTo(
        new Vector3(
          interactable.position.x,
          interactable.position.y,
          interactable.position.z
        )
      );

      if (distance <= INTERACTION_RANGE && distance < closestDistance) {
        // Check if the interactable is in front of the camera
        const toInteractable = new Vector3(
          interactable.position.x - cameraPosition.x,
          interactable.position.y - cameraPosition.y,
          interactable.position.z - cameraPosition.z
        ).normalize();

        const dot = cameraDirection.dot(toInteractable);
        
        // Only consider objects in front of the camera (dot > 0.5 for ~60 degree cone)
        if (dot > 0.5) {
          closestInteractable = interactable;
          closestDistance = distance;
        }
      }
    }

    return closestInteractable;
  }, [camera, gl.domElement]);

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
