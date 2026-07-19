# Final AI Usage Summary

## Tool Used

**Kiro** — spec-driven AI development environment  
**Plan:** Kiro Pro  
**Credits used:** ~450 / 1,000 (45% of monthly allocation)  
**Assessment duration:** 2 days (18–19 July 2026)

---

## Usage Breakdown by Phase

| Phase | Approx. % of credits | What AI did | What I did |
|-------|---------------------|-------------|-----------|
| Steering setup | ~2% | Generated 3 project context files | Verified state machine, confirmed enums, added FK constraint note |
| Requirements (5 specs) | ~8% | EARS-format docs, raised ambiguities | Answered all business decisions |
| Design (5 specs) | ~10% | Architecture, API spec, data model, correctness properties | Requested refinements, confirmed error shape distinctions |
| Task generation | ~5% | Dependency-ordered task lists with traceability | Fixed ordering, split oversized tasks |
| Implementation (Core) | ~30% | Code generation for all backend + frontend tasks | Reviewed at checkpoints, manual curl testing |
| Implementation (Stretch) | ~15% | JWT auth, tags, filters, OpenAPI docs | Reviewed, verified integration |
| Testing | ~12% | Property-based + integration tests, edge cases | Verified re-fetch assertions, requested additional coverage |
| Code review | ~5% | 3 targeted review passes (7 findings) | Assessed severity, decided fix/reject/defer |
| Documentation | ~13% | README, api-contract, data-model, ui-flow, all assessment docs | Verified accuracy, reconciled to implementation |

---

## Interaction Pattern

**Total interactions:** ~60–70 prompts across the full assessment

**Prompt categories:**
- Spec workflow prompts (steering, requirements, design, tasks): ~15
- Implementation prompts (execute task X): ~25
- Testing prompts (write tests for Y): ~10
- Code review prompts: 3
- Documentation prompts: ~10
- Planning/debugging/refinement: ~7

**Average prompt length:** 3–6 sentences (specific, constrained, with explicit acceptance criteria)

---

## What AI Generated vs. What I Wrote

### AI Generated (then reviewed by me)
- All source code (server + client)
- All test files (33 server + 12 client)
- Prisma schema and migrations
- Seed script
- CI pipeline configuration
- All documentation files
- Spec artifacts (requirements.md, design.md, tasks.md × 5 features)
- Steering docs

### I Wrote / Decided (AI could not)
- Answers to all 7 ambiguity questions (business decisions)
- State machine transitions (which 5 are valid, no others)
- Priority enum naming choice (URGENT, not CRITICAL)
- Terminal-state lock behavior (edits locked, comments allowed)
- Which code review findings to fix vs. reject vs. defer
- Time allocation and scope prioritization
- Data privacy boundary (no real data shared)

---

## Quality of AI Output

### First-pass accuracy (code that compiled and worked without changes)
- **Prisma schema:** 100% — correct on first generation
- **Zod schemas:** 100% — trim + length + enum validated correctly
- **State machine module:** 100% — map, functions, all correct
- **Express routes/controllers:** ~95% — occasionally needed Prisma include adjustments
- **React components:** ~90% — sometimes needed TypeScript fixes for strict mode
- **Tests:** ~85% — UUID format issue, PowerShell escaping needed correction
- **Documentation:** ~95% — minor reconciliation needed for stretch features

### Issues caught during review (not caught during generation)
- Missing `tags: true` in one Prisma include (inconsistent response shape)
- `deleteTag` using raw fetch instead of shared helper (auth bypass)
- Dead ZodError branch with inconsistent fallback behavior
- Priority enum mismatch between steering and implementation docs

---

## Efficiency Gains

| Task | Estimated time without AI | Actual time with AI | Savings |
|------|--------------------------|--------------------:|--------:|
| Prisma schema + migrations + seed | 45 min | 10 min | 78% |
| Express scaffolding (routes, controllers, middleware) | 2 hours | 20 min | 83% |
| State machine + tests | 1.5 hours | 25 min | 72% |
| React pages + components | 3 hours | 40 min | 78% |
| Integration test suite | 2 hours | 30 min | 75% |
| Documentation (7 files) | 2 hours | 25 min | 79% |
| **Total Core build** | **~12 hours** | **~3 hours** | **~75%** |

The efficiency gain was highest on boilerplate (scaffolding, CRUD) and lowest on the state machine and review work — those required the most human judgment regardless of AI involvement.

---

## What I Would NOT Trust AI To Do Alone

1. **Business rule decisions** — "Can comments go on closed tickets?" has no objectively correct answer. It's a product choice that depends on how the team works.
2. **Security-sensitive code without review** — the `deleteTag` auth bypass proves AI can silently generate insecure code that compiles and passes basic tests.
3. **Choosing what NOT to build** — deciding that Core doesn't need pagination, delete endpoints, or user management is a scoping judgment AI can't make.
4. **Assessing code review findings** — whether a TOCTOU race condition matters depends on deployment context (internal low-traffic tool vs. public API). AI flags it; humans decide.
5. **Validating correctness of tests** — AI wrote tests that check response codes, but I had to verify they also re-fetch to confirm persistence. The difference between "returns 400" and "returns 400 AND status is unchanged" is the difference between a useful test and a false sense of security.

---

## Lessons Learned

1. **Steering files are the highest-leverage investment.** 15 minutes of setup saved hours of re-explaining context. Every subsequent interaction benefited from the state machine being pre-defined.

2. **"Flag anything" produces better reviews than "is this okay?"** Explicitly asking for criticism — not validation — surfaces findings the AI would otherwise suppress to seem agreeable.

3. **Review after implementation, not during.** Code review as a separate pass (not inline while generating) catches cross-cutting issues that are invisible task-by-task (like inconsistent response shapes across endpoints).

4. **Property-based tests catch what examples miss.** The fast-check tests for state machine transitions cover 25 pairs exhaustively — hand-writing example tests might have covered 8–10 and missed a reverse transition.

5. **AI works best on well-constrained tasks.** "Execute the status-transition task per design.md" produces better output than "build the backend." Specificity in, quality out.
