import { Vector3 } from 'three';

export interface RegisteredInteractable {
  id: string;
  position: Vector3;
  prompt: string;
  onInteract: () => void;
  /** Used to hide the interaction prompt once the prop has been read. */
  isRevealed: () => boolean;
}

/**
 * Module-level singleton so PlayerController and InteractableProp can talk
 * without prop-drilling or zustand subscriptions on every frame.
 */
class InteractableRegistry {
  private items = new Map<string, RegisteredInteractable>();

  register(item: RegisteredInteractable): void {
    this.items.set(item.id, item);
  }

  unregister(id: string): void {
    this.items.delete(id);
  }

  get(id: string): RegisteredInteractable | undefined {
    return this.items.get(id);
  }

  getAll(): RegisteredInteractable[] {
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
  }
}

export const interactableRegistry = new InteractableRegistry();
