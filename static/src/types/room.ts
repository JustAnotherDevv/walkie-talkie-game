import type { Prop } from './prop';

// Room interface - discrete 3D space with interactable props
// Validates: Requirements 1.2, 1.5
export interface Room {
  id: string
  displayName: string
  props: Prop[]
  gatingPuzzleId: string            // puzzle that must be solved to enter next room
  isUnlocked: boolean
}
