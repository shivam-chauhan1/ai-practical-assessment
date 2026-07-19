# Reflection

## What I Built

A full-stack support ticket management system — an internal tool where staff create, update, comment on, search, and progress tickets through a strict status lifecycle. The signature piece is the state machine: five valid transitions, terminal-state locking, and exhaustive testing proving the invariant holds across all 25 possible (from, to) pairs.

**Delivered scope:**
- Core: Ticket CRUD, state-machine enforcement, comments (decoupled from updatedAt), keyword search + status filter, Zod validation, consistent error responses, frontend with data-driven status controls
- Stretch: JWT auth (bcrypt, ADMIN-only status changes), ticket tagging (many-to-many), pagination/sorting/extended filters, OpenAPI docs at /api-docs

**Key numbers:**
- 12 API endpoints, all with Zod validation
- 60+ backend tests (property-based + integration), 20+ frontend component tests
- 5 Kiro specs (requirements → design → tasks for each feature)
- CI pipeline running against Postgres on every push

---

## How I Used AI (across the lifecycle)

| Phase | AI's Role | My Role |
|-------|-----------|---------|
| **Project setup** | Generated steering docs (product, tech, structure) | Verified state machine transitions, confirmed enum choices |
| **Requirements** | Produced EARS-format requirements, raised 7 ambiguity questions | Answered all ambiguities based on product judgment |
| **Design** | Generated full design.md (schema, API spec, state machine code, correctness properties) | Reviewed against requirements, requested refinements (drop delete endpoint, add error JSON examples) |
| **Task planning** | Generated dependency-ordered task list | Fixed task ordering, split oversized tasks, confirmed granularity |
| **Implementation** | Generated code for each task, verified TypeScript compilation | Reviewed at checkpoints, manually tested with curl, confirmed behavior |
| **Testing** | Wrote property-based and integration tests | Verified re-fetch assertions, requested additional edge-case coverage |
| **Code review** | Conducted 3 targeted review passes (7 findings) | Assessed severity, decided what to fix vs. reject vs. defer |
| **Documentation** | Generated README, api-contract, data-model, ui-flow | Verified docs match implementation, reconciled drift |

**The pattern:** I made decisions, Kiro executed them. I didn't outsource judgment — I outsourced typing.

---

## What AI Helped With Most

1. **Boilerplate elimination.** Setting up Express with TypeScript, Prisma schema with relations, Zod schemas, React Router scaffolding — all of this is well-understood code that would take time to type manually but adds no intellectual value. Kiro generated it correctly on the first pass.

2. **Exhaustive testing.** Writing all 25 transition pairs by hand is tedious and error-prone. Generating `it.each(invalidTransitions)` with the full complement of invalid pairs — including reverse transitions and terminal-state escapes — would have been easy to miss one. The property-based tests (fast-check over the cross-product) add another layer I might have skipped under time pressure.

3. **Consistency enforcement.** When I asked Kiro to review whether the error shape was consistent across routes, it checked every single endpoint methodically. That kind of sweep is the type of work humans skip when they're tired. Having it automated meant finding the `deleteTag` bypass bug.

4. **Documentation that matches reality.** Writing api-contract.md by hand from the design doc would have introduced drift (since the design was written before stretch features were added). Kiro read the actual implementation and reconciled the docs to what was built, not what was planned.

---

## What AI Got Wrong

1. **Priority enum confusion.** The steering doc (product.md) said CRITICAL, but I specified URGENT in the design prompt. Kiro used URGENT in the Prisma schema (correct per my instruction) but never flagged the inconsistency with product.md until the code review. If I hadn't run a review pass, this would have been a documentation gap that confused future developers.

2. **Missing tags in status-change response.** The `changeTicketStatus` service included `{ creator: true, assignee: true }` but omitted `tags: true`, making the response shape inconsistent with other endpoints. Kiro generated this code during task execution without noticing the inconsistency — it only caught it during the explicit review pass.

3. **Test user IDs in wrong format.** The first version of integration tests used human-readable IDs like `crud-test-user-0000-000000000001` which aren't valid UUIDs. Zod correctly rejected them (which is the right behavior), but Kiro should have known the schema requires RFC 4122 format since it wrote the schema itself.

4. **PowerShell escaping blindspot.** When testing with curl on Windows, Kiro initially generated bash-style JSON payloads that PowerShell mangled. It took a few failed attempts before switching to file-based payloads. A tool that's aware of its execution environment should handle this from the start.

