import { Status } from '@prisma/client';
import {
  isValidTransition,
  getValidTransitions,
  isTerminalState,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
} from '../src/services/stateMachine';

/**
 * Table-driven unit tests for the ticket state machine.
 * No database, no Express — pure function assertions.
 */

const ALL_STATUSES: Status[] = [
  Status.OPEN,
  Status.IN_PROGRESS,
  Status.RESOLVED,
  Status.CLOSED,
  Status.CANCELLED,
];

describe('stateMachine – isValidTransition (table-driven)', () => {
  // Build the complete 5×5 truth table
  const table: Array<{ from: Status; to: Status; expected: boolean }> = [];
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      table.push({ from, to, expected: VALID_TRANSITIONS[from].includes(to) });
    }
  }

  // --- Valid transitions (expected: true) ---
  describe('valid transitions', () => {
    const validCases = table.filter((t) => t.expected);

    it.each(validCases)(
      '$from → $to should be ALLOWED',
      ({ from, to }) => {
        expect(isValidTransition(from, to)).toBe(true);
      }
    );
  });

  // --- Invalid transitions (expected: false) ---
  describe('invalid transitions', () => {
    const invalidCases = table.filter((t) => !t.expected);

    it.each(invalidCases)(
      '$from → $to should be REJECTED',
      ({ from, to }) => {
        expect(isValidTransition(from, to)).toBe(false);
      }
    );
  });

  // Sanity: exactly 5 valid transitions exist per the business rules
  it('has exactly 5 valid transitions defined', () => {
    const validCount = table.filter((t) => t.expected).length;
    expect(validCount).toBe(5);
  });
});

describe('stateMachine – getValidTransitions', () => {
  it('OPEN → [IN_PROGRESS, CANCELLED]', () => {
    expect(getValidTransitions(Status.OPEN)).toEqual(
      expect.arrayContaining([Status.IN_PROGRESS, Status.CANCELLED])
    );
    expect(getValidTransitions(Status.OPEN)).toHaveLength(2);
  });

  it('IN_PROGRESS → [RESOLVED, CANCELLED]', () => {
    expect(getValidTransitions(Status.IN_PROGRESS)).toEqual(
      expect.arrayContaining([Status.RESOLVED, Status.CANCELLED])
    );
    expect(getValidTransitions(Status.IN_PROGRESS)).toHaveLength(2);
  });

  it('RESOLVED → [CLOSED]', () => {
    expect(getValidTransitions(Status.RESOLVED)).toEqual([Status.CLOSED]);
  });

  it('CLOSED → [] (terminal)', () => {
    expect(getValidTransitions(Status.CLOSED)).toEqual([]);
  });

  it('CANCELLED → [] (terminal)', () => {
    expect(getValidTransitions(Status.CANCELLED)).toEqual([]);
  });
});

describe('stateMachine – isTerminalState', () => {
  it.each([Status.CLOSED, Status.CANCELLED])('%s is terminal', (status) => {
    expect(isTerminalState(status)).toBe(true);
  });

  it.each([Status.OPEN, Status.IN_PROGRESS, Status.RESOLVED])(
    '%s is NOT terminal',
    (status) => {
      expect(isTerminalState(status)).toBe(false);
    }
  );
});

describe('stateMachine – TERMINAL_STATES constant', () => {
  it('contains exactly CLOSED and CANCELLED', () => {
    expect(TERMINAL_STATES).toHaveLength(2);
    expect(TERMINAL_STATES).toContain(Status.CLOSED);
    expect(TERMINAL_STATES).toContain(Status.CANCELLED);
  });
});
