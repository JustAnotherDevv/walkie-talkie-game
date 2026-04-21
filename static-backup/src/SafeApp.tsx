import { useState } from 'react';

/**
 * Minimal failsafe app. No Canvas, no audio, no ElevenLabs SDK, no hooks
 * beyond useState. Proves that Vite + React + the module graph can render
 * at all when the main app is blanking. Loaded via ?safe=1 in main.tsx.
 */
export default function SafeApp() {
  const [count, setCount] = useState(0);
  const [envDump] = useState(() => ({
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    agentIdSet: Boolean(import.meta.env.VITE_ELEVENLABS_AGENT_ID),
    voiceIdSet: Boolean(import.meta.env.VITE_ELEVENLABS_VOICE_ID),
  }));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0b1020',
        color: '#e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <div style={{ fontSize: 28, letterSpacing: '0.3em', fontWeight: 700 }}>
        SAFE MODE
      </div>
      <div style={{ opacity: 0.7, textAlign: 'center', maxWidth: 480 }}>
        React + Vite render verified. Click the button below to confirm event
        handlers work. If this mode works, the bug is in the main app's
        imports or effects — not the bundler.
      </div>
      <button
        onClick={() => setCount((c) => c + 1)}
        style={{
          padding: '12px 28px',
          background: '#1e40af',
          color: 'white',
          border: '1px solid #3b82f6',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        count = {count}
      </button>
      <pre
        style={{
          background: 'rgba(0,0,0,0.4)',
          padding: 12,
          borderRadius: 6,
          fontSize: 12,
          margin: 0,
        }}
      >
{JSON.stringify(envDump, null, 2)}
      </pre>
      <a
        href="/"
        style={{ color: '#94a3b8', fontSize: 12, textDecoration: 'underline' }}
      >
        (load full app)
      </a>
    </div>
  );
}
