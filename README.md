# Support Ticket Management System

An internal tool for staff to create, update, comment on, search, and progress support tickets through a fixed status lifecycle. Built as a monorepo with an Express API backend and a React single-page app frontend.

## Tech Stack

| Layer    | Technology                                            |
| -------- | ----------------------------------------------------- |
| Backend  | Node.js 20, TypeScript, Express, Prisma ORM, Zod     |
| Database | PostgreSQL (enums for Status, Priority, Role)         |
| Frontend | React 19, TypeScript, Vite, React Router              |
| Testing  | Jest + Supertest (server), Vitest (client), fast-check |
| Auth     | JWT (bcrypt password hashing)                         |

## Prerequisites

- **Node.js** ≥ 20
- **npm** (ships with Node)
- **PostgreSQL** running locally or accessible via a connection string

## Setup

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd ai-practical-assessment

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure environment variables

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your values:

```
DATABASE_URL=postgresql://user:password@localhost:5432/support_tickets?schema=public
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=1h
```

### 3. Run database migrations

```bash
cd server
npx prisma migrate dev
```

### 4. Seed the database

```bash
cd server
npm run db:seed
```

### 5. Run the application

**Server** (runs on the port defined in `.env`, default 3001):

```bash
cd server
npm run dev
```

**Client** (Vite dev server, default port 5173):

```bash
cd client
npm run dev
```

## Running Tests

**Server tests** (Jest + Supertest):

```bash
cd server
npm test
```

**Client tests** (Vitest):

```bash
cd client
npm test -- --run
```

## API Overview

The backend exposes a RESTful JSON API organised around these resource groups:

| Resource  | Base Path         | Description                              |
| --------- | ----------------- | ---------------------------------------- |
| Auth      | `/api/auth`       | Login and token management               |
| Tickets   | `/api/tickets`    | CRUD, status transitions, search/filter  |
| Tags      | `/api/tags`       | Tag management and ticket tagging        |
| Users     | `/api/users`      | User listing and lookup                  |

Comments are nested under tickets (`/api/tickets/:id/comments`).

For full endpoint details — request/response shapes, status codes, and error formats — see [api-contract.md](./api-contract.md).
