# Project Structure

## Monorepo Layout

```
/server   — Express backend
/client   — React frontend
```

## Server Layering

```
routes -> controllers -> services -> Prisma
```

- No direct Prisma calls from controllers — always go through a service.

## Client Organization

```
src/
  pages/        — route-level components (one per route)
  components/   — reusable UI components
  api/          — typed fetch wrappers for backend endpoints
```

## Test Placement

Tests live next to the code they test, named `*.test.ts` (or `*.test.tsx` for React components).

## Environment Config

All environment variables (DATABASE_URL, etc.) are read through a single config module — no `process.env` scattered across files.
