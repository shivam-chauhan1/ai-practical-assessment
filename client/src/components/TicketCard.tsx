import { Link } from 'react-router-dom';
import type { Ticket } from '../api/types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { formatRelativeTime } from '../utils/formatTime';

export default function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      style={{
        display: 'block',
        padding: '16px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '8px',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>{ticket.title}</h3>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {formatRelativeTime(ticket.updatedAt)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        {ticket.assignee && (
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            → {ticket.assignee.name}
          </span>
        )}
      </div>
    </Link>
  );
}
