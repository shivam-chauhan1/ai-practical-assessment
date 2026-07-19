# Implementation Plan: Ticket List Filters

## Overview

Extend the existing `GET /api/tickets` endpoint with priority filtering, assignee filtering, sorting, and offset-based pagination. The implementation updates the Zod schema, service layer, controller, and frontend API client/page to support the new paginated response envelope `{ data, pagination }`.

## Tasks

- [x] 1. Update Zod validation schema for list tickets query
  - [x] 1.1 Extend `listTicketsQuerySchema` in `server/src/schemas/ticketSchemas.ts`
    - Add `priority` field with case-insensitive transform and `nativeEnum(Priority)` validation
    - Add `assignedTo` field as union of `z.literal('unassigned')` and `z.string().uuid()`
    - Add `sortBy` field as `z.enum(['updatedAt', 'priority'])`
    - Add `sortOrder` field as `z.enum(['asc', 'desc'])`
    - Add `page` field with string-to-integer transform and `z.number().int().min(1)` pipe
    - Add `pageSize` field with string-to-integer transform and `z.number().int().min(1).max(100)` pipe
    - Add `.passthrough()` to silently ignore unknown parameters
    - Include descriptive error messages listing accepted values for each enum field
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.4, 3.8, 3.9, 4.7, 4.8, 6.1, 6.4, 6.5_

  - [x] 1.2 Write property tests for `listTicketsQuerySchema` validation
    - **Property 9: Invalid input rejection**
    - **Property 10: Multiple validation errors reported together**
    - **Property 11: Unknown parameters silently ignored**
    - **Property 12: String-to-integer coercion for pagination**
    - **Validates: Requirements 1.3, 2.4, 3.8, 3.9, 4.7, 4.8, 4.9, 6.2, 6.3, 6.4, 6.5**

  - [x] 1.3 Write unit tests for `listTicketsQuerySchema` validation
    - Test default values are not applied at schema level (defaults handled in controller)
    - Test case-insensitive priority matching (e.g., "high" → "HIGH")
    - Test `assignedTo=unassigned` literal passes validation
    - Test invalid UUID for assignedTo is rejected
    - Test non-integer strings for page/pageSize are rejected
    - Test pageSize boundaries (0, 1, 100, 101)
    - _Requirements: 1.3, 2.4, 4.7, 4.8, 6.4_

- [x] 2. Update service layer with filtering, sorting, and pagination
  - [x] 2.1 Update `ticketService.listTickets` in `server/src/services/ticketService.ts`
    - Update function signature to accept `ListTicketsParams` interface (priority, assignedTo, sortBy, sortOrder, page, pageSize)
    - Add `where.priority` filter when priority param is present
    - Add `where.assignedTo = null` when assignedTo is `'unassigned'`; set `where.assignedTo = UUID` otherwise
    - Build `orderBy` array with primary sort field and secondary `createdAt: 'desc'` for determinism
    - Calculate `skip` as `(page - 1) * pageSize` and `take` as `pageSize`
    - Execute `findMany` and `count` in parallel using `prisma.$transaction`
    - Return `{ data, pagination: { page, pageSize, total, totalPages } }` envelope
    - Compute `totalPages` as `Math.ceil(total / pageSize)` or 0 when total is 0
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.10, 4.1, 4.2, 4.3, 4.10, 4.11, 4.12, 5.1, 5.2, 5.3_

  - [x] 2.2 Write property tests for service-layer filter/sort/pagination logic
    - **Property 1: Priority filter returns only matching tickets**
    - **Property 2: AssignedTo filter returns only matching tickets**
    - **Property 3: Combined filters apply AND logic**
    - **Property 4: Sort ordering correctness**
    - **Property 5: Secondary sort determinism**
    - **Property 6: Pagination slice correctness**
    - **Property 7: Pagination metadata mathematical correctness**
    - **Validates: Requirements 1.1, 1.4, 2.1, 2.2, 2.5, 3.1, 3.2, 3.3, 3.4, 3.10, 4.1, 4.2, 4.6, 4.10, 4.12**

- [x] 3. Update controller to pass new parameters to service
  - [x] 3.1 Update `ticketController.listTickets` in `server/src/controllers/ticketController.ts`
    - Destructure new query params (priority, assignedTo, sortBy, sortOrder, page, pageSize) from validated `req.query`
    - Apply defaults: `sortBy ?? 'updatedAt'`, `sortOrder ?? 'desc'`, `page ?? 1`, `pageSize ?? 20`
    - Pass all params to `ticketService.listTickets`
    - Return the service result directly as JSON (envelope shape)
    - _Requirements: 3.5, 3.6, 3.7, 4.3, 4.4, 4.5, 4.6, 5.1_

  - [x] 3.2 Wire validation middleware to list tickets route
    - Ensure the route applies Zod validation using `listTicketsQuerySchema` on `req.query`
    - Verify validation errors return HTTP 400 with aggregated `details` array
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 4. Checkpoint - Ensure server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update frontend API client and types
  - [x] 5.1 Update client types in `client/src/api/types.ts`
    - Add `PaginatedTicketsResponse` interface with `data: Ticket[]` and `pagination` object
    - Extend `TicketSearchParams` to `TicketListParams` adding priority, assignedTo, sortBy, sortOrder, page, pageSize fields
    - _Requirements: 5.1, 5.2_

  - [x] 5.2 Update `listTickets` function in `client/src/api/tickets.ts`
    - Change return type from `Promise<Ticket[]>` to `Promise<PaginatedTicketsResponse>`
    - Accept `TicketListParams` parameter type
    - Build `URLSearchParams` including all new filter/sort/pagination params
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 6. Update frontend TicketListPage to consume paginated response
  - [x] 6.1 Update `TicketListPage.tsx` to handle the new response envelope
    - Extract `data` array from the `{ data, pagination }` response instead of using response directly
    - Store pagination metadata in component state
    - Update the `useEffect` to destructure the envelope
    - _Requirements: 5.1, 5.4_

  - [x] 6.2 Add pagination controls to `TicketListPage.tsx`
    - Add page navigation UI (previous/next buttons)
    - Display current page number and total pages
    - Update `listTickets` call to include current page and pageSize
    - Disable previous button on page 1, disable next button on last page
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Write integration tests for the full endpoint
  - [x] 8.1 Write integration tests in `server/tests/ticketFilters.test.ts`
    - Test priority filter returns correct tickets
    - Test assignedTo filter with UUID and "unassigned" literal
    - Test sort by updatedAt and priority in both directions
    - Test pagination with page/pageSize params
    - Test combined filters with AND logic
    - Test response envelope structure with `data` and `pagination` fields
    - Test validation errors return HTTP 400 with correct structure
    - Test multiple validation errors reported in single response
    - Test unknown params are silently ignored
    - Test page beyond total returns empty data with correct metadata
    - **Property 8: Response envelope structure invariant**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.10, 4.11, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.5**

  - [x] 8.2 Update existing client tests in `client/tests/tickets.test.ts`
    - Update mock responses to match new `{ data, pagination }` envelope
    - Test new `TicketListParams` fields are serialized correctly to query string
    - _Requirements: 5.1, 5.2_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The response shape change (Requirement 5) is a breaking change — server and client must be updated together
- The Prisma enum uses `URGENT` but the requirements reference `CRITICAL` — implementation follows the Prisma schema enum values (LOW, MEDIUM, HIGH, URGENT)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1", "5.2"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "6.1"] },
    { "id": 4, "tasks": ["6.2"] },
    { "id": 5, "tasks": ["8.1", "8.2"] }
  ]
}
```
