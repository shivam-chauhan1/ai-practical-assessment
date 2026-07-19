# Implementation Plan: Ticket Tagging

## Overview

This plan implements the ticket tagging feature across the full stack: Prisma schema changes with migration, new REST endpoints for tag CRUD, modifications to existing ticket endpoints for tag attach/detach/filter, a new `TagFilter` UI component on the ticket list page, and seed data updates. Tasks follow the existing project layering conventions (routes → controllers → services → Prisma on server; pages/components/api on client).

## Tasks

- [x] 1. Database schema and migration
  - [x] 1.1 Add Tag model and Tag-Ticket relation to Prisma schema
    - Add `Tag` model with `id` (UUID, default), `name` (VarChar(50)), `createdAt` (DateTime, default now), and `tickets Ticket[]` relation
    - Add `tags Tag[]` relation field to existing `Ticket` model
    - Add `@@unique([name], map: "Tag_name_ci_key")` to the Tag model
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Generate Prisma migration and add case-insensitive unique index
    - Run `npx prisma migrate dev --name add_tag_model` to generate the migration
    - Edit the generated migration SQL to drop the default unique index on `name` and add `CREATE UNIQUE INDEX "Tag_name_ci_key" ON "Tag" (lower(name));` for case-insensitive uniqueness
    - Verify the implicit `_TagToTicket` join table has cascading deletes on both foreign keys
    - _Requirements: 1.3, 1.4, 1.5_

- [x] 2. Tag CRUD server implementation
  - [x] 2.1 Create Zod validation schemas for tag endpoints
    - Create `server/src/schemas/tagSchemas.ts`
    - Define `createTagSchema` with trimmed name (min 1, max 50 chars)
    - Define `deleteTagParamsSchema` with UUID validation for `id`
    - Export a reusable `tagIdsArraySchema` (array of UUID strings, max 10) for use in ticket schemas
    - _Requirements: 2.1, 2.3, 2.7_

  - [x] 2.2 Implement tag service layer
    - Create `server/src/services/tagService.ts`
    - Implement `createTag(name: string)` — creates tag, catches Prisma P2002 for conflict
    - Implement `listTags()` — returns all tags ordered alphabetically case-insensitive
    - Implement `deleteTag(id: string)` — deletes tag or throws NotFoundError
    - Implement `validateTagIds(ids: string[])` — returns array of IDs that do not exist in the database
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 3.3_

  - [x] 2.3 Implement tag controller
    - Create `server/src/controllers/tagController.ts`
    - Implement `create` handler — validates body with `createTagSchema`, calls `createTag`, returns 201
    - Implement `list` handler — calls `listTags`, returns 200 with array
    - Implement `remove` handler — validates params with `deleteTagParamsSchema`, calls `deleteTag`, returns 204
    - Handle 409 conflict from service layer
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.4 Create tag routes and register in app
    - Create `server/src/routes/tagRoutes.ts` with POST `/tags`, GET `/tags`, DELETE `/tags/:id`
    - Register the tag router in `server/src/app.ts` under `/api`
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 2.5 Write integration tests for tag CRUD endpoints
    - Create `server/src/routes/tagRoutes.test.ts`
    - Test POST success (201), POST conflict (409), POST validation errors (400)
    - Test GET returns alphabetically sorted tags
    - Test DELETE success (204), DELETE not found (404), DELETE invalid UUID (400)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.6 Write property tests for tag service
    - Create `server/src/services/tagService.test.ts`
    - **Property 1: Case-insensitive tag name uniqueness**
    - **Property 2: Tag name trimming on creation**
    - **Property 3: Invalid tag name rejection**
    - **Property 4: Alphabetical tag listing**
    - **Validates: Requirements 1.4, 2.1, 2.2, 2.3, 2.4**

- [x] 3. Checkpoint - Verify tag CRUD
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend ticket endpoints for tag attach/detach/filter
  - [x] 4.1 Extend ticket schemas to support tags
    - In `server/src/schemas/ticketSchemas.ts`, add optional `tags` field (array of UUID strings, max 10) to `createTicketSchema` and `updateTicketSchema`
    - Extend `listTicketsQuerySchema` to include optional `tag` string field (comma-separated UUIDs)
    - _Requirements: 3.1, 3.2, 3.4, 4.1_

  - [x] 4.2 Extend ticket service for tag association and filtering
    - Modify `createTicket` to accept optional `tags` string array, validate IDs via `validateTagIds`, connect tags on creation
    - Modify `updateTicket` to accept optional `tags` string array with replace semantics (disconnect all, connect new set); omitted field leaves tags unchanged
    - Modify `listTickets` to accept optional `tagIds` filter array, add `some` clause with OR logic to Prisma query
    - Add `tags: true` to all `include` options in `createTicket`, `updateTicket`, `getTicketById`, and `listTickets`
    - Return 400 with invalid IDs when `validateTagIds` finds non-existent tags
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.3 Update ticket controller to parse tag query parameter
    - In the ticket list handler, parse the `tag` query parameter (comma-separated UUIDs), split into array, pass to `listTickets`
    - Enforce max 10 tag IDs in filter; return 400 if exceeded
    - In create/update handlers, pass `tags` field from validated body to service
    - _Requirements: 4.1, 3.1, 3.2_

  - [x] 4.4 Write integration tests for ticket-tag association
    - Test create ticket with tags (201 response includes tags)
    - Test update ticket with replace semantics (tags array replaces previous)
    - Test update ticket with omitted tags field (preserves existing)
    - Test invalid tag IDs (400 with details)
    - Test max 10 tags per ticket limit
    - Test GET single ticket includes tags
    - Test GET ticket list includes tags in each item
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.5 Write property tests for ticket-tag filtering
    - Add to `server/src/services/ticketService.test.ts`
    - **Property 5: Tag deletion preserves associated tickets**
    - **Property 6: Tag association on ticket creation**
    - **Property 7: Replace semantics on ticket update**
    - **Property 8: Invalid tag ID rejection on attach**
    - **Property 10: OR-logic tag filtering**
    - **Property 11: Filter AND composition**
    - **Property 12: Non-existent tag IDs ignored in filter**
    - **Validates: Requirements 1.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.5**

