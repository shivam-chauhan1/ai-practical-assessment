# Requirements Document

## Introduction

This document defines the requirements for the core Support Ticket Management feature — an internal tool that allows staff (Admins and Agents) to create, view, update, search, and progress support tickets through a fixed status lifecycle. Tickets can be commented on, assigned to users, and filtered by status or keyword. The system enforces strict state-machine transitions, validates all input server-side, and surfaces meaningful errors to the frontend. Once a ticket reaches a terminal state (CLOSED or CANCELLED), field edits are locked but comments remain allowed.

## Glossary

- **System**: The Support Ticket Management application as a whole (backend + frontend)
- **Backend**: The Express/Node.js server responsible for API endpoints, validation, and persistence
- **Frontend**: The React single-page application that staff interact with
- **Ticket**: A support request record containing title, description, priority, status, assignee, and creator references
- **Comment**: A text message attached to a specific Ticket by a User
- **User**: A seeded staff record with id, name, email, and role (ADMIN or AGENT)
- **Status**: One of OPEN, IN_PROGRESS, RESOLVED, CLOSED, or CANCELLED
- **Priority**: One of LOW, MEDIUM, HIGH, or URGENT
- **State_Machine**: The set of valid status transitions: OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED, OPEN→CANCELLED, IN_PROGRESS→CANCELLED
- **Terminal_State**: A Status value of CLOSED or CANCELLED, after which field edits are no longer permitted
- **TICKET_LOCKED**: A distinct error code returned by the Backend when an update is attempted on a Ticket in a Terminal_State
- **Keyword_Search**: A case-insensitive partial-word substring match (ILIKE '%keyword%') against Ticket title and description fields — matches any substring, not whole words only

## Requirements

### Requirement 1: Create a Ticket

**User Story:** As a staff member, I want to create a support ticket with a title, description, priority, and optional assignee, so that I can track a new support request.

#### Acceptance Criteria

1. WHEN a valid create-ticket request is submitted, THE Backend SHALL persist a new Ticket with status OPEN, the provided title (3–200 characters after trim), description (up to 5,000 characters after trim), priority, createdBy reference, and optional assignedTo reference (nullable), and return the created Ticket with a generated UUID and timestamps.
2. IF a create-ticket request is missing a required field (title, description, priority, or createdBy), THEN THE Backend SHALL reject the request with a 400 response and a message identifying the missing fields.
3. IF a create-ticket request contains a title shorter than 3 characters or longer than 200 characters after trim, THEN THE Backend SHALL reject the request with a 400 response identifying the title length constraint violation.
4. IF a create-ticket request contains a description longer than 5,000 characters after trim, THEN THE Backend SHALL reject the request with a 400 response identifying the description length constraint violation.
5. IF a create-ticket request contains a priority value not in the Priority enum, THEN THE Backend SHALL reject the request with a 400 response and a message identifying the invalid value.
6. IF a create-ticket request references a createdBy or assignedTo user ID that does not exist, THEN THE Backend SHALL reject the request with a 400 response and a message identifying the invalid reference.
7. WHEN the Frontend create-ticket form is submitted successfully, THE Frontend SHALL display the newly created Ticket in the ticket list.
8. WHEN the Backend returns a validation error for ticket creation, THE Frontend SHALL display the error message to the user.

### Requirement 2: List Tickets

**User Story:** As a staff member, I want to see a list of all tickets ordered by most recently updated, so that I can quickly find active work.

#### Acceptance Criteria

1. WHEN a list-tickets request is made, THE Backend SHALL return all Tickets ordered by updatedAt descending.
2. THE Frontend SHALL display the ticket list showing each Ticket's title, status, priority, assignee name, and updatedAt timestamp.
3. WHEN the Backend returns an error for the list request, THE Frontend SHALL display an error state to the user.

### Requirement 3: View Ticket Details

**User Story:** As a staff member, I want to view a single ticket's full details including its comments, so that I can understand the complete context of a request.

#### Acceptance Criteria

1. WHEN a get-ticket request is made with a valid Ticket ID, THE Backend SHALL return the full Ticket record including all associated Comments ordered by createdAt ascending.
2. IF a get-ticket request references a Ticket ID that does not exist, THEN THE Backend SHALL return a 404 response with a descriptive message.
3. THE Frontend SHALL display the Ticket's title, description, status, priority, assignee, creator, timestamps, and all Comments.
4. WHEN the Backend returns a 404 for a ticket detail request, THE Frontend SHALL display a not-found error state.

### Requirement 4: Update Ticket Fields

**User Story:** As a staff member, I want to update a ticket's title, description, priority, or assignee, so that I can keep ticket information accurate as context evolves.

#### Acceptance Criteria

