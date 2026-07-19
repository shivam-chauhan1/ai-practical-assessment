# Support Ticket Management System

## What It Is

An internal tool for staff to create, update, comment on, search, and progress support tickets through a fixed status lifecycle.

## Users

Internal staff only — no public sign-up or external access.

## Core Entities

### User

- id (UUID)
- name (string)
- email (string, unique)
- role (enum: ADMIN, AGENT)
- createdAt (timestamp)

### Ticket

- id (UUID)
- title (string)
- description (text)
- status (enum: OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED)
- priority (enum: LOW, MEDIUM, HIGH, CRITICAL)
- createdBy (User reference)
- assignedTo (User reference, nullable)
- createdAt (timestamp)
- updatedAt (timestamp)

### Comment

- id (UUID)
- body (text)
- ticketId (Ticket reference)
- authorId (User reference)
- createdAt (timestamp)

## Ticket Status State Machine

Valid transitions:

- Open → In Progress
- In Progress → Resolved
- Resolved → Closed
- Open → Cancelled
- In Progress → Cancelled

**No other transitions are valid.** Any attempt to move a ticket through a transition not listed above must be rejected. This is the most important business rule in the application.
