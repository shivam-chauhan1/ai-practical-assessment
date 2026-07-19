# Implementation Plan: Support Ticket Core

## Overview

This plan implements a full-stack support ticket management system with an Express/TypeScript backend and React/TypeScript frontend in a monorepo layout (`/server` and `/client`). The backend enforces a strict state-machine lifecycle, validates all input with Zod, and returns a consistent `ApiErrorResponse` shape. The frontend surfaces tickets, comments, transitions, and errors to internal staff. Tasks are ordered so each builds on prior work, with backend fully implemented before frontend begins.

## Tasks

- [x] 1. Prisma schema, migration, and seed script
  - [x] 1.1 Create Prisma schema with User, Ticket, Comment models and native PG enums (Status, Priority, Role)
    - Initialize `server/prisma/schema.prisma` with generator, datasource, enums (Status, Priority, Role), and all three models with relations and field constraints as defined in the design
    - Run `npx prisma migrate dev` to generate the initial migration
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 1.2 Add GIN trigram index migration for keyword search
    - Create a raw SQL migration file enabling `pg_trgm` extension and adding a GIN index on `(title || ' ' || description)` with `gin_trgm_ops`
    - _Requirements: 7.1_
  - [x] 1.3 Create seed script with User data
    - Write `server/prisma/seed.ts` that upserts at least 2 Users (one ADMIN, one AGENT) with stable UUIDs for use in development and testing
    - Configure the `prisma.seed` command in `server/package.json`
    - _Requirements: 8.3_

- [x] 2. Backend project setup
  - [x] 2.1 Initialize server package and TypeScript configuration
    - Create `server/package.json` with dependencies (express, @prisma/client, zod, cors, uuid) and devDependencies (typescript, ts-node, @types/express, jest, ts-jest, supertest, @types/supertest, fast-check)
    - Create `server/tsconfig.json` with strict mode, ESNext target, Node module resolution
    - _Requirements: 8.1, 9.1_
  - [x] 2.2 Create config module, custom error classes, and middleware skeleton
    - Implement `server/src/config/index.ts` — reads DATABASE_URL, PORT, NODE_ENV from env, validates, and exports typed config object
    - Implement `server/src/errors/index.ts` — AppError base class, NotFoundError, ValidationError, TicketLockedError, InvalidTransitionError (as defined in design)
    - Implement `server/src/middleware/errorHandler.ts` — catches all errors, formats into `ApiErrorResponse` shape, handles custom error classes
    - _Requirements: 9.4, 10.1, 10.2, 10.3, 11.5_
  - [x] 2.3 Create Express app entry point with route mounting and middleware
    - Implement `server/src/app.ts` — Express app with JSON body parsing, CORS, route mounting under `/api`, and error handler middleware at the end
    - Implement `server/src/index.ts` — imports app, starts listening on configured port
    - _Requirements: 8.1_

- [x] 3. Backend validation schemas and validation middleware
  - [x] 3.1 Implement Zod validation schemas for tickets and comments
    - Create `server/src/schemas/ticketSchemas.ts` with createTicketSchema, updateTicketSchema, changeStatusSchema, listTicketsQuerySchema (as defined in design)
    - Create `server/src/schemas/commentSchemas.ts` with createCommentSchema
    - All schemas apply `.trim()` before length validation
    - _Requirements: 9.1, 9.2, 9.3, 1.3, 1.4, 1.5, 4.3, 4.4, 4.5, 5.7, 6.4, 7.4_
  - [x] 3.2 Implement generic validation middleware
    - Create `server/src/middleware/validate.ts` — accepts a ZodSchema and source ('body' | 'query'), parses input, replaces req source with trimmed/parsed data on success, throws ValidationError with formatted details on failure
    - _Requirements: 9.1, 9.4_

- [x] 4. Ticket CRUD service and controller
  - [x] 4.1 Implement ticket service (create, list, getById, update)
    - Create `server/src/services/ticketService.ts`
    - `createTicket`: validates user references exist (createdBy, assignedTo), persists ticket with status OPEN, returns ticket with validTransitions
    - `listTickets`: accepts optional keyword and status filters, uses Prisma `contains` with `mode: 'insensitive'` for keyword search, applies AND logic, orders by updatedAt desc, includes creator/assignee
    - `getTicketById`: fetches ticket with comments (ordered createdAt asc) and creator/assignee, throws NotFoundError if missing
    - `updateTicket`: checks ticket exists (404), checks terminal state (throws TicketLockedError), validates assignedTo reference if provided, persists changes, returns updated ticket
    - IMPORTANT: `updateTicket` accepts only title, description, priority, assignedTo — createdBy is NEVER editable (not in updateTicketSchema)
    - IMPORTANT: assignedTo is nullable — setting it to null unassigns the ticket
    - _Requirements: 1.1, 1.6, 2.1, 3.1, 3.2, 4.1, 4.2, 4.6, 4.7, 4.8, 7.1, 7.2, 7.3, 11.1_
  - [x] 4.2 Implement ticket controller and routes
    - Create `server/src/controllers/ticketController.ts` — createTicket, listTickets, getTicket, updateTicket handlers that call service and format responses
    - Create `server/src/routes/ticketRoutes.ts` — POST `/tickets`, GET `/tickets`, GET `/tickets/:id`, PATCH `/tickets/:id` with appropriate validation middleware attached
    - Wire routes into the main app
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 3.2, 4.1, 4.7_

