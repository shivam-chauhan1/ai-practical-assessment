# API Contract

> Reconciled with the actual implementation. All endpoints are under the `/api` prefix.

## Authentication

All endpoints except `POST /api/auth/login` and `GET /api/health` require a valid JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Common Error Response Shape

Every non-2xx response from the API uses this consistent structure:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable explanation",
    "details": [{ "field": "fieldName", "message": "Per-field error" }]
  }
}
```

`details` is only present for `VALIDATION_ERROR` responses.

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Request body/query/params failed Zod schema validation |
| `INVALID_TRANSITION` | 400 | Status transition violates the state machine |
| `AUTHENTICATION_ERROR` | 401 | Missing, expired, or invalid JWT token |
| `TICKET_LOCKED` | 403 | Attempted field update on a terminal-state ticket |
| `FORBIDDEN` | 403 | User lacks required role for the operation |
| `NOT_FOUND` | 404 | Referenced resource does not exist |
| `CONFLICT` | 409 | Unique constraint violation (e.g., duplicate tag name) |
| `INTERNAL_ERROR` | 500 | Unexpected server error (no details leaked) |

---

## Endpoints

### POST /api/auth/login

Authenticates a user and returns a signed JWT.

**Auth required:** No

**Request Body:**

```json
{
  "email": "string (valid email, required)",
  "password": "string (required)"
}
```

**Success Response: 200 OK**

```json
{
  "token": "jwt-string",
  "user": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "role": "ADMIN | AGENT"
  }
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Missing or invalid email/password format |
| 401 | `AUTHENTICATION_ERROR` | Email not found or password mismatch |

---

### GET /api/health

Simple health check.

**Auth required:** No

**Response: 200 OK**

```json
{ "status": "ok" }
```

---

### GET /api/users

Returns all users (no passwords).

**Auth required:** Yes

**Response: 200 OK**

```json
[
  {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "role": "ADMIN | AGENT"
  }
]
```

Ordered alphabetically by name.

---

### POST /api/tickets

Creates a new ticket. Status is always set to `OPEN`.

**Auth required:** Yes

**Request Body:**

```json
{
  "title": "string (3–200 chars after trim, required)",
  "description": "string (1–5000 chars after trim, required)",
  "priority": "LOW | MEDIUM | HIGH | URGENT",
  "createdBy": "uuid (must reference existing User)",
  "assignedTo": "uuid | null (optional, must reference existing User if provided)",
  "tags": ["uuid", "..."] 
}
```

`tags` is optional. Maximum 10 tag UUIDs per request. All IDs must reference existing tags.

**Success Response: 201 Created**

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "OPEN",
  "priority": "LOW | MEDIUM | HIGH | URGENT",
  "createdBy": "uuid",
  "assignedTo": "uuid | null",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  "creator": { "id": "uuid", "name": "string", "email": "string", "role": "string", "createdAt": "ISO 8601" },
  "assignee": { "id": "uuid", "name": "string", "email": "string", "role": "string", "createdAt": "ISO 8601" } | null,
  "tags": [{ "id": "uuid", "name": "string", "createdAt": "ISO 8601" }],
  "validTransitions": ["IN_PROGRESS", "CANCELLED"]
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Field length violations, invalid enum value, invalid UUID format, >10 tags |
| 404 | `NOT_FOUND` | `createdBy`, `assignedTo`, or any tag UUID does not exist |

---

### GET /api/tickets

Lists tickets with filtering, sorting, and pagination.

**Auth required:** Yes

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `keyword` | string | — | Case-insensitive substring match on title OR description |
| `status` | enum | — | Exact match: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `CANCELLED` |
| `tag` | string | — | Comma-separated tag UUIDs (max 10). Returns tickets with at least one matching tag |
| `priority` | enum | — | Exact match (case-insensitive input): `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `assignedTo` | uuid \| `"unassigned"` | — | Filter by assignee UUID, or `"unassigned"` for null |
| `sortBy` | enum | `updatedAt` | Sort field: `updatedAt` or `priority` |
| `sortOrder` | enum | `desc` | Sort direction: `asc` or `desc` |
| `page` | integer | `1` | Page number (min 1) |
| `pageSize` | integer | `20` | Items per page (1–100) |

All filters combine with AND logic.

**Success Response: 200 OK**

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "status": "OPEN",
      "priority": "HIGH",
      "createdBy": "uuid",
      "assignedTo": "uuid | null",
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601",
      "creator": { "id": "uuid", "name": "string", "email": "string", "role": "string", "createdAt": "ISO 8601" },
      "assignee": { ... } | null,
      "tags": [{ "id": "uuid", "name": "string", "createdAt": "ISO 8601" }],
      "validTransitions": ["IN_PROGRESS", "CANCELLED"]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

Secondary sort is always `createdAt DESC` for deterministic ordering.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid enum value, invalid UUID format, page/pageSize out of range |

---

### GET /api/tickets/:id

Returns a single ticket with comments, creator, assignee, and tags.

**Auth required:** Yes

**Path Parameters:** `id` — ticket UUID

**Success Response: 200 OK**

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "createdBy": "uuid",
  "assignedTo": "uuid | null",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  "creator": { "id": "uuid", "name": "string", "email": "string", "role": "string", "createdAt": "ISO 8601" },
  "assignee": { ... } | null,
  "tags": [{ "id": "uuid", "name": "string", "createdAt": "ISO 8601" }],
  "validTransitions": ["RESOLVED", "CANCELLED"],
  "comments": [
    {
      "id": "uuid",
      "body": "string",
      "ticketId": "uuid",
      "authorId": "uuid",
      "createdAt": "ISO 8601",
      "author": { "id": "uuid", "name": "string", "email": "string", "role": "string", "createdAt": "ISO 8601" }
    }
  ]
}
```

