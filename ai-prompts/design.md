# AI Prompts — Design

Covers design decisions and the `design.md` generation itself. DS-1 and DS-2 (the prompts that produce `design.md`) live in `tool-specific/kiro-specs/spec-kickoff-prompts.md`; this file logs those plus two design-only prompts that go a level deeper than the spec.

---

## Referenced from kiro-specs

### DS-1 — Design kickoff
See `tool-specific/kiro-specs/spec-kickoff-prompts.md`.

### DS-2 — Design refinement
See `tool-specific/kiro-specs/spec-kickoff-prompts.md`.

---

## Design-only prompts

### DN-1 — Frontend state-machine UX

**Prompt:**
```
For the status control on the ticket detail page: rather than a free dropdown of all
5 statuses, show only the valid next states for the ticket's current status (e.g. an
Open ticket shows only "Move to In Progress" and "Cancel" as buttons), plus always
show the current status as a read-only badge. Sketch the component's props and state
shape before we implement it.
```

**Why this prompt:** the state machine is the "signature judgment piece" of the whole exercise per the brief — it's worth a dedicated design pass on the frontend side too, not just the backend enforcement.

**Kiro's response:** _Here's the component sketch:

```typescript
// client/src/components/StatusTransitionControls.tsx

import type { Status } from '../types';

/** Human-readable button labels for each transition target */
const TRANSITION_LABELS: Record<Status, string> = {
  IN_PROGRESS: 'Move to In Progress',
  RESOLVED: 'Mark Resolved',
  CLOSED: 'Close',
  CANCELLED: 'Cancel',
  OPEN: 'Reopen', // unreachable in Core, but keeps the Record exhaustive
};

// --- Props ---

interface StatusTransitionControlsProps {
  /** The ticket's current status — rendered as a read-only badge */
  currentStatus: Status;

  /** Valid next statuses from the API response (server-driven, not computed client-side) */
  validTransitions: Status[];

  /** Called when the user clicks a transition button */
  onTransition: (targetStatus: Status) => Promise<void>;

  /** True while a transition API call is in flight — disables all buttons */
  isLoading: boolean;
}

// --- Internal state (managed by the component) ---

interface StatusTransitionState {
  /** Which button was clicked (to show a spinner on that specific button) */
  pendingTarget: Status | null;

  /** Error from a failed transition attempt (e.g. INVALID_TRANSITION race condition) */
  error: string | null;
}
```

**Rendering behavior:**

- Always renders a `<StatusBadge status={currentStatus} />` showing the current state.
- If `validTransitions` is empty (terminal state), renders nothing else — no buttons, no dropdown.
- For each entry in `validTransitions`, renders a `<button>` with the label from `TRANSITION_LABELS[target]`.
- While `isLoading` is true, all buttons are `disabled`. The button matching `pendingTarget` shows a spinner.
- On click: sets `pendingTarget`, calls `onTransition(target)`. On success the parent refreshes the ticket (new `currentStatus` + new `validTransitions` flow in via props). On error, sets `error` from the API response message.
- `error` clears on the next successful transition or when `currentStatus` changes (prop change).

**Why this shape works:**

- The component is fully data-driven — it never imports or computes the transitions map itself. It trusts `validTransitions` from the server response, so if the backend map ever changes, the frontend follows without a deploy.
- `onTransition` is async and owned by the parent (TicketDetailPage), which calls `changeTicketStatus` from the API layer and then re-fetches the ticket.
- The `isLoading` prop lets the parent coordinate (e.g., disable the edit form while a transition is in flight).

This aligns with the design doc's approach of including `validTransitions: string[]` in every ticket response and the requirement that the frontend "shall only present the status transitions that are valid from that status" (RQ 5.9).

Want me to fold this component sketch into the design doc, or keep it here as implementation guidance for task 16?_
---

### DN-2 — Data model judgment check

**Prompt:**
```
Double check the data model: should assignedTo be nullable to support unassigned
tickets? Confirm createdBy is required and immutable after creation (never editable
via the update endpoint), and that updatedAt is only touched by field updates and
status changes, not by adding a comment.
```

**Why this prompt:** these are exactly the kind of small-but-important modeling decisions that are easy to get subtly wrong (e.g. a comment bumping `updatedAt` and making the ticket list look busier than it is) — worth confirming explicitly rather than assuming Kiro's first pass got them right.

**Kiro's response:** _Here's my verification against all three points:

**1. `assignedTo` nullable ✓**

The Prisma schema has `assignedTo String?` (nullable) and the relation is `assignee User?` (optional). The create request type has `assignedTo?: string | null` and the update schema allows setting it back to null. This is correct.

**2. `createdBy` required and immutable ✓**

- Required: `createdBy String` in the Prisma schema (no `?`), and `createdBy: z.string().uuid()` in the create schema (not optional).
- Immutable: The `updateTicketSchema` does NOT include `createdBy` as a field — it only allows `title`, `description`, `priority`, `assignedTo`. So `createdBy` cannot be changed via the update endpoint.

This is correct as-is.

**3. `updatedAt` only touched by field updates and status changes, NOT by comments — needs a fix ⚠️**

The Prisma schema uses `updatedAt DateTime @updatedAt`. Prisma's `@updatedAt` auto-updates the timestamp on **any write to the Ticket record**. Since adding a comment writes to the `Comment` table (not the `Ticket` table itself), comments will NOT trigger `updatedAt` on the Ticket — good.

However, it's worth being explicit in the design. Let me confirm the service logic doesn't accidentally touch the Ticket record when adding a comment:

Good. The `addComment` service only creates a `Comment` record — it doesn't update the `Ticket` model. Since Prisma's `@updatedAt` only fires when the Ticket row itself is written to, adding a comment won't change `updatedAt`. This is correct behavior.

Let me make this invariant explicit in the design doc and requirements so it's not left to assumption:

Now let me add an explicit note in the Prisma schema section:

Here's the summary of my verification:

**`assignedTo` nullable ✓** — `String?` in Prisma, `assignedTo?: string | null` in create schema, explicitly clearable to null via update. Supports unassigned tickets.

**`createdBy` required and immutable ✓** — `String` (non-nullable) in Prisma, required in `createTicketSchema`, and **not present** in `updateTicketSchema`. The update endpoint physically cannot change it.

**`updatedAt` not touched by comments ✓** — Prisma's `@updatedAt` fires only on writes to the Ticket row itself. `addComment` writes to the Comment table only. I've added explicit comments in the Prisma schema and service signature to make this invariant undeniable during implementation.

All three constraints were already correct in the design. I've added inline documentation to make them impossible to misinterpret during implementation._