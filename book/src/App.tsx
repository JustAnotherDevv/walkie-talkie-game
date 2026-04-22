import { useState } from "react"
import { Canvas } from "@react-three/fiber"
import { Scene } from "@/components/Scene"
import { HtmlInCanvas } from "@/components/HtmlInCanvas"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-6 py-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Book · R3F + HTML-in-Canvas
        </h1>
        <p className="text-sm text-muted-foreground">
          Vite · React · TypeScript · Tailwind · shadcn/ui · three.js ·
          @react-three/fiber
        </p>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-6 md:grid-cols-2">
        <Card className="overflow-hidden py-0">
          <CardHeader className="pt-6">
            <CardTitle>3D Scene (react-three-fiber)</CardTitle>
            <CardDescription>
              A floating volume rendered with three.js via R3F.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="h-[360px] w-full bg-black">
              <Canvas shadows camera={{ position: [3, 2, 5], fov: 45 }}>
                <Scene />
              </Canvas>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>HTML-in-Canvas demo</CardTitle>
            <CardDescription>
              Real, interactive DOM rendered into a 2D canvas via{" "}
              <code>drawElementImage()</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HtmlInCanvas width={520} height={320}>
              <h2 className="mb-2 text-lg font-semibold">
                Hello from inside the canvas
              </h2>
              <p className="mb-3 text-sm text-neutral-700">
                This text, button, and input are a real DOM subtree painted into
                a 2D canvas on every frame.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setCount((c) => c + 1)}
                >
                  Count is {count}
                </Button>
                <input
                  type="text"
                  defaultValue="editable!"
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
                />
              </div>
            </HtmlInCanvas>
          </CardContent>
        </Card>
      </main>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        HTML-in-Canvas is experimental. Enable{" "}
        <code>chrome://flags/#canvas-draw-element</code> in Chrome Canary / Brave
        (Chromium 147+).
      </footer>
    </div>
  )
}

export default App