1. WHEN a valid update-ticket request is submitted with changes to title, description, priority, or assignedTo on a Ticket not in a Terminal_State, THE Backend SHALL persist the changes, update the updatedAt timestamp, and return the updated Ticket.
2. WHEN an update-ticket request sets assignedTo to null, THE Backend SHALL clear the assignee on the Ticket (unassign), update the updatedAt timestamp, and return the updated Ticket.
3. IF an update-ticket request contains a title shorter than 3 characters or longer than 200 characters after trim, THEN THE Backend SHALL reject the request with a 400 response identifying the title length constraint violation.
4. IF an update-ticket request contains a description longer than 5,000 characters after trim, THEN THE Backend SHALL reject the request with a 400 response identifying the description length constraint violation.
5. IF an update-ticket request contains a priority value not in the Priority enum, THEN THE Backend SHALL reject the request with a 400 response and a message identifying the invalid value.
6. IF an update-ticket request references an assignedTo user ID that does not exist, THEN THE Backend SHALL reject the request with a 400 response and a message identifying the invalid reference.
7. IF an update-ticket request references a Ticket ID that does not exist, THEN THE Backend SHALL return a 404 response with a descriptive message.
8. IF an update-ticket request targets a Ticket in a Terminal_State, THEN THE Backend SHALL reject the request per Requirement 11 (Terminal State Lock).
9. WHEN the Frontend update form is submitted successfully, THE Frontend SHALL display the updated Ticket details.
10. WHEN the Backend returns a validation error for ticket update, THE Frontend SHALL display the error message to the user.

### Requirement 5: Change Ticket Status

**User Story:** As a staff member, I want to transition a ticket's status according to the defined lifecycle, so that I can track progress from creation to resolution.

#### Acceptance Criteria

1. WHEN a status-change request specifies the transition OPEN → IN_PROGRESS, THE Backend SHALL update the Ticket's status to IN_PROGRESS, update the updatedAt timestamp, and return the updated Ticket.
2. WHEN a status-change request specifies the transition IN_PROGRESS → RESOLVED, THE Backend SHALL update the Ticket's status to RESOLVED, update the updatedAt timestamp, and return the updated Ticket.
3. WHEN a status-change request specifies the transition RESOLVED → CLOSED, THE Backend SHALL update the Ticket's status to CLOSED, update the updatedAt timestamp, and return the updated Ticket.
4. WHEN a status-change request specifies the transition OPEN → CANCELLED, THE Backend SHALL update the Ticket's status to CANCELLED, update the updatedAt timestamp, and return the updated Ticket.
5. WHEN a status-change request specifies the transition IN_PROGRESS → CANCELLED, THE Backend SHALL update the Ticket's status to CANCELLED, update the updatedAt timestamp, and return the updated Ticket.
6. IF a status-change request specifies any transition not in the set {OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED, OPEN→CANCELLED, IN_PROGRESS→CANCELLED}, THEN THE Backend SHALL reject the request with a 400 response and a message stating the attempted transition is invalid and listing the valid transitions from the current status.
7. IF a status-change request contains a status value not in the Status enum (OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED), THEN THE Backend SHALL reject the request with a 400 response and a message identifying the invalid status value.
8. WHILE a Ticket is in a Terminal_State, THE Frontend SHALL not present any status transition controls for that Ticket.
9. WHILE a Ticket is in a given non-terminal status, THE Frontend SHALL only present the status transitions that are valid from that status according to the State_Machine.
10. WHEN the Backend returns a transition error, THE Frontend SHALL display the error message to the user.

### Requirement 6: Add a Comment to a Ticket

**User Story:** As a staff member, I want to add comments to a ticket regardless of its status, so that I can document conversations and progress notes even after a ticket is closed or cancelled.

#### Acceptance Criteria

1. WHEN a valid add-comment request is submitted with a ticketId, message (1–2,000 characters after trim), and createdBy reference, THE Backend SHALL persist the Comment and return the created Comment with a generated UUID and createdAt timestamp.
2. THE Backend SHALL allow comments to be added to a Ticket in any Status, including Terminal_State values (CLOSED or CANCELLED).
3. IF an add-comment request is missing a required field (message or createdBy), THEN THE Backend SHALL reject the request with a 400 response and a message identifying the missing fields.
4. IF an add-comment request contains a message shorter than 1 character or longer than 2,000 characters after trim, THEN THE Backend SHALL reject the request with a 400 response identifying the message length constraint violation.
5. IF an add-comment request references a Ticket ID that does not exist, THEN THE Backend SHALL return a 404 response with a descriptive message.
6. WHEN a comment is added successfully, THE Frontend SHALL append the new Comment to the ticket detail view without requiring a full page reload.
7. WHEN the Backend returns a validation error for comment creation, THE Frontend SHALL display the error message to the user.

