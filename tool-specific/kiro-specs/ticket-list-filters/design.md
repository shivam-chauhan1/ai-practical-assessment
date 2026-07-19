# Design Document: Ticket List Filters

## Overview

This design extends the existing `GET /api/tickets` endpoint with priority filtering, assignee filtering, sorting, and offset-based pagination. The endpoint currently supports `keyword`, `status`, and `tag` filters and returns a flat array. After this change, it will accept additional query parameters and return a paginated envelope `{ data, pagination }`.

The implementation follows the existing layered architecture (routes → controllers → services → Prisma) and uses Zod for input validation, consistent with the rest of the codebase.

### Key Design Decisions

1. **Offset-based pagination** — Uses Prisma's native `skip`/`take`. Simple, adequate for an internal tool with bounded dataset size.
2. **Priority sort uses a mapped numeric order** — Prisma's PostgreSQL enum ordering is based on declaration order. We'll define a severity map and use `Prisma.sql` raw ordering or Prisma's enum order (since the schema defines LOW, MEDIUM, HIGH, URGENT in severity order, `orderBy: { priority: 'asc' }` already works correctly).
3. **Response shape is a breaking change** — The endpoint switches from returning `Ticket[]` to `{ data: Ticket[], pagination: PaginationMeta }`. The frontend must be updated simultaneously.
4. **Validation aggregates all errors** — Zod's `.safeParse()` collects all issues in one pass, matching the requirement for multi-field error reporting.

## Architecture

```mermaid
flowchart LR
    Client[React Frontend] -->|GET /api/tickets?params| Router[Express Router]
    Router -->|validate query| Middleware[Zod Validate Middleware]
    Middleware -->|parsed params| Controller[ticketController.listTickets]
    Controller -->|filters, sort, pagination| Service[ticketService.listTickets]
    Service -->|where, orderBy, skip, take| Prisma[Prisma Client]
    Prisma -->|rows + count| Service
    Service -->|{data, pagination}| Controller
    Controller -->|JSON response| Client
```

### Request Flow

1. Express router receives `GET /api/tickets` with query params
2. Zod validation middleware parses and validates all query params (passthrough for unknown params)
3. Controller destructures validated params and calls the service
4. Service builds Prisma `where`, `orderBy`, `skip`, `take` from params
5. Service executes `findMany` + `count` in parallel via `$transaction`
6. Service returns `{ data, pagination }` envelope
7. Controller sends the envelope as JSON

## Components and Interfaces

### 1. Zod Schema — `listTicketsQuerySchema` (updated)

**File:** `server/src/schemas/ticketSchemas.ts`

```typescript
import { z } from 'zod';
import { Priority, Status } from '@prisma/client';

const priorityEnum = z.nativeEnum(Priority, {
  errorMap: () => ({
    message: `Invalid priority value. Accepted values: ${Object.values(Priority).join(', ')}`,
  }),
});

const assignedToSchema = z.union([
  z.literal('unassigned'),
  z.string().uuid('assignedTo must be a valid v4 UUID'),
]);

const sortBySchema = z.enum(['updatedAt', 'priority'], {
  errorMap: () => ({
    message: 'Invalid sortBy value. Accepted values: updatedAt, priority',
  }),
});

const sortOrderSchema = z.enum(['asc', 'desc'], {
  errorMap: () => ({
    message: 'Invalid sortOrder value. Accepted values: asc, desc',
  }),
});

const pageSchema = z
  .string()
  .transform((val) => {
    const num = Number(val);
    if (!Number.isInteger(num)) throw new Error();
    return num;
  })
  .pipe(z.number().int().min(1, 'page must be at least 1'));

const pageSizeSchema = z
  .string()
  .transform((val) => {
    const num = Number(val);
    if (!Number.isInteger(num)) throw new Error();
    return num;
  })
  .pipe(z.number().int().min(1, 'pageSize must be between 1 and 100').max(100, 'pageSize must be between 1 and 100'));

export const listTicketsQuerySchema = z.object({
  keyword: z.string().optional(),
  status: z.nativeEnum(Status, { errorMap: () => ({ message: 'Invalid status value' }) }).optional(),
  tag: z.string().optional(),
  priority: priorityEnum.optional(),
  assignedTo: assignedToSchema.optional(),
  sortBy: sortBySchema.optional(),
  sortOrder: sortOrderSchema.optional(),
  page: pageSchema.optional(),
  pageSize: pageSizeSchema.optional(),
}).passthrough(); // silently ignore unknown params
```

