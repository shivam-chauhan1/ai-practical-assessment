import type { Status } from '../api/types';

const ALL_STATUSES: Status[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];

interface SearchBarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  status: Status | '';
  onStatusChange: (value: Status | '') => void;
}

export default function SearchBar({ keyword, onKeywordChange, status, onStatusChange }: SearchBarProps) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
      <input
        type="text"
        placeholder="Search tickets..."
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
      />
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as Status | '')}
        style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
      >
        <option value="">All Statuses</option>
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ')}
          </option>
        ))}
      </select>
    </div>
  );
}
