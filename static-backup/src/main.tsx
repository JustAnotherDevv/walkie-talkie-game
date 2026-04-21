import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DiagnosticOverlay } from './components/DiagnosticOverlay';

// Feature-flag the main app behind ?safe=1 so we can always fall back to a
// minimal SafeApp that proves Vite + React work even if the real App blows up.
const params =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
const safeMode = params.get('safe') === '1';
// StrictMode off by default. It double-invokes effects in dev which can
// race our async bootstrap (ElevenLabs init + manifest fetch + ConvAI
// session wiring) and leave the UI in an inconsistent state. Opt back in
// via ?strict=on if needed.
const useStrict = params.get('strict') === 'on';

async function boot() {
  const root = createRoot(document.getElementById('root')!);

  try {
    const Loaded = safeMode
      ? (await import('./SafeApp')).default
      : (await import('./App')).default;

    const Tree = (
      <>
        <ErrorBoundary label="app-root">
          <Loaded />
        </ErrorBoundary>
        <DiagnosticOverlay />
      </>
    );

    root.render(useStrict ? <StrictMode>{Tree}</StrictMode> : Tree);
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    root.render(
      <div
        style={{
          padding: 24,
          fontFamily: 'ui-monospace, monospace',
          color: '#fca5a5',
          background: '#0b1020',
          minHeight: '100vh',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>bootstrap failed</div>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{message}</pre>
        <div style={{ marginTop: 16 }}>
          <a href="/?safe=1" style={{ color: '#93c5fd' }}>load safe mode →</a>
        </div>
      </div>,
    );
  }
}

void boot();
