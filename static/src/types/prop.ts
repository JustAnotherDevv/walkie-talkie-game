// Prop interface - interactable objects in rooms
// Validates: Requirements 1.3, 1.4, 7.1
export interface Prop {
  id: string
  interactionPrompt: string
  revealContent: string             // text/symbol/number shown on interact
  isMidGameRevealProp: boolean      // true for the "only one exit code" note
  puzzleId: string | null           // which puzzle this prop contributes to
}
