# AI Prompts — Testing

The mandatory tier for Core is integration tests proving the state-machine rules. TS-1 and TS-2 are the ones that actually count toward that requirement — don't skip TS-2, since under-testing the *invalid* transitions (especially from terminal states) is the easiest way to end up with a test suite that looks thorough but only really proves the happy path.

---

### TS-0 — Write test-strategy.md first

**Prompt:**
```
Before writing any test code, write test-strategy.md: what's covered by the
mandatory integration tier (state-machine transitions) versus what's explicitly out
of scope for Core, and why. Be honest about gaps — e.g. if frontend component tests
aren't planned for Core, say so and say why, rather than leaving it implied.
```
**Kiro's response:** Done. `test-strategy.md` is at the project root. Here's the summary:

**Mandatory (must pass before Core ships):**
- Tier 1: State-machine integration tests — all 5 valid transitions, all invalid rejections, terminal lock, comment bypass, `validTransitions` correctness
- Tier 2: CRUD + validation integration tests — every endpoint's happy/sad paths, consistent error shape

**Recommended but optional for Core:**
- Tier 3: Property-based tests with fast-check — generators ready in the design doc, mechanical to add post-Core

**Explicitly out of scope with reasoning:**
- Tier 4: Frontend component tests — frontend is a thin data-driven layer; highest-risk logic (which buttons to show) is computed server-side
- Tier 5: E2E browser tests — too slow/brittle for the budget; manual QA sufficient at this stage

**Known gaps table** — honest about what's not covered (concurrent writes, GIN index effectiveness, no CI) and what mitigates each.

Ready to write the actual test code whenever you are.

---

### TS-1 — State machine integration tests (mandatory tier)

**Prompt:**
```
Execute the testing task. Write Jest + Supertest integration tests in
server/tests/ticketStatus.test.ts against a real test database (a separate test
schema or DATABASE_URL_TEST — not mocks, I want these hitting Prisma for real).
Cover: each of the 5 valid transitions succeeds and persists the new status; each
transition NOT in the list is rejected with a 4xx and the ticket's status is
unchanged afterward (assert this by re-fetching, don't just trust the response
code); and one test confirming a completely invalid status string is rejected the
same way as an invalid transition. Set up and tear down test data per test so tests
don't depend on run order or leak into each other.
```

**What to check before moving on:** confirm the rejected-transition tests actually re-fetch the ticket and assert the status *didn't* change — a test that only checks the HTTP status code proves the endpoint returned an error, not that the rule actually held.

**Kiro's response:** I see the service imports `isValidTransition` but the state machine file exports `canTransition`. Let me check:

Good — it uses `isValidTransition` (not `canTransition`). Now let me check if there's a Jest config:

The roots are set to `<rootDir>/src` but the user wants the tests in `server/tests/`. Let me update the config and create the test file:

Now I have full context. Let me create the test file and update the configuration files.

Now I'll create the test file. Based on the code, the error response for validation failures uses `VALIDATION_ERROR` code and has the structure `{ error: { code, message, details } }`.

Now let's run the tests:

All 22 tests pass.

Integration tests are done and passing. Here's what's in place:

**File:** `server/tests/ticketStatus.test.ts` — 22 tests, all green.

**Coverage:**
- **5 valid transitions** — each confirmed via API response (200, correct status, correct `validTransitions`) AND a re-fetch from the DB to prove persistence
- **15 invalid transitions** — all combinations not in the map. Each returns 400 `INVALID_TRANSITION` with the from→to in the message. Each re-fetches to confirm the status is **unchanged** (not just trusting the response code)
- **1 bogus enum value** ("BOGUS_STATUS") — returns 400 `VALIDATION_ERROR` (from Zod, before it ever hits the state machine), status unchanged after re-fetch
- **1 non-existent ticket** — returns 404 `NOT_FOUND`

