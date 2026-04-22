import type { ReactNode } from "react"
import { BodyPage, CoverPage } from "./PageContent"

export type Leaf = { front: ReactNode; back: ReactNode }

export const sampleLeaves: Leaf[] = [
  {
    front: (
      <CoverPage
        side="right"
        subtitle="A field guide"
        title="HTML in Canvas"
        author="— for the open web —"
      />
    ),
    back: (
      <BodyPage
        side="left"
        pageNumber={2}
        title="Prologue"
        body={
          <>
            <p>
              The canvas element has always been a one-way mirror. You can draw
              into it with ease — rectangles, paths, images — but rich,
              accessible text was forever out of reach. Anyone who has rolled
              their own text engine in WebGL knows the cost: font metrics, bidi,
              ligatures, selection, internationalisation.
            </p>
            <p style={{ marginTop: "1em" }}>
              HTML-in-Canvas finally closes this gap.
            </p>
          </>
        }
      />
    ),
  },
  {
    front: (
      <BodyPage
        side="right"
        pageNumber={3}
        title="The API"
        body={
          <>
            <p>
              Three primitives do the work. The <i>layoutsubtree</i> attribute
              opts a canvas's children into normal HTML layout. The drawing
              methods — <i>drawElementImage</i> for 2D, <i>texElementImage2D</i>{" "}
              for WebGL, <i>copyElementImageToTexture</i> for WebGPU — sample a
              laid-out element. The <i>paint</i> event fires whenever a child
              repaints.
            </p>
          </>
        }
      />
    ),
    back: (
      <BodyPage
        side="left"
        pageNumber={4}
        body={
          <>
            <p>
              What you hold in your hands is an example. Every word you are
              reading was laid out by the browser's real text engine, drawn
              into a 2D canvas, then uploaded as a texture to a three.js mesh
              that bends with a vertex shader. Drag the corner of a page to
              turn it.
            </p>
            <p style={{ marginTop: "1em" }}>
              The paper curls; the lighting follows; the words stay crisp.
            </p>
          </>
        }
      />
    ),
  },
  {
    front: (
      <BodyPage
        side="right"
        pageNumber={5}
        title="The Road Ahead"
        body={
          <>
            <p>
              There is still work to do. Fingerprinting surfaces must be closed.
              Compatibility with Safari and Firefox is still being negotiated.
              The spec itself is a living document that will change before it
              ships on by default.
            </p>
            <p style={{ marginTop: "1em" }}>
              But the shape of the future is clear: the chasm between DOM and
              GPU is narrowing, and the web is about to feel physical again.
            </p>
          </>
        }
      />
    ),
    back: (
      <BodyPage
        side="left"
        pageNumber={6}
        body={
          <p
            style={{
              textAlign: "center",
              fontStyle: "italic",
              marginTop: "3em",
            }}
          >
            The end.
          </p>
        }
      />
    ),
  },
]
