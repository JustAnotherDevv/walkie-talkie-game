// Interface for all interactable objects in the game
// Validates: Requirements 1.3, 1.4

/**
 * IInteractable - Interface that all interactable props must implement
 * Used by PlayerController to detect and interact with objects
 */
export interface IInteractable {
  /**
   * Called when the player interacts with this object
   * Should reveal content, trigger events, etc.
   */
  interact(): void;

  /**
   * Returns the text to display in the interaction prompt UI
   * Should be a short, contextual description (e.g., "Examine note", "Open door")
   */
  getPromptText(): string;

  /**
   * Whether this object can currently be interacted with
   * Can be used to disable interaction based on game state
   */
  readonly isInteractable: boolean;

  /**
   * The 3D position of this interactable in world space
   * Used for distance checks by the PlayerController
   */
  readonly position: { x: number; y: number; z: number };
}
