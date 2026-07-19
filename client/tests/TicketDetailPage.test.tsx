import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TicketDetailPage from '../src/pages/TicketDetailPage';
import { ApiError } from '../src/api/client';
import type { TicketWithComments, User } from '../src/api/types';

// Mock react-router-dom useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-id' }),
  };
});

// Mock API modules
vi.mock('../src/api/tickets', () => ({
  getTicket: vi.fn(),
  changeTicketStatus: vi.fn(),
  updateTicket: vi.fn(),
}));

vi.mock('../src/api/users', () => ({
  listUsers: vi.fn(),
}));

vi.mock('../src/api/comments', () => ({
  addComment: vi.fn(),
}));

import { getTicket, changeTicketStatus } from '../src/api/tickets';
import { listUsers } from '../src/api/users';
import { addComment } from '../src/api/comments';

const mockGetTicket = vi.mocked(getTicket);
const mockListUsers = vi.mocked(listUsers);
const mockChangeTicketStatus = vi.mocked(changeTicketStatus);
const mockAddComment = vi.mocked(addComment);

const mockUsers: User[] = [
  { id: 'user-1', name: 'John Admin', email: 'john@test.com', role: 'ADMIN', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'user-2', name: 'Jane Agent', email: 'jane@test.com', role: 'AGENT', createdAt: '2024-01-01T00:00:00Z' },
];

const mockTicket: TicketWithComments = {
  id: 'test-id',
  title: 'Test Ticket Title',
  description: 'Test ticket description',
  status: 'OPEN',
  priority: 'HIGH',
  createdBy: 'user-1',
  assignedTo: 'user-2',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  validTransitions: ['IN_PROGRESS', 'CANCELLED'],
  creator: { id: 'user-1', name: 'John Admin', email: 'john@test.com', role: 'ADMIN', createdAt: '2024-01-01T00:00:00Z' },
  assignee: { id: 'user-2', name: 'Jane Agent', email: 'jane@test.com', role: 'AGENT', createdAt: '2024-01-01T00:00:00Z' },
  comments: [
    { id: 'c1', body: 'First comment', ticketId: 'test-id', authorId: 'user-1', createdAt: '2024-01-01T12:00:00Z', author: { id: 'user-1', name: 'John Admin', email: 'john@test.com', role: 'ADMIN', createdAt: '2024-01-01T00:00:00Z' } },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <TicketDetailPage />
    </MemoryRouter>
  );
}

describe('TicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetTicket.mockReturnValue(new Promise(() => {})); // never resolves
    mockListUsers.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading ticket...')).toBeInTheDocument();
  });

  it('renders ticket details after successful fetch', async () => {
    mockGetTicket.mockResolvedValue(mockTicket);
    mockListUsers.mockResolvedValue(mockUsers);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Ticket Title')).toBeInTheDocument();
    });

    expect(screen.getByText('Test ticket description')).toBeInTheDocument();
    // Creator name appears in the "Created by" line
    expect(screen.getByText(/Created by John Admin/)).toBeInTheDocument();
    // Assignee name appears in the "Assigned to:" paragraph
    expect(screen.getByText(/Assigned to:/)).toBeInTheDocument();
    expect(screen.getAllByText(/Jane Agent/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders comments list', async () => {
    mockGetTicket.mockResolvedValue(mockTicket);
    mockListUsers.mockResolvedValue(mockUsers);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('First comment')).toBeInTheDocument();
    });

    expect(screen.getByText('Comments (1)')).toBeInTheDocument();
  });

  it('shows 404 error state when API returns NOT_FOUND', async () => {
    mockGetTicket.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Ticket not found'));
    mockListUsers.mockResolvedValue(mockUsers);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });

  it('Edit button toggles to edit form for non-terminal tickets', async () => {
    mockGetTicket.mockResolvedValue(mockTicket);
    mockListUsers.mockResolvedValue(mockUsers);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Ticket Title')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: 'Edit' });
    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    // After clicking Edit, the edit form should appear (TicketEditForm renders TicketForm with a "Save Changes" button)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  it('does not show Edit button for terminal-state tickets (CLOSED)', async () => {
    const closedTicket: TicketWithComments = {
      ...mockTicket,
      status: 'CLOSED',
      validTransitions: [],
    };
    mockGetTicket.mockResolvedValue(closedTicket);
    mockListUsers.mockResolvedValue(mockUsers);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Ticket Title')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('does not show Edit button for terminal-state tickets (CANCELLED)', async () => {
    const cancelledTicket: TicketWithComments = {
      ...mockTicket,
      status: 'CANCELLED',
      validTransitions: [],
    };
    mockGetTicket.mockResolvedValue(cancelledTicket);
    mockListUsers.mockResolvedValue(mockUsers);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Ticket Title')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('shows read-only notice for terminal-state tickets', async () => {
    const closedTicket: TicketWithComments = {
      ...mockTicket,
      status: 'CLOSED',
      validTransitions: [],
    };
    mockGetTicket.mockResolvedValue(closedTicket);
    mockListUsers.mockResolvedValue(mockUsers);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Ticket Title')).toBeInTheDocument();
    });

    expect(screen.getByText(/fields are read-only/i)).toBeInTheDocument();
  });
});