- [x] 5. Status-transition service logic (depends on task 4)
  - [x] 5.1 Implement state machine module
    - Create `server/src/services/stateMachine.ts` with VALID_TRANSITIONS map, TERMINAL_STATES array, isValidTransition(), isTerminalState(), getValidTransitions() — exactly as specified in design
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 11.1_
  - [x] 5.2 Implement changeTicketStatus service function
    - Add `changeTicketStatus(id, newStatus)` to ticketService — fetches ticket (throws NotFoundError if missing), calls isValidTransition, throws InvalidTransitionError with valid transitions message if invalid, persists new status, returns updated ticket with validTransitions
    - Depends on ticket CRUD service (task 4) being in place so the ticket can be fetched and the terminal-state lock (used by updateTicket) is already established
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 6. Status-transition controller and route (depends on tasks 4, 5)
  - [x] 6.1 Implement status-change controller and wire PATCH route
    - Add `changeStatus` handler to `server/src/controllers/ticketController.ts` — calls changeTicketStatus service, returns updated ticket
    - Add PATCH `/tickets/:id/status` route with changeStatusSchema validation middleware (from task 3)
    - Depends on ticket controller/routes (task 4.2) being wired so the route file exists to extend
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 7. Comment service and controller
  - [x] 7.1 Implement comment service
    - Create `server/src/services/commentService.ts` — `addComment(data)`: validates ticket exists (404), validates authorId exists (404), persists comment (allowed on any ticket status including terminal), returns comment with author info
    - IMPORTANT: addComment writes ONLY to the Comment table — it MUST NOT update the Ticket row (Ticket.updatedAt must be unaffected by new comments)
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 11.2_
  - [x] 7.2 Implement comment controller and routes
    - Create `server/src/controllers/commentController.ts` — addComment handler
    - Create `server/src/routes/commentRoutes.ts` — POST `/tickets/:id/comments` with createCommentSchema validation middleware
    - Wire into main app
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Checkpoint — Backend core complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. State-machine property-based tests
  - [x] 9.1 Write property test: Valid state-machine transitions succeed
    - **Property 3: Valid state-machine transitions succeed**
    - Generate all valid (from, to) pairs from VALID_TRANSITIONS map, assert isValidTransition returns true for each
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
  - [x] 9.2 Write property test: Invalid state-machine transitions are rejected
    - **Property 4: Invalid state-machine transitions are rejected**
    - Generate all (from, to) pairs NOT in VALID_TRANSITIONS map, assert isValidTransition returns false for each
    - **Validates: Requirements 5.6**
  - [x] 9.3 Write property test: Terminal-state tickets reject field updates
    - **Property 5: Terminal-state tickets reject field updates with TICKET_LOCKED**
    - Use fast-check to generate random UpdateTicketInput on CLOSED/CANCELLED tickets, assert TicketLockedError is thrown
    - **Validates: Requirements 4.8, 11.1, 11.5**
  - [x] 9.4 Write property test: Comments bypass terminal-state lock
    - **Property 6: Comments bypass terminal-state lock**
    - Use fast-check to generate random valid comment bodies on tickets in any status (including CLOSED/CANCELLED), assert comment is persisted successfully
    - **Validates: Requirements 6.1, 6.2, 11.2**
  - [x] 9.5 Write property test: Created tickets always start in OPEN status
    - **Property 1: Created tickets always start in OPEN status**
    - Use fast-check to generate random valid CreateTicketInput, assert resulting ticket has status OPEN
    - **Validates: Requirements 1.1**

