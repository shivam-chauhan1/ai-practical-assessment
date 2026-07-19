# AI Prompts — Code Review

The prompt log below feeds into `code-review-notes.md`'s "AI-Assisted Review Summary" section — that file's "My Review Observations" and "Suggestions Rejected (and why)" sections are your own analysis of what Kiro flagged, not something to generate here.

---

### CR-1 — Review the state machine and status endpoint

**Prompt:**
```
Review server/src/services/ticketStateMachine.ts and the status-change
controller/service against design.md and tech.md. Specifically check: is the
transitions map the single source of truth with nothing duplicated elsewhere, does
every code path that changes status go through canTransition, is the error typed
and mapped correctly in the error-handling middleware, and is there any place status
could change as a side effect of the general PATCH /api/tickets/:id endpoint. Flag
anything — don't just tell me it looks fine.
```
**Kiro's response:** This is a code review request, not a spec or task execution request. Let me read the relevant files to conduct the review.

Now let me read the relevant files:

Now let me also check the design.md for the spec that governs this:

I've now read all the relevant files. Here's the review:

---

## Code Review: Status State Machine & Change Flow

### 1. Transitions map as single source of truth — GOOD, with a caveat

The `VALID_TRANSITIONS` map in `stateMachine.ts` is the canonical reference. Both `isValidTransition` and `getValidTransitions` derive from it, and `changeTicketStatus` in the service uses `isValidTransition`. The `TERMINAL_STATES` array is defined separately — this is a minor duplication risk:

**Finding:** `TERMINAL_STATES` is manually declared as `[Status.CLOSED, Status.CANCELLED]` rather than derived from the map (i.e., entries where the target array is empty). If someone later adds a new terminal state to `VALID_TRANSITIONS` with an empty array but forgets to add it to `TERMINAL_STATES`, `updateTicket`'s lock check via `isTerminalState` would silently allow field edits on that new terminal state. Derive it:

```typescript
export const TERMINAL_STATES: Status[] = 
  (Object.entries(VALID_TRANSITIONS) as [Status, Status[]][])
    .filter(([, targets]) => targets.length === 0)
    .map(([status]) => status);
```

This isn't broken today, but it violates the "single source of truth" principle the design.md calls for.

---

### 2. Does every code path that changes status go through `canTransition`/`isValidTransition`? — YES, but with a gap in the schema layer

The dedicated `PATCH /tickets/:id/status` route goes through `changeStatusSchema` (Zod) → `changeStatus` controller → `changeTicketStatus` service → `isValidTransition`. That's correct.

**Finding: The `updateTicketSchema` does not include `status` as a field, which is the correct design — it prevents status from leaking in through the general PATCH endpoint.** However, there's a subtle gap:

In `ticketController.ts`, `updateTicket` does:
```typescript
const ticket = await ticketService.updateTicket(req.params.id, req.body);
```

