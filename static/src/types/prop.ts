export interface Prop {
  id: string;
  /** Room index (0, 1, 2) — used by the registry for sanity checks. */
  roomIndex: number;
  /** World position [x, y, z]. */
  position: [number, number, number];
  /** Short label shown in the HUD interaction prompt. */
  interactionPrompt: string;
  /** Long body text shown in the reveal panel. */
  revealContent: string;
  /** Puzzle this prop contributes to (null for mid-game reveal). */
  puzzleId: string | null;
  /** True for the classified memo that triggers the Midpoint reveal. */
  isMidGameRevealProp?: boolean;
  /** Visual accent colour. */
  color?: string;
}
