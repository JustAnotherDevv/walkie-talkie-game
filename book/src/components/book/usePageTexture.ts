import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

// Resolution of the offscreen canvas. Higher = crisper text on large meshes,
// but costs GPU upload bandwidth. 1024x1536 keeps an ~1:1.5 (paperback-ish)
// aspect and looks sharp at viewport sizes up to ~full-screen.
export const PAGE_TEX_WIDTH = 1024
export const PAGE_TEX_HEIGHT = 1536

type Options = {
  /** Force a redraw when this value changes. */
  version?: number
}

/**
 * Converts a live DOM subtree into a three.js CanvasTexture.
 *
 * - Prefers the experimental HTML-in-Canvas API (`drawElementImage`) when
 *   available — this gives pixel-perfect browser rendering including real
 *   font metrics, sub-pixel AA, and accessibility tree pass-through.
 * - Falls back to the `<foreignObject>` SVG trick in an <img> so the book
 *   still renders on browsers without the flag.
 *
 * The returned texture is stable; only its internal canvas bitmap is replaced.
 */
export function useHtmlPageTexture(
  elementRef: React.RefObject<HTMLElement | null>,
  { version = 0 }: Options = {},
) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = PAGE_TEX_WIDTH
    c.height = PAGE_TEX_HEIGHT
    return c
  }, [])

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }, [canvas])

  const [ready, setReady] = useState(false)
  const rafRef = useRef(0)

  useEffect(() => {
    const el = elementRef.current
    if (!el) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let cancelled = false

    const drawViaHtmlInCanvas = () => {
      if (typeof ctx.drawElementImage !== "function") return false
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#f5efe0"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // The spec draws at the element's natural size; we've sized the source
      // div to match PAGE_TEX_WIDTH × PAGE_TEX_HEIGHT in CSS.
      ctx.drawElementImage(el, 0, 0, canvas.width, canvas.height)
      texture.needsUpdate = true
      return true
    }

    const drawViaSvgFallback = async () => {
      // Serialize the element into an <img src="data:image/svg+xml,...">.
      // This is a single-frame snapshot — good enough for a static page.
      const width = canvas.width
      const height = canvas.height
      const cloned = el.cloneNode(true) as HTMLElement
      cloned.style.width = `${width}px`
      cloned.style.height = `${height}px`

      const xhtml = new XMLSerializer().serializeToString(cloned)
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        `<foreignObject width="100%" height="100%">` +
        `<div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div>` +
        `</foreignObject></svg>`

      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      const img = new Image()
      img.crossOrigin = "anonymous"
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = (e) => reject(e)
        img.src = url
      })
      if (cancelled) return
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = "#f5efe0"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      texture.needsUpdate = true
    }

    const render = async () => {
      try {
        if (!drawViaHtmlInCanvas()) {
          await drawViaSvgFallback()
        }
        if (!cancelled) setReady(true)
      } catch (err) {
        console.warn("[book] page texture render failed", err)
      }
    }

    // Keep the native HTML-in-Canvas texture live across animation frames so
    // dynamic content (counters, inputs) shows up. The SVG fallback renders
    // once per `version` bump instead.
    if (typeof ctx.drawElementImage === "function") {
      const loop = () => {
        if (cancelled) return
        drawViaHtmlInCanvas()
        rafRef.current = requestAnimationFrame(loop)
      }
      render().then(() => {
        if (!cancelled) loop()
      })
    } else {
      render()
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
    }
  }, [elementRef, canvas, texture, version])

  return { texture, ready }
}
