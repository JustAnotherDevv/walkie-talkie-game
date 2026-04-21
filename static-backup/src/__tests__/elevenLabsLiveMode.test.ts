// Live-mode branching tests for ElevenLabsService.
// The real @elevenlabs/client WebSocket is not opened here — we stub the
// live adapter with a spy and verify the service routes calls to it when
// an agent id is configured, and does NOT when the agent id is a placeholder.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ElevenLabsService, resetElevenLabsService } from '../services/ElevenLabsService';
import {
  ElevenLabsLiveAdapter,
  getLiveAdapter,
  resetLiveAdapter,
  type LiveAdapterCallbacks,
} from '../services/elevenLabsLiveAdapter';
import { FinalChoice } from '../types';

interface SpyRecord {
  sendUser: string[];
  sendContextual: string[];
  unmute: number;
  mute: number;
  started: Array<{ agentId: string }>;
  ended: number;
}

/**
 * Captured reference to the callbacks the service registers on the adapter,
 * so tests can fire onPartnerSpeakingChange / onFinalChoiceTool events.
 */
let capturedCallbacks: LiveAdapterCallbacks | null = null;

function installAdapterSpy(record: SpyRecord): ElevenLabsLiveAdapter {
  const adapter = getLiveAdapter();

  const originalSet = adapter.setCallbacks.bind(adapter);
  (adapter as unknown as { setCallbacks: typeof adapter.setCallbacks }).setCallbacks = (
    callbacks,
  ) => {
    capturedCallbacks = callbacks;
    originalSet(callbacks);
  };

  (adapter as unknown as {
    startSession: (c: { agentId: string }) => Promise<void>;
  }).startSession = async (c) => {
    record.started.push(c);
  };
  (adapter as unknown as { sendUserMessage: (t: string) => void }).sendUserMessage = (t) => {
    record.sendUser.push(t);
  };
  (adapter as unknown as { sendContextualUpdate: (t: string) => void }).sendContextualUpdate = (
    t,
  ) => {
    record.sendContextual.push(t);
  };
  (adapter as unknown as { unmuteMic: () => void }).unmuteMic = () => {
    record.unmute++;
  };
  (adapter as unknown as { muteMic: () => void }).muteMic = () => {
    record.mute++;
  };
  (adapter as unknown as { endSession: () => Promise<void> }).endSession = async () => {
    record.ended++;
  };

  return adapter;
}

function blankSpyRecord(): SpyRecord {
  return {
    sendUser: [],
    sendContextual: [],
    unmute: 0,
    mute: 0,
    started: [],
    ended: 0,
  };
}

beforeEach(() => {
  resetElevenLabsService();
  resetLiveAdapter();
  capturedCallbacks = null;
});

afterEach(() => {
  resetElevenLabsService();
  resetLiveAdapter();
  capturedCallbacks = null;
});

describe('ElevenLabsService live-mode detection', () => {
  it('stays in mock mode when agentId is empty', () => {
    const service = new ElevenLabsService('', '', 'voice');
    expect(service.isLiveMode()).toBe(false);
    expect(service.getLiveAdapter()).toBeNull();
  });

  it('stays in mock mode when agentId is a known placeholder', () => {
    const service = new ElevenLabsService('k', 'partner-voice-placeholder', 'voice');
    expect(service.isLiveMode()).toBe(false);
  });

  it('enters live mode when a real-looking agentId is supplied', () => {
    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    expect(service.isLiveMode()).toBe(true);
    expect(service.getLiveAdapter()).not.toBeNull();
  });
});