- [x] 10. Backend API integration tests
  - [x] 10.1 Write integration tests for ticket CRUD endpoints
    - Test POST /api/tickets (success, validation errors, invalid references)
    - Test GET /api/tickets (list all, keyword search, status filter, combined filter)
    - Test GET /api/tickets/:id (success, 404)
    - Test PATCH /api/tickets/:id (success, validation errors, terminal lock 403, 404)
    - Verify all error responses match ApiErrorResponse shape
    - **Property 2: Title length validation rejects out-of-bounds values**
    - **Property 8: Ticket list ordering**
    - **Validates: Requirements 1.1–1.6, 2.1, 3.1, 3.2, 4.1–4.8, 7.1–7.4, 9.1–9.5**
  - [x] 10.2 Write integration tests for status-transition endpoint
    - Test PATCH /api/tickets/:id/status for all valid transitions
    - Test invalid transitions return INVALID_TRANSITION error with valid options
    - Test invalid enum values return VALIDATION_ERROR
    - Test 404 for non-existent ticket
    - Verify error response shape consistency
    - **Validates: Requirements 5.1–5.7**
  - [x] 10.3 Write integration tests for comment endpoint
    - Test POST /api/tickets/:id/comments (success, validation errors, 404)
    - Test comments allowed on terminal-state tickets
    - **Property 7: Comment body length validation**
    - **Property 9: Comments ordered by creation time**
    - **Validates: Requirements 6.1–6.5, 11.2**
  - [x] 10.4 Write property tests for search/filter correctness
    - **Property 10: Keyword search returns only matching tickets**
    - **Property 11: Status filter returns only matching tickets**
    - **Property 12: Combined search filters apply as logical AND**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 11. Checkpoint — Backend fully tested
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Frontend project setup
  - [x] 12.1 Initialize client package with Vite, React, TypeScript, React Router
    - Create `client/` with Vite React-TS template
    - Install dependencies: react-router-dom
    - Install dev dependencies: @testing-library/react, @testing-library/jest-dom, vitest, jsdom, fast-check
    - Configure Vite proxy to forward `/api` requests to backend
    - Set up React Router with routes: `/` (list), `/tickets/new` (create), `/tickets/:id` (detail)
    - _Requirements: 2.2, 3.3, 7.5_

- [x] 13. Frontend API layer
  - [x] 13.1 Implement API client and typed fetch wrappers
    - Create `client/src/api/client.ts` — base `apiRequest<T>` function that handles JSON parsing, detects non-2xx responses, parses ApiErrorResponse, throws ApiError, catches network TypeError and converts to NETWORK_ERROR ApiError
    - Create `client/src/api/tickets.ts` — createTicket, listTickets, getTicket, updateTicket, changeTicketStatus functions with typed request/response
    - Create `client/src/api/comments.ts` — addComment function
    - Define shared TypeScript types for all request/response interfaces
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 14. Ticket list page with search and filter UI
  - [x] 14.1 Implement TicketListPage with search/filter controls
    - Create `client/src/pages/TicketListPage.tsx` — fetches and displays tickets, includes SearchBar component (keyword input + status dropdown), shows TicketCard for each result, shows EmptyState when no results
    - Create `client/src/components/SearchBar.tsx` — keyword text input and status filter dropdown, triggers combined query on change/submit
    - Create `client/src/components/TicketCard.tsx` — displays title, status badge, priority badge, assignee name, updatedAt
    - Create `client/src/components/StatusBadge.tsx` and `client/src/components/PriorityBadge.tsx`
    - Create `client/src/components/EmptyState.tsx`
    - _Requirements: 2.2, 2.3, 7.5, 7.6_

- [x] 15. Ticket detail page — read-only view with comments
  - [x] 15.1 Implement TicketDetailPage with read-only ticket view and comments
    - Create `client/src/pages/TicketDetailPage.tsx` — fetches ticket by ID, displays all fields read-only (title, description, status, priority, assignee, creator, timestamps), renders CommentList and CommentForm, handles 404 with not-found state
    - Create `client/src/components/CommentList.tsx` — ordered list of comments showing body, author name, createdAt
    - Create `client/src/components/CommentForm.tsx` — text input for new comment, submits via API, appends new comment to list without full page reload
    - This task is purely the read-only detail view and comment interaction — no edit mode, no status controls
    - _Requirements: 3.3, 3.4, 6.6, 6.7_

