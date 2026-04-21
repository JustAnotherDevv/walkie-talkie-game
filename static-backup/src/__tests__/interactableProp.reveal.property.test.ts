// Feature: ai-escape-room, Property 2: Prop reveal on interact
// Validates: Requirements 1.4
// For any interactable prop in default state, interact() yields non-empty reveal content

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createPropInteractable } from '../components/InteractableProp';

describe('Property 2: Prop reveal on interact', () => {
  it('interact() on any prop in default state should yield non-empty reveal content', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          interactionPrompt: fc.string({ minLength: 1, maxLength: 100 }),
          revealContent: fc.string({ minLength: 1, maxLength: 500 }),
          isMidGameRevealProp: fc.boolean(),
          x: fc.float({ min: -100, max: 100, noNaN: true }),
          y: fc.float({ min: -100, max: 100, noNaN: true }),
          z: fc.float({ min: -100, max: 100, noNaN: true }),
        }),
        (propData) => {
          let revealedContent: string | null = null;
          let midGameFired = false;

          const handle = createPropInteractable({
            id: propData.id,
            interactionPrompt: propData.interactionPrompt,
            revealContent: propData.revealContent,
            isMidGameRevealProp: propData.isMidGameRevealProp,
            position: { x: propData.x, y: propData.y, z: propData.z },
            onInteracted: (content) => {
              revealedContent = content;
            },
            onMidGameReveal: () => {
              midGameFired = true;
            },
          });

          // Initially unrevealed
          expect(handle.isRevealed()).toBe(false);

          // In range to be interactable, interact
          handle.setPlayerInRange(true);
          expect(handle.isInteractable).toBe(true);

          handle.interact();

          // After interaction
          expect(handle.isRevealed()).toBe(true);
          expect(revealedContent).not.toBeNull();
          expect(revealedContent!.length).toBeGreaterThan(0);
          expect(revealedContent).toBe(propData.revealContent);
          expect(handle.getRevealContent().length).toBeGreaterThan(0);

          if (propData.isMidGameRevealProp) {
            expect(midGameFired).toBe(true);
          } else {
            expect(midGameFired).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('interact() should be idempotent - calling multiple times should not change state', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          interactionPrompt: fc.string({ minLength: 1, maxLength: 100 }),
          revealContent: fc.string({ minLength: 1, maxLength: 500 }),
          isMidGameRevealProp: fc.boolean(),
        }),
        (propData) => {
          let callCount = 0;

          const handle = createPropInteractable({
            id: propData.id,
            interactionPrompt: propData.interactionPrompt,
            revealContent: propData.revealContent,
            isMidGameRevealProp: propData.isMidGameRevealProp,
            position: { x: 0, y: 0, z: 0 },
            onInteracted: () => {
              callCount++;
            },
          });

          handle.setPlayerInRange(true);
          handle.interact();
          handle.interact();
          handle.interact();

          expect(handle.isRevealed()).toBe(true);
          expect(handle.getRevealContent()).toBe(propData.revealContent);
          expect(callCount).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('getPromptText() should always return the configured prompt', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          interactionPrompt: fc.string({ minLength: 1, maxLength: 100 }),
          revealContent: fc.string({ minLength: 1, maxLength: 500 }),
        }),
        (propData) => {
          const handle = createPropInteractable({
            id: propData.id,
            interactionPrompt: propData.interactionPrompt,
            revealContent: propData.revealContent,
            isMidGameRevealProp: false,
            position: { x: 0, y: 0, z: 0 },
          });

          expect(handle.getPromptText()).toBe(propData.interactionPrompt);

          handle.setPlayerInRange(true);
          handle.interact();
          expect(handle.getPromptText()).toBe(propData.interactionPrompt);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isInteractable should require both in-range AND not-yet-revealed', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (inRange, shouldInteract) => {
          const handle = createPropInteractable({
            id: 'test',
            interactionPrompt: 'prompt',
            revealContent: 'content',
            isMidGameRevealProp: false,
            position: { x: 0, y: 0, z: 0 },
          });

          handle.setPlayerInRange(inRange);
          if (shouldInteract && inRange) {
            handle.interact();
          }

          const expectedInteractable = inRange && !handle.isRevealed();
          expect(handle.isInteractable).toBe(expectedInteractable);
        },
      ),
      { numRuns: 100 },
    );
  });
});
