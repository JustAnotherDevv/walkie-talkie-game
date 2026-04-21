import type { IInteractable } from '../types';

/**
 * Shared registry of IInteractable handles in the current scene.
 *
 * Using a module-level singleton avoids useEffect ordering races between
 * PlayerController (raycaster) and InteractableProp components (registration),
 * which is otherwise dependent on mount order when routing through `window`.
 */
class InteractableRegistry {
  private readonly interactables = new Set<IInteractable>();

  register(obj: IInteractable): void {
    this.interactables.add(obj);
  }

  unregister(obj: IInteractable): void {
    this.interactables.delete(obj);
  }

  getAll(): IInteractable[] {
    return Array.from(this.interactables);
  }

  clear(): void {
    this.interactables.clear();
  }
}

export const interactableRegistry = new InteractableRegistry();