- [x] 16. Ticket detail page — status transition controls
  - [x] 16.1 Implement StatusTransitionControls on detail page
    - Create `client/src/components/StatusTransitionControls.tsx` using the detailed component sketch from design.md:
      - Props: `currentStatus`, `validTransitions` (from API response), `onTransition` (async callback), `isLoading`
      - Internal state: `pendingTarget` (which button was clicked), `error` (failed transition message)
      - Static `TRANSITION_LABELS` map for button text: "Move to In Progress", "Mark Resolved", "Close", "Cancel"
      - Always render a read-only `<StatusBadge>` showing current status
      - Render one button per entry in `validTransitions` — no dropdown, no free-form status selection
      - If `validTransitions` is empty (terminal state), render no buttons
      - Disable all buttons while `isLoading`; show spinner on `pendingTarget` button
      - On error, display the error message inline; clear on next prop change or success
    - Wire into TicketDetailPage so status buttons appear below the ticket status badge
    - Parent (TicketDetailPage) owns the `onTransition` handler: calls `changeTicketStatus` API, re-fetches ticket on success
    - On successful transition, new `currentStatus` + `validTransitions` flow in via props automatically
    - _Requirements: 5.8, 5.9, 5.10_

- [x] 17. Create ticket page and form
  - [x] 17.1 Implement CreateTicketPage with ticket form
    - Create `client/src/pages/CreateTicketPage.tsx` — renders TicketForm in create mode, on success navigates to ticket list
    - Create `client/src/components/TicketForm.tsx` — shared form component with title, description, priority dropdown, assignee dropdown (fetches users), submit handler; used for both create and edit
    - On successful creation, display the new ticket in the list
    - _Requirements: 1.7, 1.8_

- [x] 18. Ticket edit form
  - [x] 18.1 Implement edit functionality on detail page
    - Add edit mode to TicketDetailPage using TicketForm in edit mode — pre-populates fields, submits PATCH update
    - Render fields as read-only when ticket is in terminal state (CLOSED/CANCELLED)
    - On successful update, refresh ticket detail display
    - _Requirements: 4.9, 4.10, 11.3, 11.4_

- [x] 19. Error display component and error handling integration
  - [x] 19.1 Implement ErrorDisplay component and wire into all pages
    - Create `client/src/components/ErrorDisplay.tsx` — handles VALIDATION_ERROR (shows field-specific messages), NOT_FOUND, TICKET_LOCKED (specific locked message), INVALID_TRANSITION, NETWORK_ERROR (server unavailable message)
    - Integrate ErrorDisplay into all pages and forms — never silently swallow errors
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.4_

- [x] 20. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Frontend component tests
  - [x] 21.1 Write property test for StatusTransitionControls
    - **Property 13: Frontend shows only valid transitions for current status**
    - For each non-terminal status, assert component renders exactly the buttons defined in VALID_TRANSITIONS; for terminal statuses, assert no buttons rendered
    - **Validates: Requirements 5.8, 5.9**
  - [x] 21.2 Write component tests for ErrorDisplay
    - Test rendering of each error code type (VALIDATION_ERROR with details, NOT_FOUND, TICKET_LOCKED, INVALID_TRANSITION, NETWORK_ERROR)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 21.3 Write component tests for TicketListPage
    - Test ticket list rendering, search interaction, filter interaction, empty state display, error state display
    - _Requirements: 2.2, 2.3, 7.5, 7.6_
  - [x] 21.4 Write component tests for TicketDetailPage
    - Test detail rendering, comment display, comment form submission, 404 state, edit mode toggling, read-only fields on terminal tickets
    - _Requirements: 3.3, 3.4, 6.6, 11.3_

- [x] 22. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- Unit/integration tests validate specific examples, edge cases, and HTTP-level behavior using Jest + Supertest
- Backend tasks (1–11) are fully independent from frontend tasks (12–22)
- No task mixes backend and frontend code
- The state-machine module (task 5) is standalone and independently verifiable
- The state-machine tests (task 9) are standalone and separate from implementation tasks
- The Prisma schema + migration + seed (task 1) is standalone
- Task 5 (status-transition) depends on task 4 (ticket CRUD) — the validation middleware and ticket service must exist first
- Task 6 (status-transition controller) depends on both tasks 4 and 5
- Frontend detail page is split: task 15 (read-only view + comments) and task 16 (status-transition controls) for independent review

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "5.1"] },
    { "id": 6, "tasks": ["5.2"] },
    { "id": 7, "tasks": ["6.1", "7.1"] },
    { "id": 8, "tasks": ["7.2"] },
    { "id": 9, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 10, "tasks": ["10.1", "10.2", "10.3", "10.4"] },
    { "id": 11, "tasks": ["12.1"] },
    { "id": 12, "tasks": ["13.1"] },
    { "id": 13, "tasks": ["14.1", "15.1", "17.1"] },
    { "id": 14, "tasks": ["16.1", "18.1"] },
    { "id": 15, "tasks": ["19.1"] },
    { "id": 16, "tasks": ["21.1", "21.2", "21.3", "21.4"] }
  ]
}
```
