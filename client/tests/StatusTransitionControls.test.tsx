import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import StatusTransitionControls from '../src/components/StatusTransitionControls';
import type { Status, Ticket } from '../src/api/types';

// Mock the changeTicketStatus API
vi.mock('../src/api/tickets', () => ({
  changeTicketStatus: vi.fn(),
}));

const VALID_TRANSITIONS: Record<Status, Status[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

const TRANSITION_LABELS: Record<Status, string> = {
  IN_PROGRESS: 'Move to In Progress',
  RESOLVED: 'Mark Resolved',
  CLOSED: 'Close',
  CANCELLED: 'Cancel',
  OPEN: 'Reopen',
};

const ALL_STATUSES: Status[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];
const TERMINAL_STATUSES: Status[] = ['CLOSED', 'CANCELLED'];
const NON_TERMINAL_STATUSES: Status[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

function buildMockTicket(status: Status): Ticket {
  return {
    id: 'ticket-001',
    title: 'Test Ticket',
    description: 'A test ticket',
    status,
    priority: 'MEDIUM',
    createdBy: 'user-001',
    assignedTo: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    validTransitions: VALID_TRANSITIONS[status],
    creator: { id: 'user-001', name: 'Test User', email: 'test@example.com', role: 'AGENT', createdAt: '2025-01-01T00:00:00.000Z' },
    assignee: null,
  };
}

/**
 * **Property 13: Frontend shows only valid transitions for current status**
 * **Validates: Requirements 5.8, 5.9**
 */
describe('StatusTransitionControls - Property 13: Frontend shows only valid transitions for current status', () => {
  it('for non-terminal statuses, renders exactly the buttons defined in VALID_TRANSITIONS', () => {
    const statusArb = fc.constantFrom(...NON_TERMINAL_STATUSES);

    fc.assert(
      fc.property(statusArb, (status) => {
        const ticket = buildMockTicket(status);
        const { unmount } = render(
          <MemoryRouter>
            <StatusTransitionControls ticket={ticket} onStatusChanged={vi.fn()} />
          </MemoryRouter>
        );

        const expectedTransitions = VALID_TRANSITIONS[status];
        const expectedLabels = expectedTransitions.map((t) => TRANSITION_LABELS[t]);

        // Assert each expected button is rendered
        for (const label of expectedLabels) {
          expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        }

        // Assert no extra transition buttons are rendered
        const allButtons = screen.queryAllByRole('button');
        expect(allButtons).toHaveLength(expectedTransitions.length);

        unmount();
      }),
      { numRuns: 20 }
    );
  });

  it('for terminal statuses, renders no transition buttons', () => {
    const statusArb = fc.constantFrom(...TERMINAL_STATUSES);

    fc.assert(
      fc.property(statusArb, (status) => {
        const ticket = buildMockTicket(status);
        const { unmount } = render(
          <MemoryRouter>
            <StatusTransitionControls ticket={ticket} onStatusChanged={vi.fn()} />
          </MemoryRouter>
        );

        const allButtons = screen.queryAllByRole('button');
        expect(allButtons).toHaveLength(0);

        unmount();
      }),
      { numRuns: 10 }
    );
  });

  it('for any status, the number of buttons equals the length of validTransitions', () => {
    const statusArb = fc.constantFrom(...ALL_STATUSES);

    fc.assert(
      fc.property(statusArb, (status) => {
        const ticket = buildMockTicket(status);
        const { unmount } = render(
          <MemoryRouter>
            <StatusTransitionControls ticket={ticket} onStatusChanged={vi.fn()} />
          </MemoryRouter>
        );

        const allButtons = screen.queryAllByRole('button');
        expect(allButtons).toHaveLength(VALID_TRANSITIONS[status].length);

        unmount();
      }),
      { numRuns: 30 }
    );
  });
});
