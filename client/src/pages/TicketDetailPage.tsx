import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTicket } from '../api/tickets';
import { listUsers } from '../api/users';
import { ApiError } from '../api/client';
import type { TicketWithComments, Ticket, Comment, User, Status } from '../api/types';
import StatusTransitionControls from '../components/StatusTransitionControls';
import CommentList from '../components/CommentList';
import CommentForm from '../components/CommentForm';
import TicketEditForm from '../components/TicketEditForm';
import PriorityBadge from '../components/PriorityBadge';
import Toast from '../components/Toast';
import ErrorDisplay from '../components/ErrorDisplay';
import { useToast } from '../hooks/useToast';
import { formatRelativeTime } from '../utils/formatTime';

const TERMINAL_STATES: Status[] = ['CLOSED', 'CANCELLED'];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketWithComments | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([getTicket(id), listUsers()])
      .then(([ticketData, usersData]) => {
        setTicket(ticketData);
        setUsers(usersData);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err);
        } else {
          setError(new ApiError(0, 'NETWORK_ERROR', 'An unexpected error occurred'));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChanged = (updatedTicket: Ticket) => {
    if (ticket) {
      setTicket({ ...ticket, ...updatedTicket });
    }
    showToast(`Status updated to ${updatedTicket.status.replace('_', ' ')}`);
  };

  const handleEditSaved = (updatedTicket: Ticket) => {
    if (ticket) {
      setTicket({ ...ticket, ...updatedTicket });
    }
    setEditing(false);
    showToast('Ticket updated');
  };

  const handleCommentAdded = (comment: Comment) => {
    if (ticket) {
      setTicket({ ...ticket, comments: [comment, ...ticket.comments] });
    }
    showToast('Comment added');
  };

  if (loading) {
    return <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}><p>Loading ticket...</p></div>;
  }

  if (error) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        <ErrorDisplay error={error} />
        <Link to="/" style={{ display: 'inline-block', marginTop: '16px', color: '#3b82f6' }}>← Back to tickets</Link>
      </div>
    );
  }

  if (!ticket) return null;

  const isTerminal = TERMINAL_STATES.includes(ticket.status);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <Link to="/" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px' }}>← Back to tickets</Link>

      {/* Status transition controls */}
      <div style={{ marginTop: '16px' }}>
        <StatusTransitionControls ticket={ticket} onStatusChanged={handleStatusChanged} />
      </div>

      {/* Ticket content */}
      {editing && !isTerminal ? (
        <TicketEditForm
          ticket={ticket}
          users={users}
          onSaved={handleEditSaved}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '16px' }}>
            <h1 style={{ margin: 0, fontSize: '24px' }}>{ticket.title}</h1>
            {!isTerminal && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  fontSize: '13px',
                }}
              >
                Edit
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
            <PriorityBadge priority={ticket.priority} />
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              Created by {ticket.creator.name} • {formatRelativeTime(ticket.createdAt)}
            </span>
          </div>

          {ticket.assignee && (
            <p style={{ fontSize: '14px', color: '#374151', marginTop: '8px' }}>
              <strong>Assigned to:</strong> {ticket.assignee.name}
            </p>
          )}

          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.6' }}>
              {ticket.description}
            </p>
          </div>

          {isTerminal && (
            <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '13px', color: '#92400e' }}>
              This ticket is {ticket.status.toLowerCase()} — fields are read-only.
            </div>
          )}
        </div>
      )}

      {/* Comments section */}
      <div style={{ marginTop: '32px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>
          Comments ({ticket.comments.length})
        </h2>
        <CommentList comments={ticket.comments} />
        <CommentForm
          ticketId={ticket.id}
          users={users}
          onCommentAdded={handleCommentAdded}
        />
      </div>
    </div>
  );
}