The schema uses `.transform()` + `.pipe()` for `page`/`pageSize` to coerce string query params to integers before range validation. Case-insensitive priority matching is handled by transforming the input to uppercase before enum validation.

### 2. Controller — `ticketController.listTickets` (updated)

**File:** `server/src/controllers/ticketController.ts`

```typescript
export async function listTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      keyword, status, tag,
      priority, assignedTo,
      sortBy, sortOrder,
      page, pageSize,
    } = req.query as ParsedListTicketsQuery;

    let tagIds: string[] | undefined;
    if (tag) {
      tagIds = (tag as string).split(',').filter(Boolean);
      if (tagIds.length > 10) {
        throw new ValidationError('Maximum 10 tag filter IDs');
      }
    }

    const result = await ticketService.listTickets({
      keyword,
      status,
      tagIds,
      priority,
      assignedTo,
      sortBy: sortBy ?? 'updatedAt',
      sortOrder: sortOrder ?? 'desc',
      page: page ?? 1,
      pageSize: pageSize ?? 20,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
```

### 3. Service — `ticketService.listTickets` (updated)

**File:** `server/src/services/ticketService.ts`

```typescript
interface ListTicketsParams {
  keyword?: string;
  status?: Status;
  tagIds?: string[];
  priority?: Priority;
  assignedTo?: string; // UUID or 'unassigned'
  sortBy: 'updatedAt' | 'priority';
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

interface PaginatedTicketsResponse {
  data: TicketWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function listTickets(params: ListTicketsParams): Promise<PaginatedTicketsResponse> {
  const where: Prisma.TicketWhereInput = {};

  // Keyword filter (existing)
  if (params.keyword) {
    where.OR = [
      { title: { contains: params.keyword, mode: 'insensitive' } },
      { description: { contains: params.keyword, mode: 'insensitive' } },
    ];
  }

  // Status filter (existing)
  if (params.status) {
    where.status = params.status;
  }

  // Tag filter (existing)
  if (params.tagIds && params.tagIds.length > 0) {
    where.tags = { some: { id: { in: params.tagIds } } };
  }

  // Priority filter (new)
  if (params.priority) {
    where.priority = params.priority;
  }

  // AssignedTo filter (new)
  if (params.assignedTo) {
    if (params.assignedTo === 'unassigned') {
      where.assignedTo = null;
    } else {
      where.assignedTo = params.assignedTo;
    }
  }

  // Sort (new)
  const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
    { [params.sortBy]: params.sortOrder },
    { createdAt: 'desc' }, // secondary sort for determinism
  ];

  // Pagination (new)
  const skip = (params.page - 1) * params.pageSize;
  const take = params.pageSize;

  // Execute query + count in parallel
  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { creator: true, assignee: true, tags: true },
    }),
    prisma.ticket.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / params.pageSize);

  return {
    data: tickets.map(ticket => ({
      ...ticket,
      validTransitions: getValidTransitions(ticket.status),
    })),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages,
    },
  };
}
```

### 4. Frontend API Client (updated)

**File:** `client/src/api/tickets.ts`

```typescript
export interface PaginatedTicketsResponse {
  data: Ticket[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface TicketListParams extends TicketSearchParams {
  priority?: Priority;
  assignedTo?: string;
  sortBy?: 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export async function listTickets(params?: TicketListParams): Promise<PaginatedTicketsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.keyword) searchParams.set('keyword', params.keyword);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.assignedTo) searchParams.set('assignedTo', params.assignedTo);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
  const query = searchParams.toString();
  return apiRequest<PaginatedTicketsResponse>(`/tickets${query ? `?${query}` : ''}`);
}
```

### 5. Validate Middleware Update

The existing `validate` middleware already handles Zod errors and maps them to the standard `{ error: { code, message, details } }` structure. No changes needed to the middleware itself — only the schema changes.

However, the priority filter requires **case-insensitive** comparison. The Zod schema will use a `.transform()` to uppercase the input before enum validation:

```typescript
priority: z
  .string()
  .transform((val) => val.toUpperCase())
  .pipe(priorityEnum)
  .optional(),
```

