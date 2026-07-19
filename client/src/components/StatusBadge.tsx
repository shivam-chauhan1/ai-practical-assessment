import type { Status } from '../api/types';

const STATUS_COLORS: Record<Status, string> = {
  OPEN: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#10b981',
  CLOSED: '#6b7280',
  CANCELLED: '#ef4444',
};

const STATUS_LABELS: Record<Status, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      style={{
        backgroundColor: STATUS_COLORS[status],
        color: 'white',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
