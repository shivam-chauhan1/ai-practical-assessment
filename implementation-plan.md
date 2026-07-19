# Implementation Plan

## Overview

This plan describes how the Support Ticket Management System was built over ~2 days using Kiro's spec-driven workflow. The approach was: establish persistent project context (steering), produce formal requirements and design documents, generate a dependency-ordered task list, then execute tasks sequentially with verification at each checkpoint. Backend was completed first (all endpoints + tests passing) before any frontend work began.

The state machine was treated as the highest-risk piece and given dedicated tasks for implementation, testing, and review — separate from general CRUD work.

---

## Task Breakdown

### Phase 1: Foundation (~1.5 hours)

| Task | What | Depends On |
|------|------|------------|
| 1.1 | Prisma schema — User, Ticket, Comment with native PG enums | — |
| 1.2 | GIN trigram index migration for keyword search | 1.1 |
| 1.3 | Seed script — 5 users, 12 tickets across all statuses, 8 comments | 1.1 |
| 2.1 | Server package.json, tsconfig.json | — |
| 2.2 | Config module, custom error classes (AppError hierarchy), error handler middleware | 2.1 |
| 2.3 | Express app entry point with route mounting | 2.2 |
| 3.1 | Zod validation schemas (ticket create/update, status change, comment, list query) | 2.1 |
| 3.2 | Generic validation middleware (body/query/params support) | 3.1 |

### Phase 2: Backend Core (~2.5 hours)

| Task | What | Depends On |
|------|------|------------|
| 4.1 | Ticket service — create, list (with search/filter), getById, update (with terminal lock) | 3.2 |
| 4.2 | Ticket controller + routes (POST, GET, GET/:id, PATCH/:id) | 4.1 |
| 5.1 | State machine module — VALID_TRANSITIONS map, isValidTransition, getValidTransitions | 4.1 |
| 5.2 | changeTicketStatus service function — fetch, validate, update, return with validTransitions | 5.1 |
| 6.1 | Status-change controller + PATCH /tickets/:id/status route | 5.2 |
| 7.1 | Comment service — addComment (validates ticket + user exist, does NOT touch Ticket.updatedAt) | 4.1 |
| 7.2 | Comment controller + POST /tickets/:id/comments route | 7.1 |

### Phase 3: Backend Testing (~1.5 hours)

| Task | What | Depends On |
|------|------|------------|
| 9.1–9.5 | Property-based tests: valid/invalid transitions, terminal lock, comment bypass, OPEN-on-create | 7.2 |
| 10.1 | Integration tests: ticket CRUD endpoints | 7.2 |
| 10.2 | Integration tests: status-transition endpoint (all 5 valid + all 15 invalid + re-fetch) | 6.1 |
| 10.3 | Integration tests: comment endpoint | 7.2 |
| 10.4 | Property tests: search/filter correctness | 4.2 |

### Phase 4: Frontend (~2.5 hours)

| Task | What | Depends On |
|------|------|------------|
| 12.1 | Client scaffold — Vite + React Router (3 routes) + Vite proxy to backend | — |
| 13.1 | API layer — typed fetch wrappers, ApiError class, network error handling | 12.1 |
| 14.1 | TicketListPage — SearchBar (debounced), TicketCard, StatusBadge, PriorityBadge, EmptyState | 13.1 |
| 15.1 | TicketDetailPage — read-only view + CommentList + CommentForm | 13.1 |
| 16.1 | StatusTransitionControls — data-driven buttons from validTransitions, inline errors | 15.1 |
| 17.1 | CreateTicketPage — TicketForm with client + server validation | 13.1 |
| 18.1 | Edit mode on detail page — TicketEditForm, read-only for terminal tickets | 15.1 |
| 19.1 | ErrorDisplay + ErrorBanner + Toast component, wired into all pages | 18.1 |

### Phase 5: Frontend Tests + Polish (~1 hour)

| Task | What | Depends On |
|------|------|------------|
| 21.1 | StatusTransitionControls property test (correct buttons per status) | 16.1 |
| 21.2 | ErrorDisplay component tests (each error code) | 19.1 |
| 21.3 | TicketListPage tests (loading, rendering, search, filter, empty, error) | 14.1 |
| 21.4 | TicketDetailPage tests (detail, comments, 404, edit toggle, terminal read-only) | 18.1 |

### Phase 6: Stretch Features (~2 hours)

| Task | What | Depends On |
|------|------|------------|
| S1 | Ticket tagging — Tag model, many-to-many, CRUD endpoints, filter UI | Phase 2 |
| S2 | JWT auth — login endpoint, auth middleware, role guard, frontend login page | Phase 2 |
| S3 | Extended filters — priority, assignedTo, sortBy, pagination | Phase 2 |
| S4 | OpenAPI docs — zod-to-openapi registry, swagger-ui-express at /api-docs | S2 |

---

## Milestones

