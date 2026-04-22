import { createRef, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { Environment, OrbitControls } from "@react-three/drei"
import { Book } from "@/components/book/Book"
import { sampleLeaves } from "@/components/book/sampleContent"
import {
  PAGE_TEX_HEIGHT,
  PAGE_TEX_WIDTH,
} from "@/components/book/usePageTexture"

function App() {
  const leaves = sampleLeaves
  const frontRefs = useMemo(
    () => leaves.map(() => createRef<HTMLDivElement>()),
    [leaves],
  )
  const backRefs = useMemo(
    () => leaves.map(() => createRef<HTMLDivElement>()),
    [leaves],
  )

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-6 py-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              A Book Made of HTML
            </h1>
            <p className="text-xs text-muted-foreground">
              Drag the right-hand page to turn it · HTML-in-Canvas ·
              react-three-fiber · custom curl shader
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Best viewed in Chrome Canary with{" "}
            <code className="text-[11px]">
              chrome://flags/#canvas-draw-element
            </code>{" "}
            enabled. Falls back to SVG rendering otherwise.
          </p>
        </div>
      </header>

      {/* Live DOM sources for each page. Hidden off-screen but present in the
          accessibility tree. Each lives inside a <canvas layoutsubtree> so the
          HTML-in-Canvas API can sample them; without the flag, the SVG
          fallback inside usePageTexture takes over. */}
      <div
        aria-hidden={false}
        style={{
          position: "fixed",
          left: "-100000px",
          top: 0,
          width: PAGE_TEX_WIDTH,
          height: PAGE_TEX_HEIGHT * leaves.length * 2,
          pointerEvents: "none",
        }}
      >
        {leaves.map((leaf, i) => (
          <div key={i}>
            <canvas
              // @ts-expect-error experimental attribute not yet in lib.dom
              layoutsubtree=""
              style={{ width: PAGE_TEX_WIDTH, height: PAGE_TEX_HEIGHT }}
            >
              <div ref={frontRefs[i]}>{leaf.front}</div>
            </canvas>
            <canvas
              // @ts-expect-error experimental attribute not yet in lib.dom
              layoutsubtree=""
              style={{ width: PAGE_TEX_WIDTH, height: PAGE_TEX_HEIGHT }}
            >
              <div ref={backRefs[i]}>{leaf.back}</div>
            </canvas>
          </div>
        ))}
      </div>

      <main className="h-[calc(100vh-96px)] w-full">
        <Canvas
          shadows
          camera={{ position: [0, 0.4, 6.2], fov: 38 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          style={{ background: "#0b0b10" }}
        >
          <color attach="background" args={["#0b0b10"]} />
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[4, 6, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-3, 2, -4]} intensity={0.35} />
          <Environment preset="apartment" />

          <group rotation={[-0.18, 0, 0]}>
            <Book
              leafCount={leaves.length}
              frontRefs={frontRefs}
              backRefs={backRefs}
            />
          </group>

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 2.1}
            minAzimuthAngle={-0.4}
            maxAzimuthAngle={0.4}
            rotateSpeed={0.4}
          />
        </Canvas>
      </main>
    </div>
  )
}

export default App
