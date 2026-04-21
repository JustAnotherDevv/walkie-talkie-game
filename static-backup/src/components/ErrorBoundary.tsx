import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional override: rendered instead of the default fallback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Optional label used in the default fallback + console.error. */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Error boundary that prevents runtime errors in descendants from blanking
 * the whole app (e.g. a failed GLB load, a WebGL context loss, or an
 * unexpected exception inside a Canvas subtree).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.label ?? 'unknown'}]`, error, info);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    const { children, fallback, label } = this.props;

    if (error) {
      if (fallback) return fallback(error, this.reset);
      // Inline styles so nothing in the surrounding CSS can hide this.
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483000,
            padding: 24,
            background: '#200',
            color: '#fecaca',
            fontFamily: 'ui-monospace, monospace',
            overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            ⚠︎ {label ?? 'app crashed'}
          </div>
          <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 8 }}>
            {error.name}: {error.message}
          </div>
          <pre
            style={{
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              color: '#d4d4d4',
              background: 'rgba(0,0,0,0.3)',
              padding: 8,
              borderRadius: 4,
              maxHeight: '40vh',
              overflow: 'auto',
            }}
          >
            {error.stack}
          </pre>
          <button
            onClick={this.reset}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              background: '#991b1b',
              border: '1px solid #ef4444',
              color: '#fee2e2',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            retry
          </button>
        </div>
      );
    }

    return children;
  }
}