## Data Models

### Query Parameters (Input)

| Parameter   | Type       | Default      | Constraints                          |
|-------------|------------|--------------|--------------------------------------|
| keyword     | string     | —            | Optional, existing                   |
| status      | Status     | —            | Optional, existing enum              |
| tag         | string     | —            | Optional, comma-separated IDs        |
| priority    | Priority   | —            | Optional, case-insensitive enum      |
| assignedTo  | string     | —            | Optional, UUID or literal "unassigned" |
| sortBy      | string     | "updatedAt"  | "updatedAt" \| "priority"           |
| sortOrder   | string     | "desc"       | "asc" \| "desc"                     |
| page        | integer    | 1            | ≥ 1                                  |
| pageSize    | integer    | 20           | 1–100                                |

### Response Envelope (Output)

```typescript
interface ListTicketsResponse {
  data: Ticket[];       // array of ticket objects (may be empty)
  pagination: {
    page: number;       // current page (1-based)
    pageSize: number;   // items per page
    total: number;      // total matching records (post-filter)
    totalPages: number; // ceil(total / pageSize), or 0 when total is 0
  };
}
```

### Validation Error Response

```typescript
interface ValidationErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: Array<{
      field: string;   // the failing parameter name
      message: string; // human-readable failure description
    }>;
  };
}
```

### Priority Severity Order (for sorting)

The Prisma schema declares the Priority enum as `LOW, MEDIUM, HIGH, URGENT`. PostgreSQL stores enum values with an inherent ordinal based on declaration order. Since Prisma's `orderBy` on an enum field respects this declaration order, `orderBy: { priority: 'asc' }` naturally produces LOW → MEDIUM → HIGH → URGENT. No custom mapping is needed.

> **Note:** The requirements reference "CRITICAL" but the Prisma schema uses "URGENT". The Zod validation will accept the values as defined in the Prisma enum (LOW, MEDIUM, HIGH, URGENT).

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Priority filter returns only matching tickets

*For any* valid priority value and any set of tickets in the database, when the `priority` filter is applied, every ticket in the `data` array SHALL have a priority field equal to the requested value.

**Validates: Requirements 1.1**

### Property 2: AssignedTo filter returns only matching tickets

*For any* valid assignedTo value (UUID or "unassigned") and any set of tickets in the database, when the `assignedTo` filter is applied, every ticket in the `data` array SHALL have an assignedTo field matching the requested value (or null when "unassigned" is specified).

**Validates: Requirements 2.1, 2.2**

### Property 3: Combined filters apply AND logic

*For any* combination of valid filter parameters (priority, assignedTo, keyword, status, tag), every ticket in the `data` array SHALL satisfy ALL active filter conditions simultaneously.

**Validates: Requirements 1.4, 2.5**

### Property 4: Sort ordering correctness

*For any* valid `sortBy` and `sortOrder` combination, the tickets in the `data` array SHALL be ordered such that for every consecutive pair (ticket[i], ticket[i+1]), the sort field value of ticket[i] compares correctly to ticket[i+1] according to the specified direction (ascending or descending).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 5: Secondary sort determinism

*For any* set of tickets where multiple tickets share the same value for the active sort field, those tickets SHALL be sub-ordered by `createdAt` descending, guaranteeing deterministic results across paginated requests.

**Validates: Requirements 3.10**

### Property 6: Pagination slice correctness

*For any* valid page and pageSize, the `data` array SHALL contain at most `pageSize` items and SHALL correspond to the correct offset slice of the full sorted, filtered result set (items at positions `(page-1)*pageSize` through `page*pageSize - 1`).

**Validates: Requirements 4.1, 4.2, 4.6**

### Property 7: Pagination metadata mathematical correctness

*For any* response, the pagination metadata SHALL satisfy: `pagination.total` equals the count of all tickets matching active filters, `pagination.totalPages` equals `Math.ceil(total / pageSize)` (or 0 when total is 0), and `pagination.page` and `pagination.pageSize` equal the requested values.

**Validates: Requirements 4.10, 4.12**

### Property 8: Response envelope structure invariant

*For any* valid request to the ticket list endpoint, the response SHALL be a JSON object with exactly two top-level fields: `data` (an array) and `pagination` (an object containing `page`, `pageSize`, `total`, `totalPages`), and each ticket in `data` SHALL include `validTransitions`, `creator`, `assignee`, and `tags` fields.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 9: Invalid input rejection

