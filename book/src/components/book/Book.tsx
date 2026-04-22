import { useCallback, useEffect, useRef } from "react"
import { useSpring, type SpringValue } from "@react-spring/three"
import type { ThreeEvent } from "@react-three/fiber"
import { Page } from "./Page"
import { useHtmlPageTexture } from "./usePageTexture"

type SpringApi = {
  progress: SpringValue<number>
  set: (v: number, opts?: { snap?: boolean }) => void
}

type BookProps = {
  /** One entry per physical leaf of paper. Each leaf has a front + back. */
  leafCount: number
  frontRefs: React.RefObject<HTMLDivElement | null>[]
  backRefs: React.RefObject<HTMLDivElement | null>[]
  size?: number
}

const PAGE_ASPECT = 1024 / 1536

export function Book({ leafCount, frontRefs, backRefs, size = 4.2 }: BookProps) {
  const pageWidth = size / 2
  const pageHeight = pageWidth / PAGE_ASPECT

  const springsRef = useRef<SpringApi[]>([])
  const registerSpring = useCallback((i: number, api: SpringApi) => {
    springsRef.current[i] = api
  }, [])

  // Global drag state. Only one page can be dragged at a time.
  const dragRef = useRef<{
    index: number
    startX: number
    startValue: number
    pxPerFlip: number
  } | null>(null)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const s = dragRef.current
      if (!s) return
      const dx = e.clientX - s.startX
      // Drag right-to-left on a right-side page flips it left.
      const delta = -dx / s.pxPerFlip
      const next = Math.min(1, Math.max(0, s.startValue + delta))
      springsRef.current[s.index]?.set(next)
    }
    const onUp = () => {
      const s = dragRef.current
      if (!s) return
      const cur = springsRef.current[s.index]?.progress.get() ?? 0
      springsRef.current[s.index]?.set(cur > 0.5 ? 1 : 0, { snap: true })
      dragRef.current = null
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [])

  const makeDown = (index: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const cur = springsRef.current[index]?.progress.get() ?? 0
    const canvas = (e.target as HTMLElement)?.closest?.("canvas")
    const rect =
      canvas?.getBoundingClientRect() ?? { width: 800 } as DOMRect
    dragRef.current = {
      index,
      startX: e.clientX,
      startValue: cur,
      pxPerFlip: Math.max(140, rect.width / 3),
    }
  }

  return (
    <group>
      {/* Back cover (dark hardcover) — sits behind every leaf. */}
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[pageWidth * 2 + 0.08, pageHeight + 0.1, 0.04]} />
        <meshStandardMaterial color="#2a1106" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Soft shadow under the book. */}
      <mesh position={[0, -pageHeight / 2 - 0.06, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[pageWidth * 2 + 0.6, 0.6]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>

      {Array.from({ length: leafCount }).map((_, i) => (
        <PageLeaf
          key={i}
          index={i}
          leafCount={leafCount}
          frontRef={frontRefs[i]}
          backRef={backRefs[i]}
          width={pageWidth}
          height={pageHeight}
          registerSpring={registerSpring}
          onDown={makeDown(i)}
        />
      ))}
    </group>
  )
}

function PageLeaf({
  index,
  leafCount,
  frontRef,
  backRef,
  width,
  height,
  registerSpring,
  onDown,
}: {
  index: number
  leafCount: number
  frontRef: React.RefObject<HTMLDivElement | null>
  backRef: React.RefObject<HTMLDivElement | null>
  width: number
  height: number
  registerSpring: (i: number, api: SpringApi) => void
  onDown: (e: ThreeEvent<PointerEvent>) => void
}) {
  const [springStyle, api] = useSpring(() => ({
    progress: 0,
    config: { mass: 1.2, tension: 180, friction: 28 },
  }))

  useEffect(() => {
    registerSpring(index, {
      progress: springStyle.progress,
      set: (v, opts) =>
        api.start({
          progress: v,
          immediate: !opts?.snap,
          config: opts?.snap
            ? { mass: 1.1, tension: 150, friction: 24 }
            : { duration: 0 },
        }),
    })
  }, [api, springStyle.progress, index, registerSpring])

  const { texture: frontTex } = useHtmlPageTexture(frontRef)
  const { texture: backTex } = useHtmlPageTexture(backRef)

  return (
    <Page
      frontTexture={frontTex}
      backTexture={backTex}
      progress={springStyle.progress}
      width={width}
      height={height}
      index={index}
      leafCount={leafCount}
      onPointerDown={onDown}
    />
  )
}