5. **Dead code in error handler.** Kiro generated both a ZodError handler in `validate.ts` AND a separate one in `errorHandler.ts`. While the duplicate is defensible, generating it in two places without acknowledging the redundancy shows a lack of holistic awareness during implementation.

---

## How I Validated AI Output

**At every checkpoint:**
- TypeScript compilation (`tsc -b`) must pass with zero errors
- Manual curl testing of key endpoints (status transitions, validation errors, terminal lock)
- Re-running full test suite after changes

**For the state machine specifically:**
- Verified all 5 transitions listed (no extras silently added)
- Verified test re-fetches ticket after invalid transition (doesn't just trust the HTTP code)
- Verified `validTransitions` in API responses matches the map for each status
- Manually tested CLOSED→IN_PROGRESS to confirm it's rejected (the most tempting "reopen" path to accidentally allow)

**For code review findings:**
- Read the actual source code to confirm findings (not just trusting the review output)
- Independently assessed severity before deciding what to fix
- Wrote my own "Suggestions Rejected" reasoning rather than accepting or dismissing wholesale

**For documentation:**
- Compared api-contract.md against actual route files to confirm no endpoint was missing
- Verified error codes in the doc match error codes in the error classes
- Confirmed seed data counts match what the seed script actually creates

---

## What I Would Improve Next

1. **Optimistic concurrency on status transitions.** The TOCTOU race condition (Finding #7 from CR-1) is a real concern if this moved to higher load. The fix is straightforward — add `status: currentStatus` to the Prisma `where` clause — but requires updating error mapping (P2025 → "conflict" rather than "not found") and adding test coverage.

2. **Contract testing between frontend and backend.** The frontend mocks API shapes manually. If the backend renames a field, frontend tests still pass while the real app breaks. OpenAPI contract tests (or a shared schema package) would close this gap.

3. **E2E test for the full lifecycle.** One Playwright test that creates a ticket, transitions it through all states, verifies terminal lock, and adds a comment would catch integration bugs that unit/component tests can't reach.

4. **Derive TERMINAL_STATES from the map.** I rejected this during review for readability reasons, but if the state machine ever grows (e.g., adding a PENDING state), manually maintaining both the map and the array is a maintenance risk. With a clear comment explaining the derivation, readability is acceptable.

5. **Audit log for status changes.** Status transitions are the most important events in the system but leave no trail beyond the updated `updatedAt` timestamp. An audit log (who changed what, when, from which status to which) would add accountability.

---

## Reusable Workflow (prompts, rules, specs, templates)

### The workflow that worked

```
1. Steering first     → product.md, tech.md, structure.md (persistent context)
2. Requirements       → EARS format, explicit ambiguity resolution
3. Design             → Full API spec + data model + correctness properties
4. Tasks              → Dependency-ordered, backend/frontend split, risk-based sizing
5. Implement          → Task by task with compilation checks
6. Test               → Property-based for invariants, integration for contracts
7. Review             → Targeted passes (critical path, validation, cleanup)
8. Document           → Reconcile to what was actually built, not what was planned
```

### Prompts that were particularly effective

- **"Flag anything — don't just tell me it looks fine"** on code review — explicitly asking for criticism produces better output than asking "is this okay?"
- **"Before moving to design, give me a short list of ambiguities"** — forces the tool to think about what's unclear rather than making silent assumptions
- **"Confirm these three things are correct"** (DN-2 on data model) — checking specific invariants is more reliable than open-ended "review this file"
- **"Show the exact JSON error shape for X versus Y"** — requesting concrete examples prevents vague "they're different" answers

### Rules that prevented problems

- **Never share real data** — established at project start (PL-2), prevented any chance of sensitive data leaking into generated code or seed scripts
- **Backend validates everything independently** — stated as a design principle, caught in tests (e.g., status field ignored in PATCH body)
- **State machine as single source of truth** — said once in steering, enforced throughout. Kiro never suggested duplicating the transitions map.

### Templates worth reusing

- **Steering docs** (product/tech/structure) — 3 concise files that anchor every future task. Low effort, high leverage.
- **EARS-format requirements** — WHEN/IF/WHILE/THEN structure produces testable acceptance criteria, not vague stories
- **Correctness properties in design.md** — formal statements that map directly to property-based tests
- **Task dependency graph as JSON waves** — enables parallel execution planning without complex project management tooling
