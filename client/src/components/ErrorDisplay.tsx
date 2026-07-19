import { ApiError } from '../api/client';

interface ErrorDisplayProps {
  error: ApiError | null;
  onDismiss?: () => void;
}

/**
 * Renders contextual error messages based on the ApiError code.
 * - VALIDATION_ERROR: field-specific messages from details array
 * - NOT_FOUND: resource not found message
 * - TICKET_LOCKED: distinct locked-state message (terminal state)
 * - INVALID_TRANSITION: transition error message from API
 * - NETWORK_ERROR: server unavailable message
 */
export default function ErrorDisplay({ error, onDismiss }: ErrorDisplayProps) {
  if (!error) return null;

  const containerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  };

  const dismissButton = onDismiss ? (
    <button
      onClick={onDismiss}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}
      aria-label="Dismiss error"
    >
      ×
    </button>
  ) : null;

  // TICKET_LOCKED — distinct locked-state message
  if (error.code === 'TICKET_LOCKED') {
    return (
      <div
        role="alert"
        style={{ ...containerStyle, backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}
      >
        <div>
          <strong style={{ display: 'block', marginBottom: '4px' }}>Ticket Locked</strong>
          <span>This ticket is in a terminal state and cannot be modified. Field edits are no longer permitted.</span>
        </div>
        {dismissButton}
      </div>
    );
  }

  // NETWORK_ERROR — server unavailable
  if (error.code === 'NETWORK_ERROR') {
    return (
      <div
        role="alert"
        style={{ ...containerStyle, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
      >
        <div>
          <strong style={{ display: 'block', marginBottom: '4px' }}>Network Error</strong>
          <span>The server is unavailable. Please check your connection and try again later.</span>
        </div>
        {dismissButton}
      </div>
    );
  }

  // NOT_FOUND — resource does not exist
  if (error.code === 'NOT_FOUND') {
    return (
      <div
        role="alert"
        style={{ ...containerStyle, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
      >
        <div>
          <strong style={{ display: 'block', marginBottom: '4px' }}>Not Found</strong>
          <span>The requested resource does not exist.</span>
        </div>
        {dismissButton}
      </div>
    );
  }

  // INVALID_TRANSITION — show the transition error message from API
  if (error.code === 'INVALID_TRANSITION') {
    return (
      <div
        role="alert"
        style={{ ...containerStyle, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
      >
        <div>
          <strong style={{ display: 'block', marginBottom: '4px' }}>Invalid Transition</strong>
          <span>{error.message}</span>
        </div>
        {dismissButton}
      </div>
    );
  }

  // VALIDATION_ERROR — show field-specific messages
  if (error.code === 'VALIDATION_ERROR') {
    return (
      <div
        role="alert"
        style={{ ...containerStyle, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
      >
        <div style={{ flex: 1 }}>
          <strong style={{ display: 'block', marginBottom: '4px' }}>Validation Error</strong>
          {error.details && error.details.length > 0 ? (
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', listStyle: 'disc' }}>
              {error.details.map((detail, idx) => (
                <li key={idx} style={{ marginBottom: '2px' }}>
                  <strong>{detail.field}:</strong> {detail.message}
                </li>
              ))}
            </ul>
          ) : (
            <span>{error.message}</span>
          )}
        </div>
        {dismissButton}
      </div>
    );
  }

  // Fallback — generic error display
  return (
    <div
      role="alert"
      style={{ ...containerStyle, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
    >
      <div>
        <span>{error.message}</span>
      </div>
      {dismissButton}
    </div>
  );
}
