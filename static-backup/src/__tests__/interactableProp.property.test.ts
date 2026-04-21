// Feature: ai-escape-room, Property 1: Interaction prompt visibility
// Validates: Requirements 1.3
// For any prop and player position, prompt visible iff player within interaction range

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Vector3 } from 'three';
import { isPropInteractable } from '../components/InteractableProp';

// Interaction range constant (must match implementation)
const INTERACTION_RANGE = 3;

describe('Property 1: Interaction prompt visibility', () => {
  it('prompt should be visible if and only if player is within interaction range', () => {
    fc.assert(
      fc.property(
        // Generator for prop position (arbitrary 3D coordinates)
        fc.record({
          x: fc.float({ min: -100, max: 100 }),
          y: fc.float({ min: -100, max: 100 }),
          z: fc.float({ min: -100, max: 100 }),
        }),
        // Generator for player position (arbitrary 3D coordinates)
        fc.record({
          x: fc.float({ min: -100, max: 100 }),
          y: fc.float({ min: -100, max: 100 }),
          z: fc.float({ min: -100, max: 100 }),
        }),
        (propPos, playerPos) => {
          // Create Vector3 instances
          const propPosition: [number, number, number] = [propPos.x, propPos.y, propPos.z];
          const playerPosition = new Vector3(playerPos.x, playerPos.y, playerPos.z);
          
          // Calculate actual distance
          const propVector = new Vector3(propPos.x, propPos.y, propPos.z);
          const distance = playerPosition.distanceTo(propVector);
          
          // Check if prop is interactable
          const isInteractable = isPropInteractable(propPosition, playerPosition, INTERACTION_RANGE);
          
          // Property: isInteractable should be true iff distance <= range
          const shouldBeInteractable = distance <= INTERACTION_RANGE;
          
          expect(isInteractable).toBe(shouldBeInteractable);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('prompt should be visible when player is exactly at interaction range boundary', () => {
    fc.assert(
      fc.property(
        // Generator for prop position at origin
        fc.constant({ x: 0, y: 0, z: 0 }),
        // Generator for player position at exactly INTERACTION_RANGE distance
        fc.float({ min: Math.fround(0.1), max: Math.fround(6.2) }), // theta: 0 to ~2*PI
        fc.float({ min: Math.fround(-3.1), max: Math.fround(3.1) }), // phi: -PI to PI
        (propPos, theta, phi) => {
          // Skip if NaN values
          fc.pre(!isNaN(theta) && !isNaN(phi));
          
          // Place player at exactly INTERACTION_RANGE distance in a random direction
          // Use a small epsilon to account for floating-point precision
          const epsilon = 0.0001;
          const range = INTERACTION_RANGE - epsilon;
          const playerX = propPos.x + range * Math.sin(theta) * Math.cos(phi);
          const playerY = propPos.y + range * Math.sin(theta) * Math.sin(phi);
          const playerZ = propPos.z + range * Math.cos(theta);
          
          // Skip if NaN results
          fc.pre(!isNaN(playerX) && !isNaN(playerY) && !isNaN(playerZ));
          
          const propPosition: [number, number, number] = [propPos.x, propPos.y, propPos.z];
          const playerPosition = new Vector3(playerX, playerY, playerZ);
          
          // At the boundary (with epsilon), should be interactable
          const isInteractable = isPropInteractable(propPosition, playerPosition, INTERACTION_RANGE);
          
          expect(isInteractable).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('prompt should not be visible when player is just outside interaction range', () => {
    fc.assert(
      fc.property(
        // Generator for prop position at origin
        fc.constant({ x: 0, y: 0, z: 0 }),
        // Generator for player position just outside INTERACTION_RANGE
        fc.float({ min: 0, max: Math.fround(2 * Math.PI) }),
        fc.float({ min: Math.fround(-Math.PI), max: Math.fround(Math.PI) }),
        fc.float({ min: Math.fround(0.01), max: 10 }), // Extra distance beyond range
        (propPos, theta, phi, extraDistance) => {
          const range = INTERACTION_RANGE + extraDistance;
          
          // Place player just outside the range
          const playerX = propPos.x + range * Math.sin(theta) * Math.cos(phi);
          const playerY = propPos.y + range * Math.sin(theta) * Math.sin(phi);
          const playerZ = propPos.z + range * Math.cos(theta);
          
          const propPosition: [number, number, number] = [propPos.x, propPos.y, propPos.z];
          const playerPosition = new Vector3(playerX, playerY, playerZ);
          
          // Outside the range, should not be interactable
          const isInteractable = isPropInteractable(propPosition, playerPosition, INTERACTION_RANGE);
          
          expect(isInteractable).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