**Test isolation:**
- `beforeAll` creates a dedicated test user
- `afterEach` deletes all test tickets (keyed by `createdBy = TEST_USER_ID`)
- `afterAll` cleans up the test user
- `--runInBand` ensures sequential execution against the shared DB

**Config updates:**
- `jest.config.ts` — roots now includes `tests/`
- `tsconfig.json` — include now has `tests/**/*`

Run with: `cd server && npm test`

---

### TS-2 — Close the gap on terminal-state and reverse transitions

**Prompt:**
```
I don't see a test for the reverse direction — e.g. Resolved back to In Progress, or
Closed to anything. Add explicit tests asserting those are rejected too, not just
the "forward" invalid ones. Also add one for Cancelled -> anything, since Cancelled
has no valid outgoing transitions at all.
```
**Kiro's response:** Those cases are already covered. Let me show you — here's the `invalidTransitions` array from the test file:

They're already there. The `invalidTransitions` array contains all 15 invalid pairs, including exactly the ones you're asking about:

- **RESOLVED → IN_PROGRESS** (line 141: `{ from: 'RESOLVED', to: 'IN_PROGRESS' }`)
- **RESOLVED → OPEN** (line 140: `{ from: 'RESOLVED', to: 'OPEN' }`)
- **CLOSED → everything** (lines 143–146: CLOSED → OPEN, IN_PROGRESS, RESOLVED, CANCELLED — all 4)
- **CANCELLED → everything** (lines 147–150: CANCELLED → OPEN, IN_PROGRESS, RESOLVED, CLOSED — all 4)

The test uses `it.each(invalidTransitions)` so each pair runs as its own named test case: `"CLOSED → OPEN is rejected and status is unchanged"`, etc. Each one re-fetches after the 400 to confirm the status didn't change.

