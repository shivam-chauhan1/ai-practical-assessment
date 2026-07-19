import fc from 'fast-check';
import { Status } from '@prisma/client';
import { VALID_TRANSITIONS, isValidTransition } from '../src/services/stateMachine';

const ALL_STATUSES: Status[] = [
  Status.OPEN,
  Status.IN_PROGRESS,
  Status.RESOLVED,
  Status.CLOSED,
  Status.CANCELLED,
];

/**
 * Property 3: Valid state-machine transitions succeed
 *
 * For any valid (from, to) pair in the VALID_TRANSITIONS map,
 * isValidTransition(from, to) returns true.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 */
describe('State Machine - Property Tests', () => {
  // Build all valid (from, to) pairs from the VALID_TRANSITIONS map
  const validPairs: Array<{ from: Status; to: Status }> = [];
  for (const [from, targets] of Object.entries(VALID_TRANSITIONS)) {
    for (const to of targets) {
      validPairs.push({ from: from as Status, to });
    }
  }

  it('Property 3: all valid (from, to) pairs in VALID_TRANSITIONS are accepted by isValidTransition', () => {
    // Precondition: there are valid pairs to test
    expect(validPairs.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.constantFrom(...validPairs),
        (pair) => {
          expect(isValidTransition(pair.from, pair.to)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Invalid state-machine transitions are rejected
   *
   * For any (from, to) pair where `to` is NOT in VALID_TRANSITIONS[from],
   * isValidTransition(from, to) returns false.
   *
   * **Validates: Requirements 5.6**
   */
  describe('Property 4: Invalid state-machine transitions are rejected', () => {
    // Build all invalid (from, to) pairs — every pair NOT in VALID_TRANSITIONS
    const invalidPairs: Array<{ from: Status; to: Status }> = [];
    for (const from of ALL_STATUSES) {
      const validTargets = VALID_TRANSITIONS[from];
      for (const to of ALL_STATUSES) {
        if (!validTargets.includes(to)) {
          invalidPairs.push({ from, to });
        }
      }
    }

    it('all invalid (from, to) pairs are rejected by isValidTransition', () => {
      // Precondition: there are invalid pairs to test
      expect(invalidPairs.length).toBeGreaterThan(0);

      fc.assert(
        fc.property(
          fc.constantFrom(...invalidPairs),
          (pair) => {
            expect(isValidTransition(pair.from, pair.to)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
