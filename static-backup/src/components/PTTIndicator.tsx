import { PTTState } from '../hooks/usePTT';

/**
 * PTTIndicator component - Shows visual indicator while transmitting
 * Validates: Requirements 2.3, 2.4
 * 
 * Shows a radio-style indicator when PTT is active
 */

interface PTTIndicatorProps {
  pttState: PTTState;
  visible: boolean;
}

export function PTTIndicator({ pttState, visible }: PTTIndicatorProps) {
  if (!visible) {
    return null;
  }

  const getStatusText = (): string => {
    switch (pttState) {
      case PTTState.Transmitting:
        return 'TRANSMITTING';
      case PTTState.Processing:
        return 'PROCESSING...';
      case PTTState.Error:
        return 'SIGNAL LOST';
      default:
        return '';
    }
  };

  const getStatusColor = (): string => {
    switch (pttState) {
      case PTTState.Transmitting:
        return '#ff4444';
      case PTTState.Processing:
        return '#ffaa00';
      case PTTState.Error:
        return '#888888';
      default:
        return '#44ff44';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        border: `2px solid ${getStatusColor()}`,
        borderRadius: '8px',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: 'monospace',
        color: getStatusColor(),
        fontSize: '14px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        boxShadow: `0 0 20px ${getStatusColor()}40`,
        zIndex: 1000,
      }}
    >
      {/* Radio icon */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={getStatusColor()}
        strokeWidth="2"
        style={{
          animation: pttState === PTTState.Transmitting ? 'pulse 1s infinite' : 'none',
        }}
      >
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="8" cy="12" r="2" />
        <line x1="14" y1="10" x2="18" y2="10" />
        <line x1="14" y1="14" x2="18" y2="14" />
      </svg>
      
      {/* Status text */}
      <span>{getStatusText()}</span>
      
      {/* Animated bars for transmitting state */}
      {pttState === PTTState.Transmitting && (
        <div
          style={{
            display: 'flex',
            gap: '3px',
            alignItems: 'center',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: '4px',
                height: `${12 + Math.random() * 8}px`,
                backgroundColor: getStatusColor(),
                animation: `audioBar 0.3s ease-in-out ${i * 0.1}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
      
      {/* Key hint */}
      <span
        style={{
          fontSize: '12px',
          opacity: 0.7,
          marginLeft: '8px',
        }}
      >
        [V]
      </span>
      
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          
          @keyframes audioBar {
            0% { transform: scaleY(0.5); }
            100% { transform: scaleY(1); }
          }
        `}
      </style>
    </div>
  );
}

/**
 * PTTKeyHint component - Shows the PTT key binding in HUD
 * Validates: Requirement 13.4
 */
export function PTTKeyHint() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '4px',
        padding: '8px 12px',
        fontFamily: 'monospace',
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '12px',
        zIndex: 1000,
      }}
    >
      <span style={{ opacity: 0.6 }}>Hold</span>{' '}
      <span
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          padding: '2px 6px',
          borderRadius: '3px',
          fontWeight: 'bold',
        }}
      >
        V
      </span>{' '}
      <span style={{ opacity: 0.6 }}>to talk</span>
    </div>
  );
}
