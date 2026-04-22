import { useEffect, useRef, useState } from 'react';

const INTRO_LINES = [
  'You wake up on a cold concrete floor.',
  "You can't remember anything.",
  'A voice crackles through a speaker somewhere.',
];

const CHAR_MS = 30;        // ms per typed character
const HOLD_MS = 300;       // brief hold after last char
const FADE_MS = 800;       // one combined fade of text + black
const CAMERA_MS = 2200;    // must match IntroCamera.durationMs

type Phase = 'typing' | 'hold' | 'fading' | 'done';

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Intro overlay. Three phases:
 *   typing  — text types out on fully-opaque black
 *   hold    — short pause with final line shown
 *   fading  — SINGLE combined rAF-driven opacity fade of the entire
 *             overlay (black + text together). `onFadeStart` fires at
 *             the start of this phase so the 3D camera wake-up can
 *             animate in parallel and the scene is fully visible by
 *             the time the overlay is gone.
 *   done    — unmount.
 */
export function IntroCutscene({
  onFinish,
  onFadeStart,
}: {
  onFinish: () => void;
  onFadeStart?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('typing');
  const [shown, setShown] = useState('');
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const finishedRef = useRef(false);
  const fadeSignalled = useRef(false);

  // Typewriter → hold
  useEffect(() => {
    const full = INTRO_LINES.join('\n');
    let i = 0;
    let cancelled = false;
    let timeoutId: number | undefined;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setShown(full.slice(0, i));
      if (i < full.length) {
        timeoutId = window.setTimeout(tick, CHAR_MS);
      } else {
        if (!cancelled) setPhase('hold');
      }
    };
    timeoutId = window.setTimeout(tick, 200);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  // hold → fading
  useEffect(() => {
    if (phase !== 'hold') return;
    const id = window.setTimeout(() => setPhase('fading'), HOLD_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // fading: rAF-drive the overlay opacity 1 → 0 fast (FADE_MS) while
  // the 3D camera wake-up plays in parallel (signalled via onFadeStart).
  // onFinish is deferred until the camera animation completes so
  // PlayerController doesn't take over a still-tilted camera.
  useEffect(() => {
    if (phase !== 'fading') return;
    if (!fadeSignalled.current) {
      fadeSignalled.current = true;
      onFadeStart?.();
    }
    let frame: number | null = null;
    let cancelled = false;
    const start = performance.now();
    const tick = () => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      const fadeT = Math.min(1, elapsed / FADE_MS);
      setOverlayOpacity(1 - easeOutCubic(fadeT));
      if (elapsed < CAMERA_MS) {
        frame = requestAnimationFrame(tick);
      } else {
        setPhase('done');
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinish();
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [phase, onFinish, onFadeStart]);

  if (phase === 'done') return null;

  return (
    <div
      className="intro-cutscene"
      style={{
        opacity: overlayOpacity,
        pointerEvents: overlayOpacity < 0.02 ? 'none' : 'auto',
      }}
    >
      <pre className="intro-text">
        {shown}
        <span className="intro-caret">▌</span>
      </pre>
    </div>
  );
}
