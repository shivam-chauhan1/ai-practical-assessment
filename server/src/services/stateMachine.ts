import { Status } from '@prisma/client';

export const VALID_TRANSITIONS: Record<Status, Status[]> = {
  OPEN: [Status.IN_PROGRESS, Status.CANCELLED],
  IN_PROGRESS: [Status.RESOLVED, Status.CANCELLED],
  RESOLVED: [Status.CLOSED],
  CLOSED: [],
  CANCELLED: [],
};

export const TERMINAL_STATES: Status[] = [Status.CLOSED, Status.CANCELLED];

export function isValidTransition(from: Status, to: Status): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function isTerminalState(status: Status): boolean {
  return TERMINAL_STATES.includes(status);
}

export function getValidTransitions(currentStatus: Status): Status[] {
  return VALID_TRANSITIONS[currentStatus];
}
