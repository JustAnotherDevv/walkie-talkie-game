// Types for the experimental WICG HTML-in-Canvas API.
// Spec: https://wicg.github.io/html-in-canvas/
// Chrome flag: chrome://flags/#canvas-draw-element
export {}

declare global {
  interface CanvasRenderingContext2D {
    drawElementImage?: (
      element: Element,
      dx: number,
      dy: number,
      dWidth?: number,
      dHeight?: number,
    ) => void
  }

  interface WebGLRenderingContextBase {
    texElementImage2D?: (
      target: number,
      level: number,
      internalFormat: number,
      format: number,
      type: number,
      element: Element,
    ) => void
  }

  interface HTMLElementEventMap {
    paint: Event
  }
}
