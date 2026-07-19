# AI Prompts — Planning

Covers Part A questions on requirement analysis and planning/design. The prompts that generated the actual requirements — ST-1, ST-2, RQ-1, RQ-2 — live in `tool-specific/kiro-specs/spec-kickoff-prompts.md`, since running them is what produces `requirements.md`. This file logs how those went, plus two planning-only prompts that aren't part of the spec itself.

---

## Referenced from kiro-specs

### ST-1 — Steering docs setup
See `tool-specific/kiro-specs/spec-kickoff-prompts.md`.

### ST-2 — Steering refinement
See `tool-specific/kiro-specs/spec-kickoff-prompts.md`.

### RQ-1 — Spec kickoff / requirements
See `tool-specific/kiro-specs/spec-kickoff-prompts.md`.

### RQ-2 — Requirements refinement
See `tool-specific/kiro-specs/spec-kickoff-prompts.md`.

---

## Planning-only prompts

### PL-1 — Sanity-check scope against available time

**Prompt:**
```
Given the tasks.md you just generated and that I have roughly 8-10 focused hours for
the Core build, flag any tasks that look underestimated. Tell me which ones I could
timebox strictly and move past if they run long, versus which ones — I'd guess the
state machine work — are worth spending extra time on to get right.
```

**Why this prompt:** using AI to sanity-check scope against real time constraints, rather than only for code generation, is itself worth showing — it's planning judgment, not implementation.

**Kiro's response:** _Here's my assessment against an 8–10 hour budget:

---

**Likely underestimated tasks:**

| Task | Why it could run long | Estimate |
|------|----------------------|----------|
| **1 — Prisma schema + migration + seed** | The GIN trigram index (1.2) requires a raw SQL migration outside Prisma's normal flow. If `pg_trgm` isn't already enabled on your PG instance, you'll hit a permissions issue. The schema itself is fast, but verifying the migration actually applies cleanly against a real DB takes fiddling. | ~45 min (plan 30, budget 45) |
| **4 — Ticket CRUD service** | This is the biggest single task. Four service functions, Prisma includes/relations, the ILIKE search logic, terminal-lock check, nullable assignee unassign. It's dense. | ~90 min (plan 60, budget 90) |
| **9 — State-machine property tests** | Setting up `fast-check` for the first time in the project, writing generators, and getting the test DB harness right for 9.3/9.4 (which need actual Prisma calls) will take longer than the pure unit tests in 9.1/9.2. | ~60 min (plan 30, budget 60) |
| **19 — Error display + wiring** | Touching every page to wire in error handling after the fact is integration work that always takes longer than it looks. | ~45 min (plan 30, budget 45) |

---

**Worth spending extra time on (don't timebox these):**

- **Task 5 (state machine module + changeTicketStatus service)** — You're right, this is the highest-risk piece. The transitions map itself is trivial, but `changeTicketStatus` is where the InvalidTransitionError message formatting, the interaction with terminal-state lock, and the `validTransitions` response field all converge. A bug here cascades into the frontend (wrong buttons), the tests (false passes), and the error display. Spend the time to get the error messages exact and manually verify each of the 5 valid + a few invalid transitions with curl before moving on.

- **Task 9 (state-machine property tests)** — These are your safety net for task 5. If the properties pass, you have high confidence the state machine is correct across all combinations, not just your manually-tested happy paths. Worth the extra setup time.

- **Task 4.1 (ticket service — specifically the search logic)** — The ILIKE + status filter AND logic plus the Prisma `where` composition is subtle. A wrong `AND`/`OR` nesting silently returns wrong results rather than crashing. Test it manually with a few seeded tickets before moving on.

---

**Safe to timebox strictly (move past if they run long):**

- **Task 1.2 (GIN trigram index)** — If it's fighting you, skip it. The search still works without the index — it's just slower, and with a small dataset in Core that won't matter. You can add the index later in a one-line migration.

- **Task 10 (API integration tests)** — Valuable but not blocking. If you're at hour 7 and the backend works manually, skip full Supertest coverage and write a handful of smoke tests instead. The property tests (task 9) cover the critical logic.

- **Task 21 (frontend component tests)** — These are already marked optional (`*`). Skip entirely if time is tight. The backend tests are more valuable for correctness.

- **Task 14 (ticket list page)** — The list page is UI busywork. If it runs long on styling or the SearchBar debounce, ship it "ugly but functional" and polish later.

- **Task 19 (error display wiring)** — If you're out of time, ship with `console.error` + a basic `alert()` or inline text. The ErrorDisplay component is nice-to-have polish; the backend already returns structured errors either way.

---

**Rough time allocation for 9 hours:**

| Block | Hours | Tasks |
|-------|-------|-------|
| DB + backend scaffolding | 1.5 | 1, 2, 3 |
| Ticket CRUD | 1.5 | 4 |
| State machine (take your time) | 1.0 | 5, 6 |
| Comments + search verification | 0.5 | 7 |
| State-machine tests (take your time) | 1.0 | 9 |
| Frontend setup + API layer | 0.5 | 12, 13 |
| Frontend pages | 2.0 | 14, 15, 16, 17, 18 |
| Error wiring (timebox) | 0.5 | 19 |

That leaves task 10 (API integration tests) and task 21 (frontend tests) as stretch goals if you finish early. If something runs long, cut from the frontend tests and the GIN index first._

---

### PL-2 — Set a boundary on context sharing

**Prompt:**
```
Before we go further — I'm not going to share any real user data or the company's
actual ticket taxonomy with you; the User/Ticket/Comment fields and all seed data
will be synthetic placeholders I write myself. Keep that in mind if you ever suggest
"importing existing data" — always default to generated fake data for seeding.
```

**Why this prompt:** this directly answers Part A question 10 ("what information you avoid sharing unnecessarily with AI tools") with a real instruction given to the tool, not just a policy statement in a doc.

**Kiro's response:** _Noted. All seed data will be synthetic/fake — I'll never suggest importing real data or reference actual company information. Whenever seeding comes up, it's generated placeholder users and tickets with made-up names and content. Ready to move forward whenever you are._