All 15 invalid transitions (the complete complement of the 5 valid ones across 5×5=25 total pairs minus 5 self-transitions which aren't tested because the backend treats "same status" as invalid too) are covered. The test suite passes with 22 tests total.

---

### TS-3 — General API smoke coverage

**Prompt:**
```
Add a lighter integration test file for the rest of the ticket API — create, list
with search+status combined, get-by-id including comments, and update — enough to
catch a broken endpoint, not exhaustive. Include one test confirming a PATCH with a
status field in the body is ignored rather than silently changing status, matching
the IM-4 design decision.
```
**Kiro's response:** Now I have a full picture of the API. Let me also check how the comment service works to confirm the response shape:

Now I have all the context needed. Let me create the test file:

Now let me run the tests:

3 tests failing with 400 Bad Request. The test user IDs aren't valid UUIDs — they don't match the UUID format that Zod is validating. Let me check what format Zod expects and also look at the actual error responses to debug:

The issue is the test user IDs `crud-test-user-0000-000000000001` aren't valid UUIDs. Zod's `z.string().uuid()` rejects them. I need to use proper UUID-formatted IDs:

All 16 tests pass. Let me respond to the parent agent:

CRUD integration tests are written and passing — 16 tests in `server/tests/ticketCrud.test.ts`.

**Key tests:**

| Endpoint | Tests |
|----------|-------|
| POST /api/tickets | Create success (returns OPEN), missing title (400), non-existent user (404) |
| GET /api/tickets | Ordered by updatedAt desc, keyword filter (case-insensitive), status filter, combined AND |
| GET /api/tickets/:id | Returns ticket with comments + author name populated, 404 for missing |
| PATCH /api/tickets/:id | Updates fields, unassign via null, TICKET_LOCKED on CLOSED, **status field ignored** |
| POST /api/tickets/:id/comments | Success with author populated, allowed on CLOSED, empty body rejected |

The critical test you asked about:

```
it('IGNORES a status field in the PATCH body — status is unchanged')
```

Sends `{ title: 'New title', status: 'CLOSED' }` to an OPEN ticket. Asserts the response shows status still OPEN, then re-fetches from the database to confirm it wasn't silently changed.

Run everything with: `cd server && npm test`

---

## Stretch add-ons (optional)

### TS-S1 — Unit tests for the state machine in isolation

**Prompt:**
```
Add unit tests for ticketStateMachine.ts in isolation — no database, no Express,
just canTransition(from, to) for every combination in a table-driven test, so the
business rule is proven independent of the API layer too.
```
**Kiro's response:** This request is straightforward — you want unit tests for `ticketStateMachine.ts` in isolation. Let me first find the existing file to understand the module's API, then I'll implement the tests directly.

I can see the state machine lives at `server/src/services/stateMachine.ts`. Let me read it:

Now let me check what test infrastructure already exists — specifically the existing property test for it and the Jest config:

Good. There's already a property-based test, but you want a simple table-driven unit test that explicitly enumerates every `(from, to)` combination with expected results — no fast-check, no database, just plain deterministic assertions. Let me check the Jest config to confirm placement and module resolution:

Good — tests go in `server/tests/`. Now I have everything I need. The steering rule says "Tests live next to the code they test", but the Jest config explicitly roots tests in `<rootDir>/tests`. I'll follow the existing convention and place the test in `server/tests/` where the other state machine tests already live.

Let me create the table-driven unit test:

Now let me run just this test file to verify it passes:

All 37 tests pass. Here's what was created:

**`server/tests/stateMachine.unit.test.ts`** — a pure unit test (no DB, no Express) with:

- A full 5×5 truth table using `it.each` that asserts `isValidTransition(from, to)` for every possible status combination (5 valid, 20 invalid).
- A sanity check that exactly 5 valid transitions exist.
- Dedicated assertions for `getValidTransitions()` per status.
- `isTerminalState()` checks for all 5 statuses.
- `TERMINAL_STATES` constant verification.

The business rule is now proven in isolation from the API and database layers.

---

### TS-S2 — Edge-case and failure tests

**Prompt:**
```
Add edge-case tests: creating a ticket with an empty title, a description over some
reasonable max length, an assignedTo pointing at a non-existent user id, a comment
with only whitespace, and a search query containing special characters like % or _
that could interact oddly with a SQL ILIKE — confirm none of these 500, all return
clean 4xx responses.
```
**Kiro's response:** This is a straightforward request to add edge-case integration tests — not really a spec-driven feature or bugfix. Let me just write the tests directly.

Let me first look at the existing test setup to match the project's patterns.

Now let me look at the ticket validation schemas and search endpoint to understand what constraints exist:

Now let me look at the ticket service to understand how search/keyword works with SQL:

Now I have a clear picture. The search uses Prisma's `contains` with `mode: 'insensitive'`, which translates to `ILIKE` in Postgres. Let me also check the package.json to confirm jest/supertest setup:

I have everything I need. Now I'll create the edge-case test file:

Now let's run the tests to verify they pass:

All 16 tests pass. Here's what the test file covers:

**`server/tests/edgeCases.test.ts`** — confirms clean 4xx responses (no 500s) for:

1. **Empty title** → 400 VALIDATION_ERROR
2. **Whitespace-only title** → 400 VALIDATION_ERROR  
3. **Description over 5000 chars** → 400 VALIDATION_ERROR
4. **assignedTo with non-existent user ID** → 404 NOT_FOUND
5. **Comment with only whitespace/tabs/newlines** → 400 VALIDATION_ERROR
6. **Search keyword with `%`** — literal match, no wildcard expansion, 200 OK
7. **Search keyword with `_`** — literal match, not treated as single-char wildcard, 200 OK
8. **Search keyword with backslash, single quote, double quote, semicolons** — all return 200 cleanly (no SQL injection, no crashes)
9. **Title boundary tests** (3 chars min, 200 chars max) — just-at-boundary succeeds, one-past-boundary gets 400

Prisma's `contains` mode handles the ILIKE escaping properly out of the box, so `%` and `_` are treated as literal characters and don't cause wildcard matching or server errors.