import { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { IInteractable, Prop } from '../types';
import { useGameStateStore } from '../stores/gameStateStore';

// Default interaction range (must match PlayerController)
const INTERACTION_RANGE = 3;

interface InteractablePropProps extends Prop {
  position: [number, number, number];
  onInteracted?: () => void;
}

/**
 * InteractableProp - R3F component for interactable objects
 * Validates: Requirements 1.3, 1.4
 * 
 * Features:
 * - Stores revealContent, isMidGameRevealProp, puzzleId
 * - interact() reveals content and fires event
 * - isInteractable returns true when player is within range
 */
export function InteractableProp({
  id,
  position,
  interactionPrompt,
  revealContent,
  isMidGameRevealProp,
  puzzleId,
  onInteracted,
}: InteractablePropProps): null {
  // State
  const isRevealed = useRef(false);
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Get game state store actions
  const triggerMidGameReveal = useGameStateStore(state => state.triggerMidGameReveal);
  
  // Track player position for range check
  const playerInRange = useRef(false);

  // Create the IInteractable implementation
  const interactable: IInteractable = useRef({
    interact: () => {
      if (isRevealed.current) return;
      
      // Reveal the content
      isRevealed.current = true;
      
      // Fire the onInteracted callback
      onInteracted?.();
      
      // If this is the mid-game reveal prop, trigger the event
      if (isMidGameRevealProp) {
        triggerMidGameReveal();
      }
      
      console.log(`[InteractableProp] ${id} interacted. Content: ${revealContent}`);
    },
    
    getPromptText: () => interactionPrompt,
    
    get isInteractable() {
      return playerInRange.current && !isRevealed.current;
    },
    
    position: {
      x: position[0],
      y: position[1],
      z: position[2],
    },
  }).current;

  // Check if player is in range each frame
  useFrame(({ camera }) => {
    if (!camera) return;
    
    const propPosition = new Vector3(position[0], position[1], position[2]);
    const playerPosition = camera.position.clone();
    const distance = playerPosition.distanceTo(propPosition);
    
    playerInRange.current = distance <= INTERACTION_RANGE;
  });

  // Register with the global player controller
  useEffect(() => {
    const playerController = (window as unknown as { 
      playerController?: { 
        registerInteractable: (obj: IInteractable) => void;
        unregisterInteractable: (obj: IInteractable) => void;
      } 
    }).playerController;

    if (playerController) {
      playerController.registerInteractable(interactable);
      
      return () => {
        playerController.unregisterInteractable(interactable);
      };
    }
  }, [interactable]);

  // This component doesn't render anything - the visual representation
  // should be handled by a separate mesh component or child component
  return null;
}

/**
 * Helper function to check if a prop is interactable based on player position
 */
export function isPropInteractable(
  propPosition: [number, number, number],
  playerPosition: Vector3,
  range: number = INTERACTION_RANGE
): boolean {
  const propPos = new Vector3(propPosition[0], propPosition[1], propPosition[2]);
  return playerPosition.distanceTo(propPos) <= range;
}
