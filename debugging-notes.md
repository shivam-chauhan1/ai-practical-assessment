# Debugging Notes

## Issue 1: Prisma Init CLI Version Error

### Problem
Running `npx prisma init` during project scaffolding threw a CLI version mismatch error and refused to execute. The project needed an initialized Prisma schema to proceed with database setup.

### How I Investigated
Checked the error message — it indicated a conflict between the globally cached Prisma CLI version and the locally installed package version. The `allowScripts` npm restriction was also preventing Prisma's postinstall script from running, which generates the CLI binary.

### How AI Helped
Kiro identified that `prisma init` only creates two files (`schema.prisma` and `.env`) and suggested skipping the CLI command entirely by creating `schema.prisma` manually with the identical content the command would have generated.

### What I Validated
- `schema.prisma` had the correct `postgresql` provider and `env("DATABASE_URL")` datasource
- `npx prisma migrate dev` ran successfully against a real database on the next task
- The generated Prisma Client matched the schema exactly

### Final Fix
Created `server/prisma/schema.prisma` manually rather than relying on `npx prisma init`. Functionally equivalent — the first `prisma migrate dev` worked normally.

---

## Issue 2: PowerShell Escaping Mangling JSON in curl Commands

### Problem
Testing API endpoints with `curl` on Windows PowerShell failed — JSON request bodies were being mangled. String interpolation and quote escaping in PowerShell corrupted the JSON sent to the server, causing 400 validation errors that looked like server bugs but were actually client-side.

### How I Investigated
Checked the server error logs — the received body was garbled (missing quotes, `$` characters interpreted as variables). Recognized this as a PowerShell-specific escaping issue, not a backend bug.

### How AI Helped
Kiro identified the root cause immediately (PowerShell interprets `$` and double quotes differently than bash) and switched to writing JSON payloads to temporary `.json` files, then using `curl --data @file.json` syntax to avoid shell escaping entirely.

### What I Validated
- Same request body worked correctly when sent from a `.json` file
- Server returned expected 201/200 responses with correct data
- Confirmed this was purely a testing ergonomics issue, not a code bug

### Final Fix
Used file-based JSON payloads for manual API testing on Windows. For automated tests, Supertest handles JSON natively without shell escaping concerns.

---

## Issue 3: Test User UUIDs Rejected by Zod Validation

### Problem
Integration tests in `ticketCrud.test.ts` were failing with 400 Bad Request. Three tests that created tickets returned `VALIDATION_ERROR` on the `createdBy` field.

### How I Investigated
Read the error response: Zod's `.uuid()` validator was rejecting the test user IDs. The test was using IDs like `crud-test-user-0000-000000000001` — human-readable but not valid UUID format (UUIDs must be 8-4-4-4-12 hex characters).

### How AI Helped
Kiro spotted the format mismatch between the test data and the Zod schema. Showed that `z.string().uuid()` enforces RFC 4122 format strictly. Suggested replacing with properly formatted UUIDs like `00000000-0000-4000-a000-000000000001`.

### What I Validated
- Changed test user IDs to valid UUID format
- All 16 tests passed after the fix
- Confirmed the Zod schema correctly rejects malformed UUIDs (which is the desired behavior)

### Final Fix
Replaced human-readable test IDs with properly formatted UUIDs. The validation was working correctly — the test data was wrong, not the code.

---

## Issue 4: Prisma P2025 Error Not Mapped to 404

### Problem
During the error-handling task, certain "not found" scenarios were returning generic 500 errors instead of clean 404 responses. Specifically, when Prisma's `update()` targeted a record that didn't exist, it threw a `PrismaClientKnownRequestError` with code `P2025` which wasn't being caught by the error handler.

### How I Investigated
The error handler already handled custom `AppError` subclasses (including `NotFoundError`), but Prisma throws its own error type for missing records during update/delete operations. The service layer explicitly throws `NotFoundError` for `findUnique` misses, but `update()` with a non-existent ID hits Prisma's internal check first.

### How AI Helped
Kiro identified the gap during the error-handling review: the `errorHandler.ts` needed a dedicated branch for `PrismaClientKnownRequestError` with code `P2025`, mapping it to 404 `NOT_FOUND` with a generic "resource not found" message (no raw DB details leaked).

### What I Validated
- Added `PrismaClientKnownRequestError` import and P2025 check to error handler
- Tested with a non-existent ticket UUID — now returns clean 404
- Confirmed no raw Prisma error details appear in the response body
- TypeScript compiled cleanly

### Final Fix
Added a Prisma P2025 handler to `errorHandler.ts` that maps to 404 NOT_FOUND with a safe generic message. All other Prisma errors fall through to the 500 catch-all.

---

## Issue 5: `deleteTag` Frontend Function Bypassing Auth

### Problem
During the pre-PR code review (CR-3), Kiro flagged that the `deleteTag` function in the frontend API layer was using a raw `fetch()` call instead of the shared `apiRequest()` helper. This meant it wasn't attaching the JWT Bearer token or handling errors consistently.

### How I Investigated
Read the `client/src/api/tags.ts` file — confirmed that `deleteTag` was indeed calling `fetch()` directly while every other API function used `apiRequest()`. The function also wasn't handling the 204 No Content response correctly (trying to parse JSON from an empty body).

### How AI Helped
Kiro caught this during a broad "unused imports + stale patterns" review pass. Provided the corrected implementation using `apiRequest` with proper 204 handling (checking `response.status === 204` before attempting JSON parse).

### What I Validated
- Replaced raw `fetch` with `apiRequest`
- Auth token now attached automatically
- 204 response handled without JSON parse error
- No remaining raw `fetch` calls outside the `apiRequest` helper itself
- TypeScript compiled cleanly

### Final Fix
Rewrote `deleteTag` to use the shared `apiRequest` helper with a special case for 204 No Content responses.

---

## Issues Not Encountered (from pre-drafted prompts)

The following debugging scenarios were pre-drafted as likely issues for this stack but were not actually hit during development:

- **DB-1 (Prisma enum casing mismatch)** — not encountered because the frontend mirrors the exact enum values from `@prisma/client` via the shared types file, and Zod uses `z.nativeEnum()` which validates against the Prisma-generated types directly.
- **DB-2 (CORS errors)** — not encountered because Vite's dev server proxy (`/api` → localhost:3001) means the browser never makes cross-origin requests in development. The Express CORS middleware is configured but never triggered during local dev.
- **DB-3 (Concurrent write conflicts)** — acknowledged as a theoretical risk in the code review (Finding #7: TOCTOU race condition), but never manifested during development due to single-user testing. Documented as a known gap with a proposed fix (optimistic concurrency via WHERE clause).
- **DB-4 (Non-idempotent seed script)** — prevented by design. The seed script uses `prisma.user.upsert()` with stable UUIDs from the start, so running it twice produces no errors. Verified explicitly during IM-2.
