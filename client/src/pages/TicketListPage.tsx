import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listTickets } from '../api/tickets';
import { listUsers } from '../api/users';
import { ApiError } from '../api/client';
import type { Ticket, Status, Priority, User, PaginatedTicketsResponse } from '../api/types';
import { useDebounce } from '../hooks/useDebounce';
import SearchBar from '../components/SearchBar';
import TagFilter from '../components/TagFilter';
import TicketCard from '../components/TicketCard';
import EmptyState from '../components/EmptyState';
import ErrorDisplay from '../components/ErrorDisplay';

const ALL_PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TicketListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginatedTicketsResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [priority, setPriority] = useState<Priority | ''>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'priority'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [users, setUsers] = useState<User[]>([]);

  const pageSize = 10;

  const debouncedKeyword = useDebounce(keyword, 300);
  const debouncedTagIds = useDebounce(selectedTagIds, 300);

  // Fetch users for the assignedTo filter dropdown
  useEffect(() => {
    listUsers().then(setUsers).catch(() => {});
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedKeyword, status, debouncedTagIds, priority, assignedTo, sortBy, sortOrder]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: {
      keyword?: string;
      status?: Status;
      tag?: string;
      priority?: Priority;
      assignedTo?: string;
      sortBy?: 'updatedAt' | 'priority';
      sortOrder?: 'asc' | 'desc';
      page?: number;
      pageSize?: number;
    } = {};
    if (debouncedKeyword) params.keyword = debouncedKeyword;
    if (status) params.status = status;
    if (debouncedTagIds.length > 0) params.tag = debouncedTagIds.join(',');
    if (priority) params.priority = priority;
    if (assignedTo) params.assignedTo = assignedTo;
    params.sortBy = sortBy;
    params.sortOrder = sortOrder;
    params.page = currentPage;
    params.pageSize = pageSize;

    listTickets(params)
      .then((response) => {
        if (!cancelled) {
          setTickets(response.data);
          setPagination(response.pagination);
        }
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
  }, [debouncedKeyword, status, debouncedTagIds, currentPage, priority, assignedTo, sortBy, sortOrder]);

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

      <TagFilter
        selectedTagIds={selectedTagIds}
        onSelectionChange={setSelectedTagIds}
      />

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | '')}
          aria-label="Filter by priority"
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        >
          <option value="">All Priorities</option>
          {ALL_PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          aria-label="Filter by assignee"
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        >
          <option value="">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split('-') as ['updatedAt' | 'priority', 'asc' | 'desc'];
            setSortBy(field);
            setSortOrder(order);
          }}
          aria-label="Sort tickets"
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        >
          <option value="updatedAt-desc">Newest Updated</option>
          <option value="updatedAt-asc">Oldest Updated</option>
          <option value="priority-desc">Highest Priority</option>
          <option value="priority-asc">Lowest Priority</option>
        </select>
      </div>

      {error && (
        <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      )}

      {loading && <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading tickets...</p>}

      {!loading && !error && tickets.length === 0 && <EmptyState />}

      {!loading && !error && tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}

      {!loading && !error && pagination && pagination.totalPages > 1 && tickets.length > 0 && (
        <nav
          aria-label="Pagination"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            marginTop: '24px',
            padding: '16px 0',
          }}
        >
          <button
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={currentPage === 1}
            aria-label="Go to previous page"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: currentPage === 1 ? '#f3f4f6' : '#ffffff',
              color: currentPage === 1 ? '#9ca3af' : '#374151',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            Previous
          </button>
          <span style={{ color: '#374151', fontSize: '14px' }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={currentPage >= pagination.totalPages}
            aria-label="Go to next page"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: currentPage >= pagination.totalPages ? '#f3f4f6' : '#ffffff',
              color: currentPage >= pagination.totalPages ? '#9ca3af' : '#374151',
              cursor: currentPage >= pagination.totalPages ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