- [x] 5. Checkpoint - Verify server-side feature complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Client-side tag API and types
  - [x] 6.1 Extend client types for Tag entity
    - In `client/src/api/types.ts`, add `Tag` interface (`id`, `name`, `createdAt`)
    - Extend `Ticket` interface to include `tags: Tag[]`
    - Extend `TicketSearchParams` to include optional `tag?: string`
    - Add `CreateTagRequest` interface (`name: string`)
    - _Requirements: 3.5, 3.6, 5.1_

  - [x] 6.2 Create tags API module
    - Create `client/src/api/tags.ts`
    - Implement `listTags()` — GET `/api/tags`, returns `Tag[]`
    - Implement `createTag(data: CreateTagRequest)` — POST `/api/tags`, returns `Tag`
    - Implement `deleteTag(id: string)` — DELETE `/api/tags/:id`
    - _Requirements: 5.1_

  - [x] 6.3 Extend tickets API to pass tag filter parameter
    - In `client/src/api/tickets.ts`, update `listTickets` to include `tag` param in URL search params when provided
    - _Requirements: 5.2_

- [x] 7. TagFilter UI component
  - [x] 7.1 Implement TagFilter component
    - Create `client/src/components/TagFilter.tsx`
    - Accept `selectedTagIds` and `onSelectionChange` props
    - Fetch tags via `listTags()` on mount
    - Render tags as selectable chips with visually distinct selected/unselected styles (use border + background, not color alone for accessibility)
    - Include a "Clear" button that deselects all tags
    - Show error message with "Retry" button if tag fetch fails
    - Show "No tags available" message if tag list is empty
    - _Requirements: 5.1, 5.4, 5.5, 5.6, 5.7_

  - [x] 7.2 Integrate TagFilter into TicketListPage
    - In `client/src/pages/TicketListPage.tsx`, add `selectedTagIds` state
    - Render `TagFilter` above or alongside the existing `SearchBar`
    - Debounce tag selection changes using existing `useDebounce` hook (300ms)
    - Pass tag IDs as comma-separated string in `listTickets` params
    - Preserve keyword and status filters when tag filter changes
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 7.3 Write unit tests for TagFilter component
    - Create `client/src/components/TagFilter.test.tsx`
    - Test renders all fetched tags
    - Test selection toggles tag and calls `onSelectionChange`
    - Test clear button deselects all
    - Test error state with retry
    - Test empty state message
    - _Requirements: 5.1, 5.4, 5.5, 5.6, 5.7_

  - [x] 7.4 Write property test for ticket URL construction with tag param
    - Add to `client/src/api/tickets.test.ts`
    - **Property 9: Tag inclusion in ticket responses** (verify URL correctly passes comma-separated tag IDs for any set of valid UUIDs)
    - **Validates: Requirements 5.2**

- [x] 8. Checkpoint - Verify client-side feature complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Seed data update
  - [x] 9.1 Update seed script with tag data
    - In `server/prisma/seed.ts`, add at least 5 distinct tags (e.g., "Bug", "Feature Request", "Performance", "Documentation", "Security")
    - Associate at least 3 tickets with tags, with at least one ticket having 2+ tags
    - Use `prisma.tag.upsert` with `where: { name }` for idempotent tag creation
    - Use `prisma.ticket.update` with `connect` for idempotent tag-ticket associations
    - Log count of tags created and associations established
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 9.2 Write seed idempotency test
    - **Property 13: Seed idempotency** — run seed logic twice, verify final state matches single execution
    - **Validates: Requirements 6.4**

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementation uses TypeScript
- Server tests use Jest + Supertest + fast-check; client tests use Vitest + Testing Library + fast-check
- Tag name case-insensitivity is enforced at the database level via `lower(name)` unique index

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "6.1"] },
    { "id": 3, "tasks": ["2.2", "6.2"] },
    { "id": 4, "tasks": ["2.3", "6.3"] },
    { "id": 5, "tasks": ["2.4", "4.1"] },
    { "id": 6, "tasks": ["2.5", "2.6", "4.2"] },
    { "id": 7, "tasks": ["4.3", "7.1"] },
    { "id": 8, "tasks": ["4.4", "4.5", "7.2"] },
    { "id": 9, "tasks": ["7.3", "7.4"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2"] }
  ]
}
```