### Requirement 7: Search and Filter Tickets

**User Story:** As a staff member, I want to search tickets by keyword and filter by status, so that I can quickly locate relevant tickets.

#### Acceptance Criteria

1. WHEN a search request includes a keyword parameter, THE Backend SHALL return Tickets where the title or description contains the keyword as a case-insensitive partial-word substring match (ILIKE '%keyword%'), ordered by updatedAt descending.
2. WHEN a search request includes a status filter parameter, THE Backend SHALL return only Tickets matching the specified Status value, ordered by updatedAt descending.
3. WHEN a search request includes both a keyword and a status filter, THE Backend SHALL apply both criteria as a logical AND and return only Tickets that match the keyword substring in title or description AND have the specified Status, ordered by updatedAt descending.
4. IF a search request includes a status value not in the Status enum, THEN THE Backend SHALL reject the request with a 400 response and a message identifying the invalid value.
5. THE Frontend SHALL provide a search input for keyword and a dropdown for status filter, and submit combined queries to the Backend.
6. WHEN a search returns no results, THE Frontend SHALL display an empty-state message.

### Requirement 8: Data Persistence

**User Story:** As a staff member, I want all ticket and comment data to persist across application restarts, so that I never lose work.

#### Acceptance Criteria

1. THE Backend SHALL store all Ticket and Comment data in PostgreSQL using Prisma ORM.
2. THE Backend SHALL define Status and Priority as native PostgreSQL enum types.
3. THE Backend SHALL define assignedTo and createdBy on Ticket, and authorId on Comment, as foreign key references to the User table.
4. WHEN the application restarts, THE Backend SHALL serve all previously persisted Tickets and Comments without data loss.

### Requirement 9: Backend Input Validation

**User Story:** As a staff member, I want the backend to reject invalid input with clear errors, so that bad data never enters the system regardless of frontend behavior.

#### Acceptance Criteria

1. THE Backend SHALL validate all incoming request bodies using Zod schemas before processing.
2. THE Backend SHALL enforce the following length constraints on all validated string fields after trim: title 3–200 characters, description up to 5,000 characters, comment message 1–2,000 characters.
3. THE Backend SHALL validate that all trimmed string fields are non-empty (contain at least one non-whitespace character).
4. IF a request body fails Zod validation, THEN THE Backend SHALL return a 400 response with a JSON body containing a structured error message identifying which fields failed and why.
5. IF a request references an entity ID (Ticket or User) that does not exist, THEN THE Backend SHALL return a 404 response with a descriptive message.
6. THE Backend SHALL never rely on the Frontend as the sole source of validation.

### Requirement 10: Frontend Error Display

**User Story:** As a staff member, I want to see clear error messages when something goes wrong, so that I know what happened and can take corrective action.

#### Acceptance Criteria

1. WHEN the Backend returns a 400 validation error, THE Frontend SHALL display the specific validation error message from the response body.
2. WHEN the Backend returns a 404 not-found error, THE Frontend SHALL display a not-found message indicating the requested resource does not exist.
3. WHEN the Backend returns a TICKET_LOCKED error (403), THE Frontend SHALL display a specific locked-state message indicating the ticket is in a terminal state and field edits are no longer permitted.
4. WHEN a network error occurs (Backend unreachable), THE Frontend SHALL display a network error message indicating the server is unavailable.
5. THE Frontend SHALL never silently swallow errors — all error states from API calls are surfaced to the user.

### Requirement 11: Terminal State Lock

**User Story:** As a staff member, I want the system to prevent edits to closed or cancelled tickets' core fields, so that the historical record remains intact while still allowing comments for ongoing conversation.

#### Acceptance Criteria

1. WHILE a Ticket is in a Terminal_State (CLOSED or CANCELLED), THE Backend SHALL reject any request to update title, description, priority, or assignedTo fields with a 403 response containing error code "TICKET_LOCKED" and a message stating the ticket is locked due to its terminal status.
2. WHILE a Ticket is in a Terminal_State, THE Backend SHALL continue to accept add-comment requests (comments are not subject to the terminal lock).
3. WHILE a Ticket is in a Terminal_State, THE Frontend SHALL render the title, description, priority, and assignee fields as read-only (non-editable).
4. WHEN the Backend returns a TICKET_LOCKED error, THE Frontend SHALL display a specific message informing the user that the ticket is in a terminal state and cannot be modified (distinct from generic validation errors).
5. THE Backend SHALL use the error code "TICKET_LOCKED" exclusively for terminal-state lock rejections, ensuring the Frontend can distinguish this error from other 400-level validation failures.
