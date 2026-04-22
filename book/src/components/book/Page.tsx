import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import type { ThreeEvent } from "@react-three/fiber"
import * as THREE from "three"
import { useSpring, type SpringValue } from "@react-spring/three"

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vCurl;

  uniform float uProgress;  // 0 = lying right, 1 = flipped to left
  uniform float uWidth;
  uniform float uCurl;

  #define PI 3.1415926535

  void main() {
    vUv = uv;

    vec3 pos = position;
    // Local X ∈ [0, uWidth], with the spine at X=0.
    float u = pos.x / uWidth;

    // Rotation around Y-axis at the spine (X=0).
    float angle = -uProgress * PI;
    float cs = cos(angle);
    float sn = sin(angle);

    vec3 rotated = vec3(
      pos.x * cs,
      pos.y,
      -pos.x * sn
    );

    // Secondary curl: the free edge bows up during the middle of the flip.
    // Peaks at progress = 0.5, tapers to 0 at the spine and the free edge.
    float flipPhase = sin(uProgress * PI);
    // Biased curl — stronger near the free edge, like a real turning page.
    float shape = sin(u * PI) * (0.6 + 0.4 * u);
    float curlAmt = flipPhase * shape * uCurl;
    vCurl = curlAmt;

    // The page's own normal in its rotated frame (original +Z rotated around Y).
    vec3 pageNormal = vec3(sn, 0.0, cs);
    rotated += pageNormal * curlAmt;

    // Also tilt the surface normal slightly toward the curl tangent so lighting
    // responds to the bend. Derivative of curlAmt w.r.t. u.
    float dCurl_du = flipPhase * (
      PI * cos(u * PI) * (0.6 + 0.4 * u) +
      sin(u * PI) * 0.4
    ) * uCurl;
    vec3 tangent = normalize(vec3(cs, 0.0, -sn) + pageNormal * (dCurl_du / uWidth));
    vec3 bitangent = vec3(0.0, 1.0, 0.0);
    vec3 bentNormal = normalize(cross(tangent, bitangent));
    // Flip if it points away from camera after mesh transform.
    vWorldNormal = normalize(mat3(modelMatrix) * bentNormal);

    vec4 worldPos = modelMatrix * vec4(rotated, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vCurl;

  uniform sampler2D uFront;
  uniform sampler2D uBack;
  uniform vec3 uLightDir;
  uniform vec3 uCameraPos;

  void main() {
    vec3 N = normalize(vWorldNormal);
    if (!gl_FrontFacing) N = -N;

    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 H = normalize(L + V);

    float ndl = max(dot(N, L), 0.0);
    float ndh = max(dot(N, H), 0.0);
    // Subtle paper micro-sheen.
    float spec = pow(ndh, 24.0) * 0.08;

    // Wrap-around lighting softens the shaded side (paper is slightly translucent).
    float wrap = clamp((dot(N, L) + 0.4) / 1.4, 0.0, 1.0);
    float diffuse = mix(ndl, wrap, 0.35);
    float lighting = 0.32 + 0.68 * diffuse + spec;

    vec4 color;
    if (gl_FrontFacing) {
      color = texture2D(uFront, vUv);
    } else {
      color = texture2D(uBack, vec2(1.0 - vUv.x, vUv.y));
    }

    // Ambient occlusion from the curl: more curl → a touch darker near the bend.
    float ao = 1.0 - clamp(abs(vCurl) * 1.2, 0.0, 0.25);

    gl_FragColor = vec4(color.rgb * lighting * ao, 1.0);
  }
`

export type PageProps = {
  frontTexture: THREE.Texture
  backTexture: THREE.Texture
  progress: SpringValue<number>
  width: number
  height: number
  /** Page index (0 = top of the right stack). */
  index: number
  /** Total number of leaves, for resolving z-order. */
  leafCount: number
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
}

export function Page({
  frontTexture,
  backTexture,
  progress,
  width,
  height,
  index,
  leafCount,
  onPointerDown,
}: PageProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uWidth: { value: width },
      uCurl: { value: 0.13 },
      uFront: { value: frontTexture },
      uBack: { value: backTexture },
      uLightDir: { value: new THREE.Vector3(0.5, 1.0, 0.8).normalize() },
      uCameraPos: { value: new THREE.Vector3() },
    }),
    [frontTexture, backTexture, width],
  )

  // Target z-offsets:
  //   unflipped (progress = 0): page 0 on top of right stack → highest z
  //   flipped   (progress = 1): last-flipped page on top of left stack → highest z
  // We interpolate linearly; adjacent pages cross at progress = 0.5 which is
  // exactly when they're standing up in the middle of the flip (no overlap).
  const frontZ = (leafCount - index) * 0.0015
  const backZ = (index + 1) * 0.0015

  useFrame(({ camera }) => {
    if (!materialRef.current) return
    const p = progress.get()
    uniforms.uProgress.value = p
    uniforms.uCameraPos.value.copy(camera.position)
    if (meshRef.current) {
      meshRef.current.position.z = (1 - p) * frontZ + p * backZ
    }
  })

  // Anchor the geometry so X ∈ [0, width] — that matches the shader math
  // (spine at local X = 0). We translate the geometry once at creation.
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, height, 40, 1)
    g.translate(width / 2, 0, 0)
    return g
  }, [width, height])

  return (
    <mesh
      ref={meshRef}
      onPointerDown={onPointerDown}
      geometry={geometry}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent={false}
      />
    </mesh>
  )
}

/** Small hook to create a spring for a page's flip progress. */
export function useFlipSpring(initial = 0) {
  return useSpring(() => ({
    progress: initial,
    config: { mass: 1.2, tension: 180, friction: 28 },
  }))
}
