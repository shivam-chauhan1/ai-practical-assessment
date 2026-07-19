import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listTickets } from '../api/tickets';
import { ApiError } from '../api/client';
import type { Ticket, Status } from '../api/types';
import { useDebounce } from '../hooks/useDebounce';
import SearchBar from '../components/SearchBar';
import TicketCard from '../components/TicketCard';
import EmptyState from '../components/EmptyState';
import ErrorDisplay from '../components/ErrorDisplay';

export default function TicketListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<Status | ''>('');

  const debouncedKeyword = useDebounce(keyword, 300);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: { keyword?: string; status?: Status } = {};
    if (debouncedKeyword) params.keyword = debouncedKeyword;
    if (status) params.status = status;

    listTickets(params)
      .then((data) => {
        if (!cancelled) setTickets(data);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err);
          } else {
            setError(new ApiError(0, 'NETWORK_ERROR', 'An unexpected error occurred'));
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedKeyword, status]);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }}>Tickets</h1>
        <Link
          to="/tickets/new"
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          + New Ticket
        </Link>
      </div>

      <SearchBar
        keyword={keyword}
        onKeywordChange={setKeyword}
        status={status}
        onStatusChange={setStatus}
      />

      {error && (
        <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      )}

      {loading && <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading tickets...</p>}

      {!loading && !error && tickets.length === 0 && <EmptyState />}

      {!loading && !error && tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}
