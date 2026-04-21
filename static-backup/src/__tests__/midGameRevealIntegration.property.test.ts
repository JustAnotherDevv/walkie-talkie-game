// Feature: ai-escape-room, Property 13: Mid-game reveal triggers partner reaction
// Validates: Requirements 7.2, 7.3, 7.5
// Interacting with mid-game reveal prop triggers ConvAI response request and
// audio playback; reaction occurs before player can proceed.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  runMidGameReveal,
  MID_GAME_REVEAL_PROMPT,
  MidGameRevealEffects,
} from '../services/midGameRevealOrchestrator';
import { NarrativeBeat } from '../types';

function makeEffectsWithBlob(blobText: string) {
  const order: string[] = [];
  const prompts: string[] = [];
  const playedBlobs: Blob[] = [];
  const escalated: NarrativeBeat[] = [];
  const expectedBlob = new Blob([blobText], { type: 'audio/wav' });

  const effects: MidGameRevealEffects = {
    sendScriptedInput: async (prompt) => {
      order.push('sendScriptedInput');
      prompts.push(prompt);
      return expectedBlob;
    },
    playPartnerResponse: async (blob) => {
      order.push('playPartnerResponse');
      playedBlobs.push(blob);
    },
    playStaticBurst: async () => {
      order.push('playStaticBurst');
    },
    escalateMusic: async (beat) => {
      order.push('escalateMusic');
      escalated.push(beat);
    },
  };

  return { effects, order, prompts, playedBlobs, escalated, expectedBlob };
}

describe('Property 13: Mid-game reveal triggers partner reaction', () => {
  it('runs the full reaction sequence on every invocation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.constantFrom(...Object.values(NarrativeBeat)),
        async (blobPayload, nextBeat) => {
          const { effects, order, prompts, playedBlobs, escalated, expectedBlob } =
            makeEffectsWithBlob(blobPayload);

          const returned = await runMidGameReveal(effects, nextBeat);

          // Property 13: ConvAI is asked for a response
          expect(prompts.length).toBe(1);
          expect(prompts[0]).toBe(MID_GAME_REVEAL_PROMPT);

          // Property 13: audio playback of the partner's reaction occurs
          expect(playedBlobs.length).toBe(1);
          expect(playedBlobs[0]).toBe(expectedBlob);
          expect(returned).toBe(expectedBlob);

          // Requirement 7.5: music is escalated for the post-reveal beat
          expect(escalated.length).toBe(1);
          expect(escalated[0]).toBe(nextBeat);

          // Requirement 7.5: static burst cues the reveal
          expect(order.filter((s) => s === 'playStaticBurst').length).toBe(1);

          // Ordering: static burst → ConvAI request → music escalation → partner playback
          expect(order).toEqual([
            'playStaticBurst',
            'sendScriptedInput',
            'escalateMusic',
            'playPartnerResponse',
          ]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('reaction resolves only after playPartnerResponse completes (player cannot proceed early)', async () => {
    let partnerResolved = false;
    let resolvePartner: () => void = () => {};
    let partnerStepEntered = false;

    const effects: MidGameRevealEffects = {
      sendScriptedInput: async () => new Blob(['x'], { type: 'audio/wav' }),
      playStaticBurst: async () => {},
      escalateMusic: async () => {},
      playPartnerResponse: () =>
        new Promise<void>((r) => {
          partnerStepEntered = true;
          resolvePartner = () => {
            partnerResolved = true;
            r();
          };
        }),
    };

    const resultPromise = runMidGameReveal(effects);

    // Let the orchestrator drain past staticBurst → sendScriptedInput →
    // escalateMusic so it parks on playPartnerResponse.
    while (!partnerStepEntered) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    expect(partnerResolved).toBe(false);

    // Until we resolve the partner response, the reveal is still pending.
    let settled = false;
    resultPromise.then(() => {
      settled = true;
    });
    await new Promise<void>((r) => setTimeout(r, 5));
    expect(settled).toBe(false);

    resolvePartner();
    await resultPromise;
    expect(partnerResolved).toBe(true);
  });

  it('propagates the exact blob returned by sendScriptedInput through to playback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (payload) => {
          const blob = new Blob([payload], { type: 'audio/wav' });
          const seen: Blob[] = [];
          await runMidGameReveal({
            sendScriptedInput: async () => blob,
            playPartnerResponse: async (b) => {
              seen.push(b);
            },
            playStaticBurst: async () => {},
            escalateMusic: async () => {},
          });
          expect(seen.length).toBe(1);
          expect(seen[0]).toBe(blob);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('scripted prompt is static and non-empty across every run', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(undefined),
        async () => {
          const seen: string[] = [];
          await runMidGameReveal({
            sendScriptedInput: async (p) => {
              seen.push(p);
              return new Blob(['x']);
            },
            playPartnerResponse: async () => {},
            playStaticBurst: async () => {},
            escalateMusic: async () => {},
          });
          expect(seen[0]).toBe(MID_GAME_REVEAL_PROMPT);
          expect(seen[0].length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