| Milestone | What it proves | When |
|-----------|---------------|------|
| **M1: Schema + Seed** | Database schema matches design, seed data covers all statuses | After Phase 1 |
| **M2: Backend Core** | All 7 endpoints respond correctly, state machine enforces all 5 transitions + rejects all invalid ones | After Phase 2 |
| **M3: Backend Tested** | 60+ tests pass (property + integration), CI green | After Phase 3 |
| **M4: Frontend Complete** | All pages render, errors displayed, status controls data-driven | After Phase 4 |
| **M5: All Tests Pass** | Server + client test suites green, ready for review | After Phase 5 |
| **M6: Stretch Delivered** | Auth, tags, pagination, OpenAPI all working | After Phase 6 |

---

## AI Usage Plan

### What Kiro was used for

| Phase | AI Role | Human Role |
|-------|---------|------------|
| **Steering setup** | Generated product.md, tech.md, structure.md from high-level description | Verified state machine transitions, confirmed enum naming, added FK constraint note |
| **Requirements** | Produced EARS-format requirements.md, raised 7 ambiguity questions | Answered ambiguities, confirmed business rules |
| **Design** | Generated design.md with Prisma schema, API spec, state machine code, correctness properties | Reviewed endpoint table against requirements, confirmed error code distinctions, requested design refinements |
| **Task generation** | Produced dependency-ordered tasks.md with requirement traceability | Fixed task ordering, split frontend detail page into two tasks, confirmed granularity |
| **Implementation** | Generated code for each task, ran TypeScript compilation checks, verified endpoints | Reviewed output at each checkpoint, manually tested with curl, confirmed behavior matches spec |
| **Testing** | Wrote property-based and integration tests, debugged UUID format issues | Verified re-fetch assertions exist for invalid transitions, requested additional edge-case coverage |
| **Code review** | Conducted targeted reviews (state machine, validation, pre-PR cleanup), flagged 7 findings | Assessed severity, decided which to fix vs. accept as known limitations |
| **Documentation** | Generated README, api-contract, data-model, ui-flow, test-strategy | Verified docs match actual implementation (reconciled drift) |

### What Kiro was NOT used for

- **Business decisions** — all answers to ambiguity questions came from human judgment
- **Real data** — explicitly instructed to never suggest importing real data; all seed data is synthetic
- **Architecture choices** — human chose the state-machine-as-map pattern, the terminal lock design, and the "ignore status in PATCH body" approach; Kiro implemented them
- **Risk assessment** — human identified the state machine as highest-risk; Kiro helped timebox other tasks around it

### Guardrails applied

- Set explicit boundary: no real user data or company taxonomy shared with the tool
- Verified state machine had exactly 5 transitions and no extras after every generation
- Re-fetched ticket status in tests (not just checking HTTP response code)
- Conducted code review specifically looking for places status could leak through unintended paths

---

## Risks

| # | Risk | Likelihood | Impact |
|---|------|-----------|--------|
| 1 | State machine logic has a gap allowing invalid transitions | Low | Critical — corrupts lifecycle data permanently |
| 2 | GIN trigram index migration fails on Postgres instances without pg_trgm extension | Medium | Low — search still works, just slower |
| 3 | TOCTOU race condition on concurrent status changes | Low | Medium — could allow an invalid transition under load |
| 4 | Priority enum mismatch between steering docs and implementation | Low | Medium — validation would reject valid values |
| 5 | Frontend silently swallows an error due to missing catch in a code path | Low | Medium — user doesn't see what went wrong |
| 6 | Test pollution from shared database in integration tests | Low | Low — flaky tests, not correctness issues |
| 7 | Token stored in React state lost on page refresh | Certain | Low — user logs in again; acceptable for internal tool |

---

## Mitigation

| Risk | Mitigation |
|------|-----------|
| **1 — State machine gap** | Exhaustive testing: all 25 (from, to) pairs covered by unit + property + integration tests at three layers. Code review confirmed single source-of-truth map with no duplication. |
| **2 — pg_trgm missing** | Migration uses `CREATE EXTENSION IF NOT EXISTS`. If it fails due to permissions, the GIN index can be skipped (task 1.2 is safe to timebox). Search works without it — just slower on large datasets. |
| **3 — TOCTOU race** | Acknowledged as a known gap for Core scope. Documented in code-review findings. Optimistic concurrency (WHERE clause with expected status) identified as the fix for a future iteration. |
| **4 — Enum mismatch** | Design.md is authoritative; product.md steering updated to say URGENT (not CRITICAL). Prisma schema verified to match. Zod uses `z.nativeEnum(Priority)` which validates against the generated Prisma client — any mismatch would fail at compile time. |
| **5 — Silent error swallowing** | ErrorDisplay component wired into every page. Frontend tests verify error rendering for each error code. Code review pass confirmed no bare `.catch(() => {})` patterns. |
| **6 — Test pollution** | Each test file creates its own isolated users/tickets with unique stable UUIDs. `afterEach` cleanup deletes test data. `--runInBand` prevents parallel execution against shared DB. |
| **7 — Token loss on refresh** | Accepted trade-off. For an internal tool, re-login after refresh is preferable to the XSS surface area of localStorage. Session duration (1h default) is generous enough to not be annoying in practice. |
