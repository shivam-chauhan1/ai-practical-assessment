# Tech Stack

## Backend

- Node.js 20
- TypeScript
- Express
- Prisma ORM
- PostgreSQL
- Validation: Zod (mirror schemas on frontend where useful)
- Testing: Jest + Supertest (API integration tests)

## Frontend

- React + TypeScript
- Vite (build tooling)
- React Router (navigation)
- fetch (API calls — no axios)

## Package Manager

npm

## Database Conventions

- Priority and Status fields are backed by native Postgres enums, not free-text strings.
- Define enums in the Prisma schema and generate a migration that creates the corresponding Postgres enum types.
- assignedTo and createdBy on Ticket, and authorId on Comment, are foreign keys to User.id — never free-text names.
