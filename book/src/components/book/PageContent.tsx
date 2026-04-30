import { forwardRef } from "react"
import { PAGE_TEX_HEIGHT, PAGE_TEX_WIDTH } from "./usePageTexture"

type Side = "left" | "right"

type BodyPageProps = {
  title?: string
  body: React.ReactNode
  pageNumber: number
  side: Side
}

const baseStyle: React.CSSProperties = {
  width: PAGE_TEX_WIDTH,
  height: PAGE_TEX_HEIGHT,
  boxSizing: "border-box",
  padding: "120px 110px",
  fontFamily:
    "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  fontSize: 30,
  lineHeight: 1.55,
  color: "#2b2418",
  background:
    "linear-gradient(180deg, #faf3df 0%, #f3e9cf 55%, #ead9b4 100%)",
  position: "relative",
  overflow: "hidden",
  letterSpacing: "0.1px",
  hyphens: "auto" as const,
}

const spineShadow = (side: Side): React.CSSProperties => ({
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 160,
  [side === "left" ? "right" : "left"]: 0,
  background:
    side === "left"
      ? "linear-gradient(270deg, rgba(0,0,0,0.28), rgba(0,0,0,0))"
      : "linear-gradient(90deg, rgba(0,0,0,0.28), rgba(0,0,0,0))",
  pointerEvents: "none",
})

const grain: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)",
  backgroundSize: "3px 3px",
  opacity: 0.6,
  mixBlendMode: "multiply",
  pointerEvents: "none",
}

export const BodyPage = forwardRef<HTMLDivElement, BodyPageProps>(
  function BodyPage({ title, body, pageNumber, side }, ref) {
    return (
      <div ref={ref} style={baseStyle}>
        <div style={grain} aria-hidden />
        <div style={spineShadow(side)} aria-hidden />
        {title && (
          <h2
            style={{
              fontSize: 52,
              margin: "0 0 48px",
              fontFamily:
                "'Didot', 'Bodoni 72', 'Playfair Display', Georgia, serif",
              fontWeight: 600,
              color: "#1a1308",
              letterSpacing: "-0.5px",
            }}
          >
            {title}
          </h2>
        )}
        <div style={{ textAlign: "justify" }}>{body}</div>
        <div
          style={{
            position: "absolute",
            bottom: 70,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 22,
            color: "#6b5a3c",
            fontStyle: "italic",
          }}
        >
          — {pageNumber} —
        </div>
      </div>
    )
  },
)

type CoverPageProps = {
  title: string
  subtitle?: string
  author?: string
  side: Side
}

export const CoverPage = forwardRef<HTMLDivElement, CoverPageProps>(
  function CoverPage({ title, subtitle, author, side }, ref) {
    return (
      <div
        ref={ref}
        style={{
          ...baseStyle,
          background:
            "radial-gradient(ellipse at 30% 20%, #5b2a12 0%, #3a1808 55%, #1f0c04 100%)",
          color: "#f3dca0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "140px 110px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            ...spineShadow(side),
            background:
              side === "left"
                ? "linear-gradient(270deg, rgba(0,0,0,0.55), rgba(0,0,0,0))"
                : "linear-gradient(90deg, rgba(0,0,0,0.55), rgba(0,0,0,0))",
          }}
          aria-hidden
        />
        <div
          style={{
            position: "absolute",
            inset: 80,
            border: "3px double #c9a86a",
            borderRadius: 4,
            pointerEvents: "none",
          }}
          aria-hidden
        />
        {subtitle && (
          <div
            style={{
              fontSize: 28,
              letterSpacing: "8px",
              textTransform: "uppercase",
              marginBottom: 40,
              color: "#c9a86a",
            }}
          >
            {subtitle}
          </div>
        )}
        <h1
          style={{
            fontFamily:
              "'Didot', 'Bodoni 72', 'Playfair Display', Georgia, serif",
            fontSize: 110,
            lineHeight: 1.05,
            margin: 0,
            color: "#f5deab",
            textShadow: "0 2px 0 rgba(0,0,0,0.4)",
          }}
        >
          {title}
        </h1>
        {author && (
          <div
            style={{
              marginTop: 80,
              fontSize: 34,
              fontStyle: "italic",
              color: "#d9b978",
            }}
          >
            {author}
          </div>
        )}
      </div>
    )
  },
)
