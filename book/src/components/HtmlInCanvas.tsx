import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  width?: number
  height?: number
  className?: string
  children: React.ReactNode
}

function useHtmlInCanvasSupport() {
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => {
    const c = document.createElement("canvas")
    const ctx = c.getContext("2d")
    setSupported(!!ctx && typeof ctx.drawElementImage === "function")
  }, [])
  return supported
}

export function HtmlInCanvas({
  width = 520,
  height = 320,
  className,
  children,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const supported = useHtmlInCanvasSupport()

  useEffect(() => {
    if (!supported) return
    const canvas = canvasRef.current
    const source = sourceRef.current
    if (!canvas || !source) return
    const ctx = canvas.getContext("2d")
    if (!ctx?.drawElementImage) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    let raf = 0
    const render = () => {
      ctx.clearRect(0, 0, width, height)

      const grad = ctx.createLinearGradient(0, 0, width, height)
      grad.addColorStop(0, "#1e1b4b")
      grad.addColorStop(1, "#581c87")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)

      const t = performance.now() / 1000
      const offsetX = Math.sin(t) * 18
      const offsetY = Math.cos(t * 0.8) * 12
      const rot = Math.sin(t * 0.6) * 0.08

      ctx.save()
      ctx.translate(width / 2 + offsetX, height / 2 + offsetY)
      ctx.rotate(rot)
      ctx.translate(-source.offsetWidth / 2, -source.offsetHeight / 2)
      ctx.drawElementImage!(source, 0, 0)
      ctx.restore()

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    const onPaint = () => {
      /* children repainted; loop will pick it up next frame */
    }
    source.addEventListener("paint", onPaint)

    return () => {
      cancelAnimationFrame(raf)
      source.removeEventListener("paint", onPaint)
    }
  }, [supported, width, height])

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        className="rounded-lg border border-border bg-black"
      />
      {/* `layoutsubtree` tells the browser to lay out children but keep them
          invisible unless/until we draw them via drawElementImage(). */}
      <canvas
        // @ts-expect-error experimental attribute not in lib.dom yet
        layoutsubtree=""
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <div
          ref={sourceRef}
          style={{
            width: 320,
            padding: 16,
            borderRadius: 12,
            background: "rgba(255,255,255,0.95)",
            color: "#111",
            fontFamily: "ui-sans-serif, system-ui",
          }}
        >
          {children}
        </div>
      </canvas>

      {supported === false && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/75 p-6 text-center text-sm text-white">
          <div>
            <p className="mb-2 font-semibold">HTML-in-Canvas not available</p>
            <p className="text-white/70">
              Enable{" "}
              <code className="rounded bg-white/10 px-1 py-0.5">
                chrome://flags/#canvas-draw-element
              </code>{" "}
              in Chrome Canary or Brave (Chromium 147+).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
