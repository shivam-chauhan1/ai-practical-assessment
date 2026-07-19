# Tool Workflow

## Tool: Kiro

Kiro is a spec-driven AI development environment. Unlike general-purpose chat assistants, it provides structured workflows for turning ideas into working code through formal requirements, design documents, and dependency-ordered task execution — with persistent project context that applies to every interaction.

---

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│  1. STEERING (persistent, project-wide)                      │
│     product.md · tech.md · structure.md                      │
│     Applied automatically to every future interaction        │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2. REQUIREMENTS (per feature)                               │
│     EARS-format acceptance criteria                           │
│     Ambiguity resolution before design                       │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3. DESIGN (per feature)                                     │
│     Architecture, API spec, data model, correctness props    │
│     Reviewed and approved before implementation              │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  4. TASKS (per feature)                                      │
│     Dependency-ordered, small enough to verify individually  │
│     Requirement traceability on every task                   │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  5. EXECUTE (task by task)                                    │
│     Code generation → TypeScript check → manual verify       │
│     Checkpoints between phases                               │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  6. REVIEW & DOCUMENT                                        │
│     Targeted code review passes                              │
│     Documentation reconciled to actual implementation        │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Steering Setup

**What:** Three concise markdown files in `.kiro/steering/` that define the project's identity, tech choices, and structural conventions.

**Files created:**
- `product.md` — what the product is, who uses it, core entities, the state machine (verbatim transitions)
- `tech.md` — stack (Node 20, TypeScript, Express, Prisma, PostgreSQL, React, Vite), conventions (native enums, FK references, Zod validation)
- `structure.md` — monorepo layout, server layering (routes→controllers→services→Prisma), client organization, test placement

**Why it matters:** These are injected into every future prompt automatically. Once the state machine is written in product.md, Kiro never generates code that allows transitions not in the list — without needing to re-state it every time.

**Human judgment applied:** Verified state machine had exactly 5 transitions and no extras. Added FK constraint note (assignedTo/createdBy are references, never free-text names). Added single config module rule.

---

## Step 2: Requirements (per feature)

**What:** Formal requirements document in EARS format (WHEN/IF/WHILE/THEN) with explicit acceptance criteria per user story.

**Process:**
1. Describe the feature with specifics (entities, fields, behaviors, non-goals)
2. Kiro generates requirements.md and raises ambiguity questions
3. Resolve ambiguities with product decisions
4. Kiro refines the document

**Example ambiguities raised and resolved:**
- "Can a ticket be created without an assignee?" → Yes, nullable
- "Can comments go on Closed tickets?" → Yes, conversation doesn't end with closure
- "Is search case-insensitive?" → Yes, ILIKE with partial substring matching

**Output:** `requirements.md` in `.kiro/specs/{feature-name}/`

---

## Step 3: Design (per feature)

**What:** Technical design document with architecture, API endpoint specification, data model, and correctness properties.

**Key artifacts generated:**
- Prisma schema with native enums and relations
- Full REST API endpoint table (method, path, request/response TypeScript interfaces, error codes)
- State machine as executable code (not prose)
- 13 correctness properties mapping to specific requirements
- GIN trigram index for search performance
- Consistent error response shape definition

**Human judgment applied:**
- Specified Priority enum as URGENT (not CRITICAL)
- Required state machine as a single map (not scattered if/else)
- Required no delete endpoint
- Requested explicit JSON examples showing INVALID_TRANSITION vs VALIDATION_ERROR distinction

**Output:** `design.md` in `.kiro/specs/{feature-name}/`

---

## Step 4: Task Generation

**What:** Dependency-ordered implementation plan where each task is small enough to execute and verify independently.

**Rules enforced:**
- No task touches both backend and frontend
- Standalone task for Prisma schema + migration + seed
- Standalone task for state-machine service (separate from general CRUD)
- Standalone testing task for state-machine integration tests
- Requirement traceability on every task (e.g., `_Requirements: 5.1, 5.2, 5.3_`)

**Human corrections:**
- Fixed dependency ordering (status-change controller needs ticket CRUD in place first)
- Split frontend detail page into read-only view + status controls (state machine UI deserves its own review pass)

**Output:** `tasks.md` with a JSON dependency graph in `.kiro/specs/{feature-name}/`

---

## Step 5: Task Execution

**What:** Execute tasks one at a time (or in parallel waves), verify at each checkpoint.

**Verification at each task:**
- TypeScript compilation passes (`tsc -b` or `tsc --noEmit`)
- Manual curl testing for key behaviors
- Diagnostics clean (no IDE errors)

**Verification at checkpoints:**
- All tests pass
- State machine verified manually (CLOSED→IN_PROGRESS rejected)
- Error responses match design shape

**Features of Kiro's execution:**
- Reads existing code before writing new code (matches project style)
- Runs builds after changes to catch issues immediately
- Handles PowerShell escaping for Windows environment
- Creates files with correct directory structure

---

## Step 6: Review & Documentation

**Code review passes:**
1. **Critical path review** — state machine correctness, single source of truth, no status leakage
2. **Validation/error review** — every endpoint has Zod, no DB details leak, consistent shape
3. **Pre-PR cleanup** — unused imports, console.logs, hardcoded values, credential safety

**Documentation generated:**
- README.md, api-contract.md, data-model.md, ui-flow.md, test-strategy.md
- All reconciled to actual implementation (not the original plan)

---

## Kiro-Specific Features Used

| Feature | How It Was Used |
|---------|----------------|
| **Steering files** | `.kiro/steering/` — 3 files automatically applied to every interaction |
| **Spec workflow** | requirements → design → tasks per feature (5 specs total) |
| **Task dependency graph** | JSON waves enabling parallel execution planning |
| **Requirement traceability** | Every task references specific acceptance criteria |
| **Correctness properties** | Formal properties in design.md → property-based tests in implementation |
| **Ambiguity detection** | Tool raises questions before proceeding (7 ambiguities caught on first spec) |
| **Code review mode** | Targeted reviews with explicit "flag anything" instruction |
| **Implementation verification** | TypeScript compilation checked after every code generation |

---

## What Made This Workflow Effective

1. **Steering prevents drift.** The state machine transitions, enum conventions, and layering rules are stated once and enforced everywhere. No need to repeat "use native Postgres enums" on every task.

2. **Requirements before code.** Resolving "can comments go on closed tickets?" before implementation prevented a mid-build redesign that would have required changing the service, tests, and frontend.

3. **Design as contract.** The API endpoint table in design.md became the source of truth for both implementation and documentation. When the implementation drifted (stretch features added), docs were reconciled to match reality.

4. **Small, verifiable tasks.** Each task produces a compilable, testable increment. If something breaks, the blast radius is one task — not a tangled multi-file change.

5. **Separate review pass.** Code review after implementation (not during) catches issues that are invisible in the moment — like the `deleteTag` auth bypass and the missing tags in status-change response.

---

## Comparison to Working Without Specs

| Without specs | With Kiro specs |
|--------------|-----------------|
| Start coding immediately, discover edge cases mid-implementation | Edge cases resolved in requirements phase |
| State machine logic scattered across multiple files | Single map, referenced in design, enforced in tests |
| API shape emerges organically, frontend guesses at response types | API shape agreed before first line of code |
| Tests written after the fact, covering happy paths only | Correctness properties defined in design, tests generated from them |
| Documentation written at the end (if at all), drifts from reality | Docs generated from actual implementation at the end |
