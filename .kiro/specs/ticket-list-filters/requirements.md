# Requirements Document

## Introduction

Extend the existing `GET /api/tickets` endpoint with additional filtering (priority, assignedTo), sorting (by updatedAt or priority), and pagination capabilities. All filters are combinable with each other and with the existing keyword and status filters. Pagination uses offset-based approach for simplicity with Prisma's native `skip`/`take` support.

### Pagination Approach — Offset vs Cursor

| Aspect | Offset (`skip`/`take`) | Cursor-based |
|--------|----------------------|--------------|
| Prisma support | Native `skip` + `take` — one line each | Requires a unique, sequential cursor field + `cursor` option |
| Client complexity | Simple page/pageSize math | Must track an opaque cursor token |
| Deep-page perf | Degrades on large offsets (DB still scans skipped rows) | Constant time regardless of page depth |
| Consistency on insert/delete | May skip or duplicate rows when data changes between pages | Stable — always resumes from last-seen record |

**Decision:** Use offset-based pagination. The ticket table is internal-only and unlikely to exceed tens of thousands of rows. Offset keeps the API surface simple (`page` + `pageSize`) and maps directly to Prisma's `skip`/`take`. If scale becomes a concern later, cursor-based pagination can be added as a non-breaking enhancement.

## Glossary

- **API**: The Express REST backend served at `/api`
- **Ticket_List_Endpoint**: The `GET /api/tickets` route that returns a filtered, sorted, paginated list of tickets
- **Priority_Filter**: A query parameter that restricts results to tickets matching one of the Priority enum values (LOW, MEDIUM, HIGH, CRITICAL)
- **AssignedTo_Filter**: A query parameter that restricts results to tickets assigned to a specific user, identified by User UUID
- **Sort_Parameter**: A query parameter pair (`sortBy`, `sortOrder`) controlling the ordering of results
- **Page**: A 1-based index indicating which slice of results to return
- **PageSize**: The number of tickets returned per page
- **Pagination_Metadata**: A JSON object included in the response containing `page`, `pageSize`, `total`, and `totalPages`

## Requirements

### Requirement 1: Priority Filter

**User Story:** As an agent, I want to filter tickets by priority level, so that I can focus on high-urgency work first.

#### Acceptance Criteria

1. WHEN the `priority` query parameter is provided with a valid Priority enum value (LOW, MEDIUM, HIGH, CRITICAL), THE Ticket_List_Endpoint SHALL return only tickets whose priority matches the provided value using a case-insensitive comparison.
2. WHEN the `priority` query parameter is omitted, THE Ticket_List_Endpoint SHALL return tickets of all priority levels.
3. WHEN the `priority` query parameter contains a value that does not match any Priority enum value after case-insensitive comparison, THE Ticket_List_Endpoint SHALL respond with HTTP 400 and a JSON body containing a field-level validation error indicating the invalid priority value and the list of accepted values.
4. WHEN the `priority` query parameter is combined with any other supported filters (`keyword`, `status`, `tag`, `assignedTo`), THE Ticket_List_Endpoint SHALL apply all filters using AND logic.
5. WHEN the `priority` query parameter is provided and no tickets match the specified priority, THE Ticket_List_Endpoint SHALL return an empty `data` array with Pagination_Metadata reflecting zero total results.

### Requirement 2: AssignedTo Filter

**User Story:** As a team lead, I want to filter tickets by assignee, so that I can review workload distribution across agents.

#### Acceptance Criteria

1. WHEN the `assignedTo` query parameter is provided with a valid v4 UUID, THE Ticket_List_Endpoint SHALL return only tickets whose assignedTo field matches that UUID, returning an empty data array if no tickets match or the UUID does not correspond to an existing user.
2. WHEN the `assignedTo` query parameter is set to the case-sensitive literal string `unassigned`, THE Ticket_List_Endpoint SHALL return only tickets where assignedTo is null, responding with HTTP 200 OK status.
3. WHEN the `assignedTo` query parameter is omitted, THE Ticket_List_Endpoint SHALL return tickets regardless of assignee.
4. IF the `assignedTo` query parameter contains a value that is neither a valid v4 UUID nor the case-sensitive string `unassigned`, THEN THE Ticket_List_Endpoint SHALL respond with HTTP 400 and a JSON body containing field-level error details.
5. WHEN the `assignedTo` query parameter is combined with `keyword`, `status`, `priority`, or `tag` filters, THE Ticket_List_Endpoint SHALL apply all filters using AND logic.

### Requirement 3: Sort Parameter

**User Story:** As an agent, I want to sort the ticket list by last-updated time or priority level, so that I can triage effectively.

#### Acceptance Criteria

1. WHEN the `sortBy` query parameter is set to `updatedAt`, THE Ticket_List_Endpoint SHALL order results by the ticket's updatedAt timestamp.
2. WHEN the `sortBy` query parameter is set to `priority`, THE Ticket_List_Endpoint SHALL order results by the ticket's priority level using the severity order LOW < MEDIUM < HIGH < CRITICAL.
3. WHEN the `sortOrder` query parameter is set to `asc`, THE Ticket_List_Endpoint SHALL return results in ascending order.
4. WHEN the `sortOrder` query parameter is set to `desc`, THE Ticket_List_Endpoint SHALL return results in descending order.
5. WHEN neither `sortBy` nor `sortOrder` is provided, THE Ticket_List_Endpoint SHALL default to ordering by updatedAt descending.
6. WHEN `sortBy` is provided without `sortOrder`, THE Ticket_List_Endpoint SHALL default `sortOrder` to `desc`.
7. WHEN `sortOrder` is provided without `sortBy`, THE Ticket_List_Endpoint SHALL first validate the `sortOrder` value against the accepted values (`asc`, `desc`) and, only if valid, apply it to the default sort field `updatedAt`.
8. WHEN `sortBy` contains an invalid value, THE Ticket_List_Endpoint SHALL respond with HTTP 400 and a JSON body containing a validation error message that identifies the invalid parameter name and the accepted values (`updatedAt`, `priority`).
9. WHEN `sortOrder` contains an invalid value, THE Ticket_List_Endpoint SHALL respond with HTTP 400 and a JSON body containing a validation error message that identifies the invalid parameter name and the accepted values (`asc`, `desc`).
10. WHEN multiple tickets share the same value for the active sort field, THE Ticket_List_Endpoint SHALL use `createdAt` descending as the secondary sort to guarantee a deterministic order across paginated requests.

