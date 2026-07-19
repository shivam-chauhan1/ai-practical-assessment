# Code Review Notes

## AI-Assisted Review Summary

Three targeted review passes were conducted using Kiro before opening the PR:

**CR-1 — State machine and status endpoint review** (7 findings)

| # | Severity | Finding |
|---|----------|---------|
| 1 | Low | `TERMINAL_STATES` manually declared rather than derived from the transitions map |
| 2 | None | PATCH endpoint correctly cannot change status — two-layer defense (Zod stripping + explicit destructuring) confirmed |
| 3 | Low | Dead `ZodError` branch in `errorHandler.ts` with subtly different fallback behavior than `validate.ts` |
| 4 | Medium | No runtime guard in service layer against `status` in update data — relies solely on Zod + destructuring |
| 5 | Medium | Priority enum naming discrepancy between `product.md` (CRITICAL) and `design.md` / Prisma schema (URGENT) |
| 6 | Medium | `changeTicketStatus` response omits `tags` unlike other ticket mutation endpoints |
| 7 | Low-Medium | TOCTOU race condition on status transitions — no row-level lock or optimistic concurrency check |

**CR-2 — Validation and error handling review** (all clear post-fix)
- Every input-accepting endpoint has Zod validation ✓
- No raw Prisma/database error details leak to clients ✓
- `VALIDATION_ERROR` response shape consistent across all routes ✓

**CR-3 — Pre-PR cleanup pass** (1 issue found and fixed)
- `deleteTag` was using raw `fetch()` instead of shared `apiRequest()` — bypassed auth and 204 handling
- No unused imports, no `console.log` in client, `.env` in `.gitignore`, no hardcoded values

---

## My Review Observations

Beyond what Kiro flagged, I noted:

1. **The two-layer defense on status in PATCH is actually robust.** Kiro flagged that Prisma's `TicketUpdateInput` type includes `status` (Finding #4), but in practice both Zod and explicit destructuring prevent it from ever reaching the Prisma call. The existing integration test (`'IGNORES a status field in the PATCH body'`) already proves this at the HTTP level. The risk is purely hypothetical (a future developer changing the code pattern).

2. **The dead ZodError branch in errorHandler serves a legitimate purpose.** If any future code path calls `schema.parse()` directly (e.g., in a service layer without going through middleware), the safety net catches it. It's defensive code, not dead code — it just can't trigger *today*. Worth keeping.

3. **The `deleteTag` bypass was a genuine bug** — the only real issue found. All other API functions used the shared helper with auth. This one was likely a copy-paste error during the tag feature implementation.

4. **The test suite's re-fetch pattern is correct.** For every invalid transition test, the ticket is re-fetched from the database after the 400 response to confirm status is *unchanged*. This is the right approach — it proves the invariant held, not just that the endpoint returned an error code.

---

## Changes Made After Review

| Finding | Action Taken |
|---------|-------------|
| #5 — Priority enum discrepancy | Verified actual `schema.prisma` uses `URGENT` (matching design.md). Updated `product.md` steering to say URGENT instead of CRITICAL to eliminate confusion. |
| #6 — Missing tags in status-change response | Added `tags: true` to the Prisma `include` in `changeTicketStatus` so the response shape is consistent with other mutation endpoints. |
| CR-3 — `deleteTag` bypass | Rewrote to use `apiRequest` with proper auth header attachment and 204 No Content handling. |
| CR-2 — UUID param validation gap | Added `validate(uuidParamSchema, 'params')` to all routes that accept a `:id` path parameter (was missing on some routes before the review). |

---

## Suggestions Rejected (and why)

| Finding | Suggestion | Why Rejected |
|---------|-----------|--------------|
| #1 — Derive TERMINAL_STATES from map | Replace manual array with `Object.entries(VALID_TRANSITIONS).filter(...)` | **Rejected for readability.** The derived version is clever but harder to read at a glance. The current code has exactly two values that will never change (CLOSED and CANCELLED are defined in the product requirements as the only terminal states). The unit tests already verify `TERMINAL_STATES` matches the map's empty-array entries — any inconsistency would fail immediately. |
| #3 — Remove dead ZodError branch | Delete the `ZodError` handler from `errorHandler.ts` since `validate.ts` catches it first | **Rejected as defensive code.** If a future developer calls `schema.parse()` directly in a controller without the middleware (e.g., for a complex conditional validation), this branch would catch it. The inconsistent `|| 'unknown'` fallback was normalized to match `validate.ts` instead. |
| #4 — Add runtime `'status' in data` check | Throw ValidationError if status key exists in update data at service layer | **Rejected as unnecessary layering.** Zod strips unknown keys, the service destructures explicitly, and an integration test proves status is ignored. Adding a fourth defense layer for a hypothetical future mistake adds maintenance cost without adding safety today. If this were a public API with external contributors, I'd add it. For an internal tool maintained by a small team with steering docs, three layers is sufficient. |
| #7 — Optimistic concurrency lock | Add `where: { id, status }` to the Prisma update call | **Deferred, not rejected.** This is a real concern under load but the system is internal with low concurrency. The fix would change the error semantics (P2025 → needs mapping to a "conflict" error, not 404) and requires additional test coverage. Documented as a known gap for a future iteration rather than addressing in the Core scope. |
| #3B — 403 vs 409 for TICKET_LOCKED | Use 409 Conflict instead of 403 Forbidden for terminal-state lock | **Rejected for consistency with design.md.** The design document explicitly specifies 403 and the frontend's ErrorDisplay already uses the code to render a distinct amber banner. Changing it would require updating the design doc, frontend code, and tests — all for a debatable semantic improvement. The `TICKET_LOCKED` error code already disambiguates it from authorization-based 403s (`FORBIDDEN`). |