Comments are ordered by `createdAt ASC` (oldest first).

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | `:id` is not a valid UUID |
| 404 | `NOT_FOUND` | Ticket does not exist |

---

### PATCH /api/tickets/:id

Updates a ticket's fields. Does not allow status changes (use the status endpoint).

**Auth required:** Yes

**Path Parameters:** `id` — ticket UUID

**Request Body (at least one field required):**

```json
{
  "title": "string (3–200 chars after trim, optional)",
  "description": "string (1–5000 chars after trim, optional)",
  "priority": "LOW | MEDIUM | HIGH | URGENT (optional)",
  "assignedTo": "uuid | null (optional)",
  "tags": ["uuid", "..."]
}
```

When `tags` is provided, it replaces the full set of tags on the ticket (set semantics).

**Success Response: 200 OK**

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "OPEN",
  "priority": "MEDIUM",
  "createdBy": "uuid",
  "assignedTo": "uuid | null",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601 (refreshed)",
  "creator": { ... },
  "assignee": { ... } | null,
  "tags": [{ "id": "uuid", "name": "string", "createdAt": "ISO 8601" }],
  "validTransitions": ["IN_PROGRESS", "CANCELLED"]
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Field length violation, invalid enum, invalid UUID, >10 tags |
| 403 | `TICKET_LOCKED` | Ticket is CLOSED or CANCELLED |
| 404 | `NOT_FOUND` | Ticket ID, assignedTo user, or any tag UUID does not exist |

---

### PATCH /api/tickets/:id/status

Changes a ticket's status according to the state machine.

**Auth required:** Yes  
**Role required:** `ADMIN` only

**Path Parameters:** `id` — ticket UUID

**Request Body:**

```json
{
  "status": "OPEN | IN_PROGRESS | RESOLVED | CLOSED | CANCELLED"
}
```

**Valid Transitions:**

| From | Allowed Targets |
|------|-----------------|
| OPEN | IN_PROGRESS, CANCELLED |
| IN_PROGRESS | RESOLVED, CANCELLED |
| RESOLVED | CLOSED |
| CLOSED | *(none — terminal)* |
| CANCELLED | *(none — terminal)* |

**Success Response: 200 OK**

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "createdBy": "uuid",
  "assignedTo": "uuid | null",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601 (refreshed)",
  "creator": { ... },
  "assignee": { ... } | null,
  "validTransitions": ["RESOLVED", "CANCELLED"]
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | `status` is not a valid enum value |
| 400 | `INVALID_TRANSITION` | Transition disallowed by the state machine |
| 403 | `FORBIDDEN` | Authenticated user is not ADMIN |
| 404 | `NOT_FOUND` | Ticket does not exist |

---

### POST /api/tickets/:id/comments

Adds a comment to a ticket. Comments are allowed on tickets in ANY status (including terminal states).

**Auth required:** Yes

**Path Parameters:** `id` — ticket UUID

**Request Body:**

```json
{
  "body": "string (1–2000 chars after trim, required)",
  "authorId": "uuid (must reference existing User)"
}
```

**Success Response: 201 Created**

```json
{
  "id": "uuid",
  "body": "string",
  "ticketId": "uuid",
  "authorId": "uuid",
  "createdAt": "ISO 8601",
  "author": { "id": "uuid", "name": "string", "email": "string", "role": "string", "createdAt": "ISO 8601" }
}
```

Adding a comment does NOT update `Ticket.updatedAt`.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Body empty/too long, missing authorId, invalid UUID |
| 404 | `NOT_FOUND` | Ticket or author does not exist |

---

### POST /api/tags

Creates a new tag.

**Auth required:** Yes

**Request Body:**

```json
{
  "name": "string (1–50 chars after trim, required)"
}
```

**Success Response: 201 Created**

```json
{
  "id": "uuid",
  "name": "string",
  "createdAt": "ISO 8601"
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Name empty or exceeds 50 characters |
| 409 | `CONFLICT` | Tag with this name already exists |

---

### GET /api/tags

Lists all tags.

**Auth required:** Yes

**Response: 200 OK**

```json
[
  { "id": "uuid", "name": "string", "createdAt": "ISO 8601" }
]
```

Ordered alphabetically by name.

---

### DELETE /api/tags/:id

Deletes a tag. Removes the association from all tickets but does not delete tickets.

**Auth required:** Yes

**Path Parameters:** `id` — tag UUID

**Success Response: 204 No Content**

*(Empty body)*

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | `:id` is not a valid UUID |
| 404 | `NOT_FOUND` | Tag does not exist |
