import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Ticket, Status, Priority, Role } from '../src/api/types';
import { ApiError } from '../src/api/client';

// Mock the tickets API module
vi.mock('../src/api/tickets', () => ({
  listTickets: vi.fn(),
}));

// Mock the tags API module (used by TagFilter)
vi.mock('../src/api/tags', () => ({
  listTags: vi.fn().mockResolvedValue([]),
}));

// Mock the users API module (used by assignedTo filter)
vi.mock('../src/api/users', () => ({
  listUsers: vi.fn().mockResolvedValue([]),
}));

// Mock useDebounce to return the value immediately (no delay)
vi.mock('../src/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}));

import { listTickets } from '../src/api/tickets';
import TicketListPage from '../src/pages/TicketListPage';

const mockListTickets = listTickets as ReturnType<typeof vi.fn>;

const mockTicket: Ticket = {
  id: '123',
  title: 'Test Ticket',
  description: 'Test description',
  status: 'OPEN' as Status,
  priority: 'HIGH' as Priority,
  createdBy: 'user-1',
  assignedTo: 'user-2',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  validTransitions: ['IN_PROGRESS', 'CANCELLED'] as Status[],
  creator: { id: 'user-1', name: 'John Admin', email: 'john@test.com', role: 'ADMIN' as Role, createdAt: '2024-01-01T00:00:00Z' },
  assignee: { id: 'user-2', name: 'Jane Agent', email: 'jane@test.com', role: 'AGENT' as Role, createdAt: '2024-01-01T00:00:00Z' },
  tags: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <TicketListPage />
    </MemoryRouter>
  );
}

describe('TicketListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockListTickets.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByText('Loading tickets...')).toBeInTheDocument();
  });

  it('renders ticket cards after successful fetch', async () => {
    mockListTickets.mockResolvedValue({ data: [mockTicket], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Test Ticket')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading tickets...')).not.toBeInTheDocument();
  });

  it('renders empty state when API returns empty array', async () => {
    mockListTickets.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No tickets found.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading tickets...')).not.toBeInTheDocument();
  });

  it('renders error display when API throws ApiError', async () => {
    mockListTickets.mockRejectedValue(new ApiError(500, 'NETWORK_ERROR', 'Server is unavailable. Please try again later.'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading tickets...')).not.toBeInTheDocument();
  });

  it('search input triggers refetch with keyword', async () => {
    mockListTickets.mockResolvedValue({ data: [mockTicket], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } });
    renderPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Ticket')).toBeInTheDocument();
    });

    // Type in search input
    const searchInput = screen.getByPlaceholderText('Search tickets...');
    fireEvent.change(searchInput, { target: { value: 'bug' } });

    // Since useDebounce is mocked to return immediately, listTickets should be called with keyword
    await waitFor(() => {
      expect(mockListTickets).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'bug', page: 1, pageSize: 10, sortBy: 'updatedAt', sortOrder: 'desc' })
      );
    });
  });

  it('status filter triggers refetch with status', async () => {
    mockListTickets.mockResolvedValue({ data: [mockTicket], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } });
    renderPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Ticket')).toBeInTheDocument();
    });

    // Change status filter
    const statusSelect = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusSelect, { target: { value: 'OPEN' } });

    // listTickets should be called with status filter
    await waitFor(() => {
      expect(mockListTickets).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'OPEN', page: 1, pageSize: 10, sortBy: 'updatedAt', sortOrder: 'desc' })
      );
    });
  });

  it('priority filter triggers refetch with priority', async () => {
    mockListTickets.mockResolvedValue({ data: [mockTicket], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Ticket')).toBeInTheDocument();
    });

    const prioritySelect = screen.getByLabelText('Filter by priority');
    fireEvent.change(prioritySelect, { target: { value: 'HIGH' } });

    await waitFor(() => {
      expect(mockListTickets).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'HIGH', page: 1, pageSize: 10 })
      );
    });
  });

  it('sort control triggers refetch with sort params', async () => {
    mockListTickets.mockResolvedValue({ data: [mockTicket], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Ticket')).toBeInTheDocument();
    });

    const sortSelect = screen.getByLabelText('Sort tickets');
    fireEvent.change(sortSelect, { target: { value: 'priority-desc' } });

    await waitFor(() => {
      expect(mockListTickets).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'priority', sortOrder: 'desc', page: 1, pageSize: 10 })
      );
    });
  });
});
