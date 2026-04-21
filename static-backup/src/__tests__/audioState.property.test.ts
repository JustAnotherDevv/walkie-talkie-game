// Feature: ai-escape-room, Property 17: Audio state matches narrative beat
// Validates: Requirements 12.3, 12.4, 12.5, 12.6
// For any narrative beat, AudioManager music volume and ambient config match
// the expected state for that beat.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  BEAT_AUDIO_CONFIG,
  getMusicVolumeForBeat,
  isMusicEnabledForBeat,
} from '../hooks/useAudioManager';
import { NarrativeBeat } from '../types/narrative';

describe('Property 17: Audio state matches narrative beat', () => {
  it('every beat has a config entry with bounded volumes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(NarrativeBeat)),
        (beat) => {
          const cfg = BEAT_AUDIO_CONFIG[beat];
          expect(cfg).toBeDefined();
          expect(cfg.musicVolume).toBeGreaterThanOrEqual(0);
          expect(cfg.musicVolume).toBeLessThanOrEqual(1);
          expect(cfg.ambientVolume).toBeGreaterThanOrEqual(0);
          expect(cfg.ambientVolume).toBeLessThanOrEqual(1);
          expect(typeof cfg.musicEnabled).toBe('boolean');
          // Guard: if volume > 0, music must be enabled
          if (cfg.musicVolume > 0) {
            expect(cfg.musicEnabled).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Opening and Rising keep music absent (volume 0 or disabled)', () => {
    for (const beat of [NarrativeBeat.Opening, NarrativeBeat.Rising]) {
      const cfg = BEAT_AUDIO_CONFIG[beat];
      expect(cfg.musicVolume).toBe(0);
      expect(cfg.musicEnabled).toBe(false);
      expect(isMusicEnabledForBeat(beat)).toBe(false);
    }
  });

  it('Midpoint introduces music at low volume', () => {
    const vol = getMusicVolumeForBeat(NarrativeBeat.Midpoint);
    expect(vol).toBeGreaterThan(0);
    expect(vol).toBeLessThan(getMusicVolumeForBeat(NarrativeBeat.Climb));
    expect(isMusicEnabledForBeat(NarrativeBeat.Midpoint)).toBe(true);
  });

  it('Climb escalates above Midpoint, Climax peaks above Climb', () => {
    const mid = getMusicVolumeForBeat(NarrativeBeat.Midpoint);
    const climb = getMusicVolumeForBeat(NarrativeBeat.Climb);
    const climax = getMusicVolumeForBeat(NarrativeBeat.Climax);
    expect(climb).toBeGreaterThan(mid);
    expect(climax).toBeGreaterThan(climb);
  });

  it('volume is monotonically non-decreasing across the linear beat order', () => {
    const order = [
      NarrativeBeat.Opening,
      NarrativeBeat.Rising,
      NarrativeBeat.Midpoint,
      NarrativeBeat.Climb,
      NarrativeBeat.Climax,
    ];
    for (let i = 1; i < order.length; i++) {
      expect(getMusicVolumeForBeat(order[i])).toBeGreaterThanOrEqual(
        getMusicVolumeForBeat(order[i - 1]),
      );
    }
  });

  it('ambient volume is the same stable bed across all beats', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(NarrativeBeat)),
        (beat) => {
          expect(BEAT_AUDIO_CONFIG[beat].ambientVolume).toBe(
            BEAT_AUDIO_CONFIG[NarrativeBeat.Opening].ambientVolume,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