*For any* query parameter value that violates its validation rules (invalid enum value, non-UUID non-"unassigned" assignedTo, out-of-range pageSize, non-integer page/pageSize, invalid sortBy/sortOrder), the endpoint SHALL respond with HTTP 400 and a JSON body containing `{ error: { code: "VALIDATION_ERROR", message, details } }` where details includes an entry with the `field` name of the offending parameter.

**Validates: Requirements 1.3, 2.4, 3.8, 3.9, 4.7, 4.8, 6.2**

### Property 10: Multiple validation errors reported together

*For any* request with multiple invalid query parameters, the `details` array in the error response SHALL contain one entry per invalid field, reporting all validation failures in a single response rather than stopping at the first.

**Validates: Requirements 4.9, 6.3**

### Property 11: Unknown parameters silently ignored

*For any* request containing query parameters not defined in the validation schema, the endpoint SHALL process the request normally without returning an error, effectively ignoring the unknown parameters.

**Validates: Requirements 6.5**

### Property 12: String-to-integer coercion for pagination

*For any* numeric string value provided as `page` or `pageSize`, the endpoint SHALL coerce it to an integer and apply range validation; for any non-numeric string, the endpoint SHALL reject it with a validation error.

**Validates: Requirements 6.4**

## Error Handling

| Scenario | HTTP Status | Error Code | Details |
|----------|-------------|------------|---------|
| Invalid priority value | 400 | VALIDATION_ERROR | `field: "priority"` with accepted values |
| Invalid assignedTo (not UUID, not "unassigned") | 400 | VALIDATION_ERROR | `field: "assignedTo"` |
| Invalid sortBy value | 400 | VALIDATION_ERROR | `field: "sortBy"` with accepted values |
| Invalid sortOrder value | 400 | VALIDATION_ERROR | `field: "sortOrder"` with accepted values |
| page < 1 or non-integer | 400 | VALIDATION_ERROR | `field: "page"` |
| pageSize outside 1–100 or non-integer | 400 | VALIDATION_ERROR | `field: "pageSize"` |
| Multiple invalid params | 400 | VALIDATION_ERROR | Multiple entries in `details` array |
| Tag filter exceeds 10 IDs | 400 | VALIDATION_ERROR | Existing behavior preserved |
| Unauthenticated request | 401 | AUTHENTICATION_ERROR | Existing auth middleware |

All validation errors follow the existing `AppError` → `errorHandler` pattern. The Zod validation middleware already aggregates all issues from `ZodError.issues` into the `details` array, so multi-field error reporting works automatically.

## Testing Strategy

### Property-Based Tests (fast-check)

The project already uses `fast-check` (installed in both server and client). Property-based tests will validate the correctness properties defined above.

**Library:** `fast-check` v3.22.0 (already in server devDependencies)
**Runner:** Jest (server test runner)
**Minimum iterations:** 100 per property test
**Tag format:** `Feature: ticket-list-filters, Property {N}: {title}`

Property tests focus on:
- Zod schema validation logic (pure function — parse input, check output/errors)
- Service-layer filter/sort/pagination logic (using mocked Prisma or in-memory data)
- Response envelope structure verification

### Unit Tests (Jest)

Unit tests cover specific examples and edge cases:
- Default parameter values (page=1, pageSize=20, sortBy=updatedAt, sortOrder=desc)
- `assignedTo=unassigned` literal string handling
- Priority case-insensitive matching (e.g., "high" → "HIGH")
- Page beyond total pages returns empty data with correct metadata
- `totalPages` is 0 when total is 0

### Integration Tests (Jest + Supertest)

Integration tests verify the full HTTP request/response cycle against a test database:
- End-to-end filter combinations
- Correct HTTP status codes for valid and invalid requests
- Response shape verification
- Pagination with real database rows
- Sort order verification with seeded data

### Test File Locations

Per project convention (tests live next to the code):
- `server/tests/ticketFilters.test.ts` — integration tests
- `server/tests/ticketFilters.property.test.ts` — property-based tests
- `server/tests/ticketSchemas.test.ts` — schema validation unit tests
- `client/tests/tickets.test.ts` — updated for new response shape
