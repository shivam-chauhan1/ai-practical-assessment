import type { Priority } from '../api/types';

const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: '#6b7280',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      style={{
        border: `1px solid ${PRIORITY_COLORS[priority]}`,
        color: PRIORITY_COLORS[priority],
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
