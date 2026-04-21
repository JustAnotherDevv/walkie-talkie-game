// Task 10.2 — real timeout + retry exercise for the mock path.
// Validates: Requirement 3.6 (ConvAI 10 s timeout → static burst + signal
// lost + retry once, terminal error on second failure).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ElevenLabsService,
  resetElevenLabsService,
} from '../services/ElevenLabsService';
import { NarrativeBeat, EndingType, SFXKey } from '../types';

const baseManifest = {
  partnerVoiceId: 'voice',
  ttsLines: {
    opening_monologue: '/audio/tts/opening_monologue.wav',
  },
  sfxClips: Object.fromEntries(
    Object.values(SFXKey).map((k) => [k, `/audio/sfx/${k}.wav`]),
  ),
  musicTracks: Object.fromEntries(
    Object.values(NarrativeBeat).map((b) => [b, `/audio/music/${b}.wav`]),
  ),
  endingStings: Object.fromEntries(
    Object.values(EndingType).map((e) => [e, `/audio/music/${e}_sting.wav`]),
  ),
};

function installFetchMock() {
  globalThis.fetch = vi.fn(((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('manifest.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(baseManifest),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['mock'], { type: 'audio/wav' })),
    } as Response);
  }) as typeof fetch);
}

beforeEach(() => {
  resetElevenLabsService();
  installFetchMock();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetElevenLabsService();
});

describe('ConvAI timeout and retry (Requirement 3.6)', () => {
  it('fires signal-lost and throws after the second failure when both attempts time out', async () => {
    const service = new ElevenLabsService('', '', 'voice');
    await service.loadAudioManifest('manifest.json');
    await service.startConversationSession();

    // Delay longer than timeout on every attempt — both original and retry fail.
    service.setMockTimingForTests({ timeoutMs: 20, simulatedDelayMs: 100 });

    const signalLost = vi.fn();
    service.onSignalLost = signalLost;
    const apiErrors: unknown[] = [];
    service.onAPIError = (err) => apiErrors.push(err);

    await expect(service.sendPTTAudio(new Blob(['x']))).rejects.toThrow(/Signal lost/);

    expect(signalLost).toHaveBeenCalledTimes(1);
    // Terminal error surfaces through the API-error channel as well.
    expect(apiErrors.some((e) => (e as { statusCode: number }).statusCode === 408)).toBe(true);
  });

  it('retry succeeds when the second attempt finishes inside the deadline', async () => {
    const service = new ElevenLabsService('', '', 'voice');
    await service.loadAudioManifest('manifest.json');
    await service.startConversationSession();

    // Patch simulateNetworkDelay: first call takes 100 ms (timeout at 20 ms),
    // subsequent calls take 5 ms (comfortably inside the deadline).
    let callCount = 0;
    const patched = vi
      .spyOn(
        service as unknown as { simulateNetworkDelay: (signal?: AbortSignal) => Promise<void> },
        'simulateNetworkDelay',
      )
      .mockImplementation(async (signal?: AbortSignal) => {
        callCount++;
        const delay = callCount === 1 ? 100 : 5;
        await new Promise<void>((resolve, reject) => {
          const id = setTimeout(resolve, delay);
          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(id);
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            },
            { once: true },
          );
        });
      });

    service.setMockTimingForTests({ timeoutMs: 20 });

    const signalLost = vi.fn();
    service.onSignalLost = signalLost;

    const blob = await service.sendPTTAudio(new Blob(['x']));
    expect(blob).toBeInstanceOf(Blob);
    // First call timed out → handleTimeout fired signalLost exactly once,
    // then the retry succeeded so no second fire.
    expect(signalLost).toHaveBeenCalledTimes(1);
    expect(patched).toHaveBeenCalledTimes(2); // original + retry
  });

  it('does not retry when the first attempt resolves in time', async () => {
    const service = new ElevenLabsService('', '', 'voice');
    await service.loadAudioManifest('manifest.json');
    await service.startConversationSession();

    service.setMockTimingForTests({ timeoutMs: 50, simulatedDelayMs: 5 });

    const signalLost = vi.fn();
    service.onSignalLost = signalLost;

    const blob = await service.sendPTTAudio(new Blob(['x']));
    expect(blob).toBeInstanceOf(Blob);
    expect(signalLost).not.toHaveBeenCalled();
  });

  it('applies the same timeout+retry contract to sendTextInput', async () => {
    const service = new ElevenLabsService('', '', 'voice');
    await service.loadAudioManifest('manifest.json');
    await service.startConversationSession();

    service.setMockTimingForTests({ timeoutMs: 20, simulatedDelayMs: 100 });

    const signalLost = vi.fn();
    service.onSignalLost = signalLost;

    await expect(service.sendTextInput('anything')).rejects.toThrow(/Signal lost/);
    expect(signalLost).toHaveBeenCalledTimes(1);
  });

  it('plays the static burst SFX when a timeout fires', async () => {
    const service = new ElevenLabsService('', '', 'voice');
    await service.loadAudioManifest('manifest.json');
    await service.startConversationSession();
    service.setMockTimingForTests({ timeoutMs: 20, simulatedDelayMs: 100 });

    const sfxSpy = vi.spyOn(service, 'playSFX');

    try {
      await service.sendPTTAudio(new Blob(['x']));
    } catch {
      // expected
    }

    // StaticBurst is played during the signal-lost recovery path.
    expect(sfxSpy).toHaveBeenCalledWith(SFXKey.StaticBurst);
  });
});
