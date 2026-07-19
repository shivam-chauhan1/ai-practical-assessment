# Review Fixes

This document tracks changes made as a direct result of the AI-assisted code review passes (CR-1, CR-2, CR-3). Each entry links back to the specific finding that prompted it.

---

## Fix 1: Missing `tags` in status-change response

**Source:** CR-1, Finding #6  
**Severity:** Medium  
**File changed:** `server/src/services/ticketService.ts`

**Problem:** The `changeTicketStatus` function included `{ creator: true, assignee: true }` in its Prisma query, but `getTicketById` and `updateTicket` both included `{ creator: true, assignee: true, tags: true }`. This made the status-change response inconsistent — the frontend expects a uniform ticket shape from all mutation endpoints.

**Fix:**
```typescript
// Before
include: { creator: true, assignee: true }

// After
include: { creator: true, assignee: true, tags: true }
```

**Validated:** TypeScript compiles, status-change integration tests still pass, response now includes `tags` array.

---

## Fix 2: Priority enum discrepancy in steering doc

**Source:** CR-1, Finding #5  
**Severity:** Medium  
**File changed:** `.kiro/steering/product.md`

**Problem:** The `product.md` steering doc listed the Priority enum as `LOW, MEDIUM, HIGH, CRITICAL`, but the design doc, Prisma schema, and implementation all use `URGENT` (not CRITICAL). This discrepancy could confuse future development if the steering is referenced as the source of truth.

**Fix:** Updated `product.md` to say `LOW, MEDIUM, HIGH, URGENT` — aligning with the Prisma schema and design.md which are authoritative for implementation.

**Validated:** Verified `schema.prisma` has `URGENT` in the Priority enum. Zod schema uses `z.nativeEnum(Priority)` which validates against the generated Prisma client — any mismatch would be a compile-time error.

---

## Fix 3: `deleteTag` bypassing shared API client

**Source:** CR-3 (pre-PR cleanup pass)  
**Severity:** Medium (security — missing auth header)  
**File changed:** `client/src/api/tags.ts`

**Problem:** The `deleteTag` function was using a raw `fetch()` call instead of the shared `apiRequest()` helper. This meant:
1. No JWT Bearer token attached (auth bypass)
2. No structured error handling (errors would throw as generic TypeError, not ApiError)
3. No proper handling of 204 No Content response (trying to parse JSON from empty body)

**Fix:**
```typescript
// Before
export async function deleteTag(id: string): Promise<void> {
  const response = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete tag');
}

// After
export async function deleteTag(id: string): Promise<void> {
  await apiRequest<void>(`/tags/${id}`, {
    method: 'DELETE',
  });
}
```

The `apiRequest` helper was also updated to handle 204 responses (check status before attempting JSON parse).

**Validated:** Auth token now attached automatically, 204 handled without parse error, no remaining raw `fetch` calls outside the helper.

---

## Fix 4: UUID param validation on routes

**Source:** CR-2 (validation review)  
**Severity:** Low-Medium  
**Files changed:** `server/src/routes/ticketRoutes.ts`, `server/src/routes/commentRoutes.ts`

**Problem:** Some routes accepting `:id` path parameters were missing `validate(uuidParamSchema, 'params')` middleware. While the service layer would eventually reject non-UUID strings (Prisma would fail to find the record), the error message would be a generic 500 or an unhelpful Prisma error rather than a clean 400 `VALIDATION_ERROR` identifying the invalid UUID format.

**Fix:** Added `validate(uuidParamSchema, 'params')` to all routes that accept UUID path parameters:
- `GET /tickets/:id`
- `PATCH /tickets/:id`
- `PATCH /tickets/:id/status`
- `POST /tickets/:id/comments`

**Validated:** Sending a non-UUID string (e.g., `GET /api/tickets/not-a-uuid`) now returns 400 with `{ "error": { "code": "VALIDATION_ERROR", "details": [{ "field": "id", "message": "Invalid uuid" }] } }` instead of falling through to Prisma.

---

## Fix 5: Normalized ZodError fallback behavior

**Source:** CR-1, Finding #3C  
**Severity:** Low  
**File changed:** `server/src/middleware/errorHandler.ts`

**Problem:** The `validate.ts` middleware formats field names as `issue.path.join('.')`, while the `errorHandler.ts` ZodError safety-net branch used `issue.path.join('.') || 'unknown'` — a different fallback for the same logical error type. If a ZodError ever reached the error handler directly (bypassing middleware), it would produce slightly different output.

**Fix:** Normalized the fallback in `errorHandler.ts` to match `validate.ts`:
```typescript
// Both now use the same logic:
field: issue.path.join('.') || 'unknown'
```

**Validated:** Consistent behavior regardless of which path catches the ZodError. The error handler branch is still defensive code (it can't trigger for validated routes today, but protects against future code paths that parse Zod directly).

---

## Fixes NOT Made (deferred or rejected)

| Finding | Decision | Rationale |
|---------|----------|-----------|
| #1 — Derive TERMINAL_STATES from map | Rejected | Readability; only 2 values, covered by unit tests |
| #3 — Remove dead ZodError branch | Rejected | Kept as defensive code for future direct-parse scenarios |
| #4 — Runtime `'status' in data` check | Rejected | Three existing layers already prevent it; integration test proves it |
| #7 — Optimistic concurrency lock | Deferred | Real fix but out of Core scope; documented for future iteration |
| #3B — 403→409 for TICKET_LOCKED | Rejected | design.md says 403, frontend already handles it, error code disambiguates |

See `code-review-notes.md` → "Suggestions Rejected (and why)" for full reasoning on each.