describe('ElevenLabsService live-mode routing', () => {
  it('startConversationSession calls the adapter and pushes initial memory through sendContextualUpdate', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    await service.startConversationSession('PROMPT', 'MEMORY');

    expect(record.started.length).toBe(1);
    expect(record.started[0].agentId).toBe('agent_abc123');
    expect(record.sendContextual.some((m) => m.includes('MEMORY'))).toBe(true);
  });

  it('sendTextInput forwards to sendUserMessage and returns a sentinel blob', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    await service.startConversationSession();

    const out = await service.sendTextInput('I found the red cylinder.');
    expect(record.sendUser).toEqual(['I found the red cylinder.']);
    expect(out).toBeInstanceOf(Blob);
  });

  it('startMicStreaming/stopMicStreaming unmute/mute via the adapter', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    await service.startConversationSession();

    service.startMicStreaming();
    service.startMicStreaming();
    service.stopMicStreaming();

    expect(record.unmute).toBe(2);
    expect(record.mute).toBe(1);
  });

  it('injectTrustEvent and injectAgentContext also fire sendContextualUpdate in live mode', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    await service.startConversationSession();

    service.injectTrustEvent('[TRUST_EVENT] LiedAboutPuzzle');
    service.injectAgentContext('[PARTNER_KNOWLEDGE] something');

    expect(record.sendContextual.some((m) => m.includes('[TRUST_EVENT]'))).toBe(true);
    expect(record.sendContextual.some((m) => m.includes('[PARTNER_KNOWLEDGE]'))).toBe(true);
  });

  it('endSession tears down the adapter session', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    await service.startConversationSession();
    await service.endSession();

    expect(record.ended).toBe(1);
  });
});

describe('Live partner-speaking callback fan-out', () => {
  it('forwards onPartnerSpeakingChange from the adapter through to the service consumer', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    const seen: boolean[] = [];
    service.onPartnerSpeakingChange = (speaking) => seen.push(speaking);

    await service.startConversationSession();

    // Simulate the SDK firing onModeChange through the adapter's callbacks
    capturedCallbacks?.onPartnerSpeakingChange?.(true);
    capturedCallbacks?.onPartnerSpeakingChange?.(false);

    expect(seen).toEqual([true, false]);
  });
});

describe('Live getFinalChoice — clientTools.finalChoice integration', () => {
  it('resolves to Cooperate when the agent calls finalChoice with "Cooperate"', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    await service.startConversationSession();

    const pending = service.getFinalChoice('Trust score: 5; high trust.');

    // Simulate the agent invoking the tool from the other end.
    await Promise.resolve(); // let getFinalChoice reach the await
    capturedCallbacks?.onFinalChoiceTool?.({ choice: 'Cooperate' });

    const choice = await pending;
    expect(choice).toBe(FinalChoice.Cooperate);
  });

  it('resolves to Defect when the agent calls finalChoice with "defect" (case/whitespace insensitive)', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    await service.startConversationSession();

    const pending = service.getFinalChoice('Trust score: -5; low trust.');
    await Promise.resolve();
    capturedCallbacks?.onFinalChoiceTool?.({ choice: '  DEFECT  ' });

    const choice = await pending;
    expect(choice).toBe(FinalChoice.Defect);
  });

  it('sends the tool-call instructions to the agent when requesting a final choice', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
    await service.startConversationSession();

    const pending = service.getFinalChoice('Trust score: 0; mid trust.');
    await Promise.resolve();

    expect(record.sendContextual.some((m) => m.includes('[FINAL_CHOICE_REQUEST]'))).toBe(true);
    expect(record.sendUser.some((m) => m.toLowerCase().includes('finalchoice'))).toBe(true);

    capturedCallbacks?.onFinalChoiceTool?.({ choice: 'Cooperate' });
    await pending;
  });

  it('falls back to the cue-based decision if the agent never calls the tool before the timeout', async () => {
    vi.useFakeTimers();
    try {
      const record = blankSpyRecord();
      installAdapterSpy(record);

      const service = new ElevenLabsService('k', 'agent_abc123', 'voice');
      await service.startConversationSession();

      // Strong "low trust" cues so the fallback resolves to Defect.
      const pending = service.getFinalChoice(
        'Trust score: -9; low trust; lied; contradict; broke promise.',
      );

      await vi.advanceTimersByTimeAsync(31_000);
      const choice = await pending;

      expect(choice).toBe(FinalChoice.Defect);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ElevenLabsService mock-mode preserves existing behaviour', () => {
  it('does not invoke the adapter for mock agent id', async () => {
    const record = blankSpyRecord();
    installAdapterSpy(record);

    const service = new ElevenLabsService('', '', 'voice');
    await service.startConversationSession('PROMPT', 'MEMORY');
    service.startMicStreaming();
    service.stopMicStreaming();
    service.injectAgentContext('[x]');
    await service.sendTextInput('hi');

    expect(record.started.length).toBe(0);
    expect(record.unmute).toBe(0);
    expect(record.mute).toBe(0);
    expect(record.sendUser.length).toBe(0);
    expect(record.sendContextual.length).toBe(0);
  });
});
