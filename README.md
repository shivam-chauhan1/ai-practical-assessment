# Support Ticket Management System

Internal tool for staff to create, update, comment on, search, and progress support tickets through a fixed status lifecycle.

## Structure

- `/server` — Express + TypeScript backend (Prisma ORM, PostgreSQL)
- `/client` — React + TypeScript frontend (Vite)

## Getting Started

1. Copy `server/.env.example` to `server/.env` and fill in your PostgreSQL connection string.
2. `cd server && npm install && npx prisma migrate dev && npm run dev`
3. `cd client && npm install && npm run dev`