### Requirement 4: Offset-Based Pagination

**User Story:** As an agent, I want paginated ticket results, so that the interface remains responsive even with many tickets.

#### Acceptance Criteria

1. WHEN the `page` query parameter is provided, THE Ticket_List_Endpoint SHALL return the corresponding page of results using 1-based indexing.
2. WHEN the `pageSize` query parameter is provided, THE Ticket_List_Endpoint SHALL return at most that number of tickets per page.
3. WHEN neither `page` nor `pageSize` is provided, THE Ticket_List_Endpoint SHALL default to page 1 with a pageSize of 20.
4. WHEN `page` is provided without `pageSize`, THE Ticket_List_Endpoint SHALL use the default pageSize of 20.
5. WHEN `pageSize` is provided without `page`, THE Ticket_List_Endpoint SHALL default to page 1.
6. WHEN both `page` and `pageSize` are provided, THE Ticket_List_Endpoint SHALL use the provided pageSize value directly.
7. IF `pageSize` is less than 1 or greater than 100, THEN THE Ticket_List_Endpoint SHALL respond with HTTP 400 and a JSON body containing field-level error details indicating the allowed range of 1 to 100.
8. IF `page` or `pageSize` contains a non-positive integer, a non-integer value, or a non-numeric string, THEN THE Ticket_List_Endpoint SHALL respond with HTTP 400 and a JSON body containing field-level error details.
9. IF a request contains multiple invalid pagination parameters (e.g., both invalid `page` and invalid `pageSize`), THEN THE Ticket_List_Endpoint SHALL return HTTP 400 with field-level errors for all invalid parameters in a single response.
10. THE Ticket_List_Endpoint SHALL include Pagination_Metadata in the response containing `page` (current page number), `pageSize` (requested page size), `total` (total matching records after all filters are applied), and `totalPages` (calculated as the ceiling of total divided by pageSize, or 0 when total is 0).
11. WHEN the requested page exceeds the total number of pages (including when total is 0 and page is 1), THE Ticket_List_Endpoint SHALL return an empty data array with correct Pagination_Metadata.
12. THE Ticket_List_Endpoint SHALL apply pagination after all filtering and sorting operations, so that `total` reflects the count of filtered results and page slicing operates on the sorted, filtered set.

### Requirement 5: Response Shape Change

**User Story:** As a frontend developer, I want a predictable paginated response format, so that I can build pagination UI components.

#### Acceptance Criteria

1. THE Ticket_List_Endpoint SHALL return a JSON object with exactly two top-level fields: a `data` field containing an array of ticket objects (empty array when no tickets match) and a `pagination` field containing the Pagination_Metadata.
2. THE Ticket_List_Endpoint SHALL include in the `pagination` field the following properties: `page` (positive integer, the current 1-based page number), `pageSize` (positive integer, the number of items per page), `total` (non-negative integer, the total number of matching records across all pages), and `totalPages` (non-negative integer, computed as the ceiling of total divided by pageSize, or 0 when total is 0); these values SHALL always reflect the actual filtered data array state (e.g., when no tickets match, `total` is 0 and `totalPages` is 0).
3. THE Ticket_List_Endpoint SHALL maintain the existing ticket object shape within the `data` array, including `validTransitions`, `creator` (object with id, name, email), `assignee` (object with id, name, email, or null), and `tags` (array of tag objects).
4. WHEN no tickets match the applied filters, THE Ticket_List_Endpoint SHALL return the envelope with `data` set to an empty array and `pagination.total` set to 0 and `pagination.totalPages` set to 0.

### Requirement 6: Input Validation

**User Story:** As a developer, I want all new query parameters validated with Zod, so that malformed requests are rejected consistently.

#### Acceptance Criteria

1. THE Ticket_List_Endpoint SHALL validate all query parameters (`priority`, `assignedTo`, `sortBy`, `sortOrder`, `page`, `pageSize`) using the Zod schema before processing.
2. IF any query parameter fails validation, THEN THE Ticket_List_Endpoint SHALL respond with HTTP 400 and a JSON body with the structure `{ error: { code: "VALIDATION_ERROR", message, details } }` where `details` is an array of objects each containing `field` (the parameter name that failed) and `message` (a human-readable description of the failure).
3. IF multiple query parameters fail validation simultaneously, THEN THE Ticket_List_Endpoint SHALL return all field-level errors in a single response rather than stopping at the first failure.
4. THE Ticket_List_Endpoint SHALL coerce `page` and `pageSize` from string query parameters to integers before applying range and type validation; IF the string value cannot be parsed as an integer (e.g., contains non-numeric characters), THEN the parameter SHALL fail validation and be reported in the error details with the same HTTP 400 response and error structure as other validation failures.
5. THE Ticket_List_Endpoint SHALL silently ignore any query parameters not defined in the validation schema (passthrough unknown parameters without rejection).
