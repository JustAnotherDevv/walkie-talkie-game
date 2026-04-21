import { NarrativeBeat } from '../types';

/**
 * Scripted prompt sent to ConvAI when the Player discovers the mid-game
 * reveal memo. It is an internal event, not player speech — so we push it
 * into the agent via the text-input channel and let the partner react
 * in character.
 * Validates: Requirements 7.2, 7.3
 */
export const MID_GAME_REVEAL_PROMPT =
  '[SCRIPTED_EVENT] The player has just read a classified memo claiming only one exit code will work. They have not said anything aloud yet. React, in character, with a short sentence that acknowledges what they discovered and asks them what they intend to do. Do not confirm or deny whether the memo is true.';

export interface MidGameRevealEffects {
  /**
   * Sends the scripted prompt to ConvAI as a text turn and returns the
   * partner's audio response. In App wiring, this is
   * elevenLabsService.sendTextInput(prompt).
   */
  sendScriptedInput: (prompt: string) => Promise<Blob>;

  /**
   * Plays the partner response through the filtered intercom.
   * In App wiring, this is audioManager.playPartnerResponse(blob).
   */
  playPartnerResponse: (blob: Blob) => Promise<void> | void;

  /**
   * Plays the short static burst that precedes the partner's reaction.
   * Validates: Requirement 7.5 (static escalation cue)
   */
  playStaticBurst: () => Promise<void> | void;

  /**
   * Escalates the music bed for the post-reveal narrative beat. Usually
   * wired to audioManager.setMusicBeat(NarrativeBeat.Midpoint) so the
   * tension score enters on the reveal.
   * Validates: Requirement 7.5 (music escalation)
   */
  escalateMusic: (beat: NarrativeBeat) => Promise<void> | void;
}

/**
 * Run the post-mid-game-reveal partner reaction end-to-end.
 *
 * Ordering contract (Property 13, Req 7.2): the returned promise only
 * resolves after the partner response has been handed to the intercom.
 * This is what "reaction occurs before the player can proceed" means
 * at the service layer — callers can await this before re-enabling
 * interaction.
 *
 * Validates: Requirements 7.2, 7.3, 7.5
 */
export async function runMidGameReveal(
  effects: MidGameRevealEffects,
  nextBeat: NarrativeBeat = NarrativeBeat.Midpoint,
): Promise<Blob> {
  await effects.playStaticBurst();
  const response = await effects.sendScriptedInput(MID_GAME_REVEAL_PROMPT);
  await effects.escalateMusic(nextBeat);
  await effects.playPartnerResponse(response);
  return response;
}
