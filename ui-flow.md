# UI Flow

## Authentication Gate

All routes except `/login` are wrapped in a `ProtectedRoute`. If the user is not authenticated (no valid JWT in context), they are redirected to `/login`. Authenticated users hitting `/login` are redirected to `/` (ticket list).

### Login (`/login`)

1. User enters email and password.
2. Client-side validation runs first:
   - Empty email → inline error "Email is required"
   - Malformed email → "Email format is invalid"
   - Empty password → "Password is required"
3. On submit, POST `/auth/login` is called.
4. **Success** → token and user profile stored in AuthContext, navigate to `/`.
5. **Error states:**
   - Invalid credentials (401) → banner: API message (e.g., "Invalid email or password")
   - Network failure / server down → banner: "Server is unavailable"

---

## Flow 1: List Page → Detail Page → Status Change → Comment

### Ticket List (`/`)

1. Page loads → fetches paginated tickets from `GET /tickets` with default sort (newest updated).
2. Filters available: keyword search (debounced 300ms), status dropdown, tag multi-select (debounced 300ms), priority dropdown, assignee dropdown, sort order.
3. Changing any filter resets pagination to page 1.
4. Results render as `TicketCard` components; clicking a card navigates to `/tickets/:id`.

**Error states on list page:**
- **Network error** (server unreachable): `ErrorDisplay` with code `NETWORK_ERROR` — "The server is unavailable. Please check your connection and try again later." Dismissible.
- **Unexpected API error**: generic `ErrorDisplay` with the API message. Dismissible.
- **Empty results** (no tickets match filters): `EmptyState` component shown — not an error, just informational.

### Ticket Detail (`/tickets/:id`)

1. Page loads → parallel fetch of `GET /tickets/:id` (with comments) and `GET /users` (for assignee dropdown and comment author picker).
2. Renders: back link, status transition buttons, title, priority badge, creator, assignee, description, comment list, comment form.
3. If ticket is in a terminal state (CLOSED or CANCELLED): edit button hidden, read-only notice shown, fields are locked.

**Error states on detail page:**
- **Ticket not found** (404, code `NOT_FOUND`): `ErrorDisplay` — "The requested resource does not exist." plus a "← Back to tickets" link. No ticket content rendered.
- **Network error**: `ErrorDisplay` — "The server is unavailable..." plus back link.
- **Any other API error**: generic `ErrorDisplay` with message, plus back link.

### Status Change (within Detail Page)

1. `StatusTransitionControls` renders one button per valid transition (provided by backend in `ticket.validTransitions`).
2. User clicks a transition button → all transition buttons disabled during request → `PATCH /tickets/:id/status` called.
3. **Success** → ticket state updates in-place, toast notification: "Status updated to {new status}".
4. After transition, the button set re-renders with the new valid transitions (or no buttons if terminal).

**Error states on status change:**
- **Invalid transition** (409, code `INVALID_TRANSITION`): inline `ErrorDisplay` below the status controls — shows the API's error message (e.g., "Cannot transition from OPEN to CLOSED"). Dismissible. Buttons re-enable.
- **Ticket locked** (code `TICKET_LOCKED`): amber `ErrorDisplay` — "This ticket is in a terminal state and cannot be modified."
- **Network error**: inline `ErrorDisplay` — "The server is unavailable..." Buttons re-enable.

### Adding a Comment (within Detail Page)

1. User selects an author from the dropdown (defaults to first user in list) and types in the textarea.
2. Submit button disabled until body is non-empty.
3. On submit → `POST /tickets/:id/comments` called, button shows "Adding...".
4. **Success** → new comment prepended to comment list, textarea cleared, toast: "Comment added".

**Error states on comment submission:**
- **Validation error** (400, code `VALIDATION_ERROR`): `ErrorDisplay` with field-specific messages. Dismissible.
- **Network error**: `ErrorDisplay` — "Failed to add comment". Dismissible.
- In both cases the textarea retains its content so the user can retry.

---

## Flow 2: List Page → Create Page → Back to List

### Navigate to Create

From the ticket list page, user clicks the "+ New Ticket" button → navigates to `/tickets/new`.

### Create Ticket (`/tickets/new`)

1. Page loads → fetches `GET /users` for creator and assignee dropdowns.
2. Form fields: title (required), description (required), priority (dropdown, required), created by (dropdown, required), assigned to (dropdown, optional).
3. Client-side validation handled by `TicketForm` component before submission.
4. On submit → `POST /tickets` called, button disabled while submitting.
5. **Success** → navigate to `/` (ticket list). The new ticket appears in the list.
6. Cancel button also navigates back to `/`.

**Error states on create page:**
- **Users failed to load** (network error during initial fetch): `ErrorDisplay` with `NETWORK_ERROR` — page still renders but the form may lack user options.
- **Validation error from server** (400, code `VALIDATION_ERROR`): field-specific error messages shown inline via `TicketForm`'s `serverFieldErrors` prop (e.g., "title: Title is required"). Form remains editable for correction.
- **Generic server error** (500 or other): `ErrorDisplay` banner above the form — "An unexpected error occurred". Dismissible.
- **Network error on submit**: `ErrorDisplay` — "An unexpected error occurred". Form retains values so user can retry.

---

## Editing a Ticket (within Detail Page)

1. User clicks "Edit" button (hidden when ticket is in terminal state).
2. `TicketEditForm` replaces the read-only view inline.
3. User modifies fields → submits.
4. **Success** → form collapses back to read-only view with updated data, toast: "Ticket updated".
5. Cancel button returns to read-only view without saving.

**Error states on edit:**
- **Validation error**: field-specific messages from server rendered in the form.
- **Ticket locked** (terminal state race condition): `TICKET_LOCKED` error displayed.
- **Network error**: error banner, form retains values.

---

## Global Error Handling Patterns

| Error Code | Visual Treatment | Background | Dismissible |
|---|---|---|---|
| `NETWORK_ERROR` | Red banner, bold "Network Error" heading | `#fef2f2` | Yes (if `onDismiss` provided) |
| `NOT_FOUND` | Red banner, bold "Not Found" heading | `#fef2f2` | Yes |
| `VALIDATION_ERROR` | Red banner with bulleted field list | `#fef2f2` | Yes |
| `INVALID_TRANSITION` | Red banner, shows API message | `#fef2f2` | Yes |
| `TICKET_LOCKED` | Amber banner, "Ticket Locked" heading | `#fef3c7` | Yes |
| Generic / fallback | Red banner, shows `error.message` | `#fef2f2` | Yes |

All error banners use `role="alert"` for accessibility. Toast notifications (success feedback) auto-dismiss or are closed manually.

---

## Session Expiry / 401 Handling

If any authenticated API call returns 401 (token expired or invalid), the `apiClient` calls the configured `onUnauthorized` callback which:
1. Clears auth state (token + user profile) from context and localStorage.
2. Navigates to `/login`.

The user must log in again to continue.