The `req.body` here has been parsed by `updateTicketSchema`, which strips unknown keys (Zod's default `strict` behavior). But wait — Zod's `z.object()` in *default mode* actually **strips** unrecognized keys. So if a caller sends `{ "status": "CLOSED" }` on the PATCH body, Zod will silently strip it, and the service's destructuring (`const { title, description, priority, assignedTo, tags } = data`) would also never pick it up.

**Verdict:** Status cannot leak through the PATCH endpoint today due to two layers of defense (Zod stripping + explicit destructuring). This is solid. No issue here.

---

### 3. Error typing and middleware mapping — TWO FINDINGS

**Finding A: `InvalidTransitionError` HTTP status code is `400` — correct per design.md.** The `INVALID_TRANSITION` code in the error class maps correctly through the `errorHandler` middleware which just checks `instanceof AppError` and uses `err.statusCode`. This works.

**Finding B: `TicketLockedError` returns `403` — this is debatable.** The design.md specifies 403 for `TICKET_LOCKED`, and the implementation matches. However, consider: a `403 Forbidden` conventionally means "you lack authorization". The user *is* authorized; the ticket's state prevents the action. A `409 Conflict` or `422 Unprocessable Entity` might be more semantically precise. This is a design-level choice, not a bug, but worth flagging since the design.md already says 403.

**Finding C: Duplicate error handling path.** The `validate.ts` middleware catches `ZodError` and converts it to a custom `ValidationError` (which is an `AppError`). But the `errorHandler.ts` *also* has a separate `ZodError` handler. Since `validate.ts` wraps the error before it reaches `errorHandler`, the `ZodError` branch in `errorHandler.ts` is dead code — it can never trigger for validated routes. It's not harmful, but it's misleading. If someone later calls `schema.parse()` directly in a controller without the middleware, it would trigger, so it's arguably defensive. Still, worth noting the inconsistency: validate middleware produces a `ValidationError` with `details[].field` using `issue.path.join('.')`, while the errorHandler's ZodError branch uses `issue.path.join('.') || 'unknown'`. Different fallback behavior for the same logical error type.

---

### 4. Can status change as a side effect of `PATCH /api/tickets/:id`? — CRITICAL FINDING

**Finding: No — with one qualification.** The service's `updateTicket` function explicitly destructures only `{ title, description, priority, assignedTo, tags }` and builds `updateData` from those fields. Status is never included. The Zod schema also strips it. Two layers of defense.

**However**, there's a subtle Prisma concern: the `updateData` object uses `Prisma.TicketUpdateInput` which *does* include `status` as an optional field in its type. If a future developer adds a field to the destructuring or changes the approach to `data: { ...data }` (spreading the whole object), status could leak. The defense-in-depth comment in the code acknowledges this, which is good.

**Recommendation:** Add a runtime assertion or explicit exclusion:
```typescript
// After destructuring, before the Prisma call:
if ('status' in data) {
  throw new ValidationError('Status cannot be changed via this endpoint. Use PATCH /tickets/:id/status');
}
```

This would make the intent explicit at the service layer, independent of the Zod schema.

---

### 5. Priority enum mismatch between design.md and implementation — BUG

**Finding:** The design.md defines Priority as `"LOW" | "MEDIUM" | "HIGH" | "URGENT"`, but the steering rule `product.md` defines it as `LOW, MEDIUM, HIGH, CRITICAL`. The Prisma schema (per design.md) uses `URGENT`, but check your actual Prisma enum — if it says `CRITICAL` (per the product steering), the Zod schema with `z.nativeEnum(Priority)` will validate against whatever the generated Prisma client exports. This is worth verifying in your `schema.prisma` file to ensure the design.md and implementation are aligned.

---

### 6. `changeTicketStatus` doesn't include tags in the response

**Finding:** The `changeTicketStatus` service does:
```typescript
include: { creator: true, assignee: true }
```

But `getTicketById` and `updateTicket` both include `{ creator: true, assignee: true, tags: true }`. The status-change response will be missing the `tags` field, which is inconsistent. If the frontend expects a uniform ticket shape from all mutation endpoints, this will cause issues.

---

### 7. Race condition in `changeTicketStatus`

**Finding:** The function reads the ticket's current status, checks the transition, then updates. Between the read and write, another request could change the status, making the transition invalid. This is a classic TOCTOU (time-of-check-time-of-use) issue. Under low concurrency this is unlikely, but under load it could allow an invalid transition.

**Fix:** Use a Prisma transaction with a `SELECT ... FOR UPDATE` (via `$queryRaw`) or use an optimistic concurrency approach with a `where` clause that includes the expected current status:

```typescript
const updatedTicket = await prisma.ticket.update({
  where: { id: ticketId, status: ticket.status }, // optimistic lock
  data: { status: newStatus },
  include: { creator: true, assignee: true, tags: true },
});
```

If the status changed between the read and write, this would throw a Prisma P2025 (record not found), which the error handler already maps to 404. You'd want to catch that and return a more appropriate "conflict" error, but it prevents invalid transitions.

---

## Summary of Findings

| # | Severity | Issue |
|---|----------|-------|
| 1 | Low | `TERMINAL_STATES` duplicates knowledge from the map rather than deriving it |
| 2 | None | PATCH endpoint correctly cannot change status (two-layer defense) |
| 3 | Low | Dead `ZodError` branch in `errorHandler.ts` with subtly different behavior |
| 4 | Medium | No runtime guard in the service against `status` in update data — relies solely on Zod + destructuring |
| 5 | Medium | Priority enum naming discrepancy between product.md (`CRITICAL`) and design.md (`URGENT`) — verify actual Prisma schema |
| 6 | Medium | `changeTicketStatus` response omits `tags` unlike other ticket mutation responses |
| 7 | Low-Medium | TOCTOU race condition on status transitions (no row-level lock or optimistic check) |

---

### CR-2 — Review validation and error handling together

**Prompt:**
```
Review the Zod schemas and the error-handling middleware together. Check for: any
endpoint missing validation entirely, any place raw Prisma or database error details
could leak into the client response, and whether the VALIDATION_ERROR response shape
is actually consistent across all four validated routes or has drifted between them.
```
**Kiro's response:** Here's the post-fix review:

---

## Review Results (After Fixes)

### 1. Endpoints Missing Validation — All Clear ✓

| Endpoint | Validation |
|----------|-----------|
| `POST /auth/login` | `validate(loginSchema)` on body |
| `POST /tickets` | `validate(createTicketSchema)` on body |
| `GET /tickets` | `validate(listTicketsQuerySchema, 'query')` |
| `GET /tickets/:id` | `validate(uuidParamSchema, 'params')` |
| `PATCH /tickets/:id` | `validate(uuidParamSchema, 'params')` + `validate(updateTicketSchema)` on body |
| `PATCH /tickets/:id/status` | `validate(uuidParamSchema, 'params')` + `validate(changeStatusSchema)` on body |
| `POST /tickets/:id/comments` | `validate(uuidParamSchema, 'params')` + `validate(createCommentSchema)` on body |
| `POST /tags` | `validate(createTagSchema)` on body |
| `GET /tags` | No input — none needed ✓ |
| `DELETE /tags/:id` | `validate(deleteTagParamsSchema, 'params')` |
| `GET /users` | No input — none needed ✓ |

Every endpoint that accepts user input now has Zod validation via the `validate()` middleware.

### 2. Raw Prisma/Database Error Leakage — None ✓

The error handler has four layers, all safe:

1. **AppError** — returns only `code`, `message`, and optionally `details` (all controlled strings)
2. **ZodError** (safety net) — returns only field paths and messages from schema definitions
3. **Prisma P2025** — returns a generic "resource not found" message
4. **Catch-all** — returns generic "An unexpected error occurred", logs full error server-side only

Other Prisma errors (P2002 in tag creation, P2003 foreign key, etc.) either get caught in the service layer and re-thrown as an AppError, or fall through to the catch-all which never exposes internals. No raw database details reach the client.

### 3. VALIDATION_ERROR Response Shape Consistency — Consistent ✓

All validation errors now flow through exactly one path: the `validate()` middleware catches `ZodError`, maps it to a `ValidationError` (AppError subclass), which the error handler serializes as:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "...", "message": "..." }]
  }
}
```

The `field` fallback is `|| 'unknown'` in both the `validate()` middleware and the `errorHandler.ts` ZodError catch (which now only serves as a safety net for any edge case that bypasses middleware).

**No remaining drift between routes.** All four validated route groups (auth, tickets, tags, comments) use the same middleware, same error class, same serialization path.

---

### CR-3 — Broad pre-PR pass

**Prompt:**
```
Before I open the PR: pass across /server and /client for unused imports, any
leftover console.log debugging statements, hardcoded values that should come from
the config module instead, and confirm .env is in .gitignore and nothing in
.env.example looks like a real credential.
```
**Kiro's response:** I just fixed the only issue in the previous pass (the `deleteTag` bypass). Let me re-run the checks quickly to confirm everything's clean now.

All clean. Here's the final summary:

| Check | Status |
|-------|--------|
| `.env` in `.gitignore` | ✅ Present |
| `.env.example` — no real credentials | ✅ Only placeholders |
| `process.env` confined to config module | ✅ No leaks |
| No hardcoded URLs/ports in source | ✅ |
| No `console.log` in client | ✅ Zero |
| Server `console.log` | ✅ Only the startup message (standard) |
| Server `console.error` | ✅ Only in error handler and config crash path (appropriate) |
| No unused imports | ✅ |
| `deleteTag` bypass fixed | ✅ Now uses `apiRequest` with auth + 204 handling |

The only `fetch` call remaining is inside `apiRequest` itself (the shared helper) — exactly where it belongs. You're good to open the PR.