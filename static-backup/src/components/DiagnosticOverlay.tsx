import { useEffect, useState } from 'react';

interface Entry {
  ts: number;
  level: 'log' | 'warn' | 'error';
  message: string;
}

declare global {
  interface Window {
    __staticLog?: (level: Entry['level'], ...args: unknown[]) => void;
  }
}

/**
 * On-screen diagnostic overlay. Captures console.log/warn/error and window
 * errors so we can see runtime problems when DevTools is hung or closed.
 *
 * Toggle visibility with `?debug=1` in the URL.
 */
export function DiagnosticOverlay() {
  const enabled = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';

  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    const push = (level: Entry['level'], args: unknown[]) => {
      const msg = args.map((a) => {
        if (a instanceof Error) return `${a.name}: ${a.message}`;
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' ');
      setEntries((prev) => {
        const next = [...prev, { ts: Date.now(), level, message: msg }];
        return next.slice(-60);
      });
    };

    console.log = (...args) => { push('log', args); origLog(...args); };
    console.warn = (...args) => { push('warn', args); origWarn(...args); };
    console.error = (...args) => { push('error', args); origError(...args); };

    const onError = (e: ErrorEvent) =>
      push('error', ['window.error:', e.message, 'at', `${e.filename}:${e.lineno}:${e.colno}`]);
    const onRejection = (e: PromiseRejectionEvent) =>
      push('error', ['unhandled rejection:', e.reason]);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    window.__staticLog = (level, ...args) => push(level, args);
    push('log', ['diagnostic overlay ready']);

    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      delete window.__staticLog;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 8,
        bottom: 8,
        width: 420,
        maxHeight: '70vh',
        overflowY: 'auto',
        padding: 8,
        background: 'rgba(0,0,0,0.85)',
        color: '#d1d5db',
        font: '11px/1.4 ui-monospace, monospace',
        zIndex: 999999,
        pointerEvents: 'auto',
        border: '1px solid #374151',
        borderRadius: 6,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#f9fafb' }}>
        STATIC · debug ({entries.length})
      </div>
      {entries.map((e, i) => (
        <div
          key={i}
          style={{
            color:
              e.level === 'error'
                ? '#fca5a5'
                : e.level === 'warn'
                  ? '#fcd34d'
                  : '#9ca3af',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginBottom: 2,
          }}
        >
          <span style={{ opacity: 0.5 }}>
            {new Date(e.ts).toISOString().slice(11, 19)}
          </span>{' '}
          {e.message}
        </div>
      ))}
    </div>
  );
}
