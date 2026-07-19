import { useState, useEffect } from 'react';
import { changeTicketStatus } from '../api/tickets';
import { ApiError } from '../api/client';
import type { Status, Ticket } from '../api/types';
import StatusBadge from './StatusBadge';
import ErrorDisplay from './ErrorDisplay';

const TRANSITION_LABELS: Record<Status, string> = {
  IN_PROGRESS: 'Move to In Progress',
  RESOLVED: 'Mark Resolved',
  CLOSED: 'Close',
  CANCELLED: 'Cancel',
  OPEN: 'Reopen',
};

interface StatusTransitionControlsProps {
  ticket: Ticket;
  onStatusChanged: (updatedTicket: Ticket) => void;
}

export default function StatusTransitionControls({ ticket, onStatusChanged }: StatusTransitionControlsProps) {
  const [pendingTarget, setPendingTarget] = useState<Status | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // Clear stale error when the ticket status changes (e.g., after a successful transition)
  useEffect(() => {
    setError(null);
  }, [ticket.status]);

  const handleTransition = async (targetStatus: Status) => {
    setPendingTarget(targetStatus);
    setError(null);
    try {
      const updated = await changeTicketStatus(ticket.id, { status: targetStatus });
      onStatusChanged(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'NETWORK_ERROR', 'An unexpected error occurred'));
      }
    } finally {
      setPendingTarget(null);
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Status:</span>
        <StatusBadge status={ticket.status} />
        {ticket.validTransitions.map((target) => (
          <button
            key={target}
            onClick={() => handleTransition(target)}
            disabled={pendingTarget !== null}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: pendingTarget !== null ? 'not-allowed' : 'pointer',
              opacity: pendingTarget !== null ? 0.6 : 1,
              backgroundColor: pendingTarget === target ? '#e5e7eb' : 'white',
              fontSize: '13px',
            }}
          >
            {pendingTarget === target ? '...' : TRANSITION_LABELS[target]}
          </button>
        ))}
      </div>
      {error && (
        <div style={{ marginTop: '8px' }}>
          <ErrorDisplay error={error} onDismiss={() => setError(null)} />
        </div>
      )}
    </div>
  );
}
