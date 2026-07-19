# Acceptance Criteria

## Core

- [x] Ticket can be created with title, description, priority, createdBy, and optional assignedTo
- [x] Newly created tickets always have status OPEN
- [x] Tickets can be listed, ordered by updatedAt descending
- [x] Single ticket can be retrieved by ID with all comments included (ordered createdAt ascending)
- [x] Ticket fields (title, description, priority, assignedTo) can be updated via PATCH
- [x] Assignee can be cleared by setting assignedTo to null
- [x] Status transitions enforce the exact state machine: OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED, OPEN→CANCELLED, IN_PROGRESS→CANCELLED
- [x] Any transition not in the valid set is rejected with 400 and error code `INVALID_TRANSITION`
- [x] Invalid transition error message lists the valid transitions from the current status
- [x] Terminal-state tickets (CLOSED, CANCELLED) reject field updates with 403 `TICKET_LOCKED`
- [x] Comments can be added to tickets in any status, including terminal states
- [x] Adding a comment does NOT update the ticket's updatedAt timestamp
- [x] Keyword search matches case-insensitive substrings in title or description
- [x] Status filter returns only tickets matching the specified status
- [x] Keyword and status filter combine as logical AND in a single request
- [x] All data persists in PostgreSQL and survives application restarts
- [x] Priority and Status are backed by native PostgreSQL enums, not free-text strings
- [x] assignedTo, createdBy, and authorId are foreign key references to User.id

## Validation

- [x] All request bodies validated by Zod schemas before reaching controller logic
- [x] Title: 3–200 characters after trim; shorter or longer rejected with field-level error
- [x] Description: 1–5,000 characters after trim
- [x] Comment body: 1–2,000 characters after trim
- [x] Whitespace-only strings fail validation after trim (treated as empty)
- [x] Invalid priority enum value rejected with 400 VALIDATION_ERROR
- [x] Invalid status enum value rejected with 400 VALIDATION_ERROR (distinct from INVALID_TRANSITION)
- [x] Non-existent user reference (createdBy or assignedTo) rejected with 404 NOT_FOUND
- [x] Non-existent ticket ID rejected with 404 NOT_FOUND
- [x] Status field in PATCH /tickets/:id body is silently ignored (never changes status)
- [x] UUID path parameters validated (non-UUID returns 400)

## Error Handling

- [x] All error responses use consistent shape: `{ error: { code, message, details? } }`
- [x] VALIDATION_ERROR (400) includes per-field details array from Zod
- [x] INVALID_TRANSITION (400) includes valid transitions in the message (no details array)
- [x] TICKET_LOCKED (403) returns distinct error code for terminal-state lock
- [x] NOT_FOUND (404) returned for missing tickets, users, or tags
- [x] No stack traces or raw database error details leaked to clients (500 returns generic message)
- [x] Prisma P2025 errors mapped to 404 NOT_FOUND
- [x] Frontend displays validation errors with field-specific messages
- [x] Frontend displays not-found state for 404 responses
- [x] Frontend displays network error banner when server is unreachable
- [x] Frontend displays TICKET_LOCKED as distinct amber banner (not generic red)
- [x] Frontend never silently swallows errors — all API failures surfaced to user

## Testing

- [x] All 5 valid state-machine transitions tested via HTTP endpoint (persist and re-fetch)
- [x] All 15+ invalid transitions tested — response is 400 AND status unchanged after re-fetch
- [x] Invalid enum value ("BOGUS") tested — returns VALIDATION_ERROR, status unchanged
- [x] Property-based tests (fast-check) for state machine: valid transitions return true, invalid return false
- [x] Property-based tests for terminal-state lock: random update payloads on CLOSED/CANCELLED throw TicketLockedError
- [x] Property-based tests for comment bypass: comments succeed on tickets in any status
- [x] Property-based tests for title length validation: out-of-bounds titles rejected
- [x] Property-based tests for keyword search: results contain only matching tickets
- [x] Integration tests for CRUD endpoints: create, list, get, update (happy + sad paths)
- [x] Integration test confirming PATCH body with `status` field does not change ticket status
- [x] Edge-case tests: whitespace-only inputs, SQL special characters in search, boundary lengths
- [x] Frontend component tests: StatusTransitionControls renders correct buttons per status
- [x] Frontend component tests: ErrorDisplay renders each error code correctly
- [x] Unit tests for state machine module in isolation (table-driven, all 25 pairs)
- [x] Tests run against real PostgreSQL (not mocks) for integration tier
- [x] CI pipeline runs full test suite on every push via GitHub Actions

## Documentation

- [x] README.md with project description, tech stack, prerequisites, setup steps, and how to run tests
- [x] api-contract.md with full endpoint specification reconciled to actual implementation
- [x] data-model.md with entity schemas, relationships, enums, indexes, and migration history
- [x] ui-flow.md describing user flows and error states for every page
- [x] test-strategy.md explaining what's tested, what's not, and why
- [x] requirements-analysis.md with functional/non-functional requirements, assumptions, and edge cases
- [x] candidate-info.md with project summary, tools used, and setup instructions
- [x] ai-prompts/ directory with categorized prompt logs (planning, design, implementation, testing, code-review, debugging, documentation)
- [x] tool-specific/kiro-specs/ with full spec artifacts (requirements.md, design.md, tasks.md) for all 5 features
- [x] .kiro/steering/ with persistent project context (product.md, tech.md, structure.md)
- [x] OpenAPI interactive documentation served at /api-docs (stretch)
