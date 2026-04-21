import { getElevenLabsService, initializeElevenLabsService, ElevenLabsService } from './ElevenLabsService';
import { getTrustEventReporter, TrustEventMessage } from './TrustEventReporter';

/**
 * Wire TrustEventReporter → ElevenLabsService so every reported trust event
 * is injected into the ConvAI agent's conversation context.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
export function wireTrustEventsToConvAI(service?: ElevenLabsService): void {
  const reporter = getTrustEventReporter();
  const target = service ?? getElevenLabsService();
  reporter.setReportCallback((message: TrustEventMessage) => {
    target.injectTrustEvent(message.message);
  });
}

/**
 * One-call startup that initialises the ElevenLabsService singleton with the
 * provided credentials and wires the trust event pipeline. Safe to call once
 * from App bootstrap.
 */
export function initializeServices(config: {
  apiKey: string;
  agentId: string;
  partnerVoiceId: string;
}): ElevenLabsService {
  const service = initializeElevenLabsService(
    config.apiKey,
    config.agentId,
    config.partnerVoiceId,
  );
  wireTrustEventsToConvAI(service);
  return service;
}
