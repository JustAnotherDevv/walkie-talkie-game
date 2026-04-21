// Audit test — ConvAI agent configuration contains every contract piece
// the spec requires: partner persona, 6 trust event rules, final-choice
// decision rules, initial memory, voice id.
// Validates: Requirements 3.3, 3.7, 4.3, 6.1–6.9, 8.4, 8.7, 8.8, 8.9

import { describe, it, expect } from 'vitest';
import {
  agentConfig,
  buildFullSystemPrompt,
  PARTNER_SYSTEM_PROMPT,
  PARTNER_INITIAL_MEMORY,
  PARTNER_VOICE_ID,
  TRUST_SCORE_INSTRUCTIONS,
  FINAL_CHOICE_INSTRUCTIONS,
} from '../config/agentConfig';
import { TrustEventType } from '../types/trust';

describe('Partner system prompt coverage', () => {
  it('exists and is non-trivial', () => {
    expect(PARTNER_SYSTEM_PROMPT.length).toBeGreaterThan(200);
  });

  it('establishes the elderly-partner persona without revealing AI nature', () => {
    expect(PARTNER_SYSTEM_PROMPT.toLowerCase()).toContain('elderly');
    expect(PARTNER_SYSTEM_PROMPT.toLowerCase()).toMatch(/intercom|walkie/);
    // Must NOT start out acknowledging AI nature — Req 3.7
    expect(PARTNER_SYSTEM_PROMPT.toLowerCase()).not.toMatch(/\bi am an ai\b/);
    expect(PARTNER_SYSTEM_PROMPT.toLowerCase()).toMatch(/human|fellow/);
  });

  it('instructs the partner to rely on injected knowledge (Req 3.3)', () => {
    expect(PARTNER_SYSTEM_PROMPT.toLowerCase()).toMatch(
      /partner knowledge|knowledge segments|injected/,
    );
  });
});

describe('Trust score instructions cover every event type', () => {
  it('mentions each of the six TrustEventType values', () => {
    for (const type of Object.values(TrustEventType)) {
      expect(TRUST_SCORE_INSTRUCTIONS).toContain(type);
    }
  });

  it('assigns explicit numeric deltas to each event type', () => {
    // Each type should be followed at some point by a signed number.
    for (const type of Object.values(TrustEventType)) {
      const re = new RegExp(`${type}[^\\n]*[-+]?\\d`);
      expect(TRUST_SCORE_INSTRUCTIONS).toMatch(re);
    }
  });

  it('specifies low / mid / high trust thresholds (Req 6.7, 6.8, 8.7, 8.8)', () => {
    expect(TRUST_SCORE_INSTRUCTIONS.toLowerCase()).toMatch(/trust_low|<= ?-?\d/);
    expect(TRUST_SCORE_INSTRUCTIONS.toLowerCase()).toMatch(/trust_high|>= ?\d/);
    expect(TRUST_SCORE_INSTRUCTIONS.toLowerCase()).toMatch(/trust_mid|between|mid/);
  });

  it('declares trust does not reset between rooms (Req 6.9)', () => {
    expect(TRUST_SCORE_INSTRUCTIONS.toLowerCase()).toMatch(/carry|never reset|across/);
  });

  it('instructs wariness behaviour at low trust without explicit distrust (Req 6.8)', () => {
    expect(TRUST_SCORE_INSTRUCTIONS.toLowerCase()).toContain('wariness');
    expect(TRUST_SCORE_INSTRUCTIONS.toLowerCase()).toMatch(/never explicitly state distrust/);
  });
});

describe('Final-choice decision rules', () => {
  it('requires the agent to call the finalChoice client tool', () => {
    expect(FINAL_CHOICE_INSTRUCTIONS).toContain('finalChoice');
    expect(FINAL_CHOICE_INSTRUCTIONS).toMatch(/"Cooperate"/);
    expect(FINAL_CHOICE_INSTRUCTIONS).toMatch(/"Defect"/);
  });

  it('biases on trust tier (Req 8.7, 8.8, 8.9)', () => {
    expect(FINAL_CHOICE_INSTRUCTIONS.toLowerCase()).toMatch(/low.*defect/);
    expect(FINAL_CHOICE_INSTRUCTIONS.toLowerCase()).toMatch(/high.*cooperate/);
    expect(FINAL_CHOICE_INSTRUCTIONS.toLowerCase()).toMatch(/mid|contextual/);
  });

  it('forbids scripted or random choices (Req 8.4)', () => {
    expect(FINAL_CHOICE_INSTRUCTIONS.toLowerCase()).toMatch(/not scripted|reasoned/);
    expect(FINAL_CHOICE_INSTRUCTIONS.toLowerCase()).toMatch(/not.*random|not scripted or random/);
  });
});

describe('Partner initial memory and voice identity', () => {
  it('initial memory is a non-empty string (Req 3.3, 5.1)', () => {
    expect(PARTNER_INITIAL_MEMORY.length).toBeGreaterThan(50);
  });

  it('voice id exists, is a string, and matches the agentConfig field', () => {
    expect(typeof PARTNER_VOICE_ID).toBe('string');
    expect(PARTNER_VOICE_ID.length).toBeGreaterThan(0);
    expect(agentConfig.voiceId).toBe(PARTNER_VOICE_ID);
  });
});

describe('buildFullSystemPrompt composition', () => {
  it('concatenates persona, trust rules, and final choice rules', () => {
    const full = buildFullSystemPrompt();
    expect(full).toContain(PARTNER_SYSTEM_PROMPT);
    expect(full).toContain(TRUST_SCORE_INSTRUCTIONS);
    expect(full).toContain(FINAL_CHOICE_INSTRUCTIONS);
    // Sections preserve order: persona → trust → final choice.
    const personaIdx = full.indexOf(PARTNER_SYSTEM_PROMPT);
    const trustIdx = full.indexOf(TRUST_SCORE_INSTRUCTIONS);
    const choiceIdx = full.indexOf(FINAL_CHOICE_INSTRUCTIONS);
    expect(personaIdx).toBeGreaterThanOrEqual(0);
    expect(trustIdx).toBeGreaterThan(personaIdx);
    expect(choiceIdx).toBeGreaterThan(trustIdx);
  });

  it('accepts an overridden config and still composes safely', () => {
    const full = buildFullSystemPrompt({
      systemPrompt: 'CUSTOM_PERSONA',
      initialMemory: 'x',
      voiceId: 'x',
      trustScoreInstructions: 'CUSTOM_TRUST',
      finalChoiceInstructions: 'CUSTOM_CHOICE',
    });
    expect(full).toContain('CUSTOM_PERSONA');
    expect(full).toContain('CUSTOM_TRUST');
    expect(full).toContain('CUSTOM_CHOICE');
  });
});
