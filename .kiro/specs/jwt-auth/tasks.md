# Implementation Plan: JWT Authentication

## Overview

Add JWT-based authentication to the Support Ticket Management System. Implementation proceeds from backend infrastructure (config, error classes, Prisma schema) through auth service/middleware, then frontend auth context and login page, finishing with wiring and integration.

## Tasks

- [x] 1. Backend infrastructure and dependencies
  - [x] 1.1 Install backend auth dependencies
    - Install `bcrypt`, `jsonwebtoken` as runtime dependencies
    - Install `@types/bcrypt`, `@types/jsonwebtoken` as dev dependencies
    - _Requirements: 1.2, 2.1_

  - [x] 1.2 Extend config module with JWT settings
    - Add `requiredEnvMinLength` helper that validates minimum string length
    - Add `jwt.secret` (min 32 chars) and `jwt.expiresIn` to the config export
    - Application must terminate on startup if JWT_SECRET is missing, empty, or < 32 chars
    - Application must terminate on startup if JWT_EXPIRES_IN is missing or empty
    - Update `.env.example` with `JWT_SECRET` and `JWT_EXPIRES_IN` entries
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.3 Add AuthenticationError and ForbiddenError classes
    - Add `AuthenticationError` (401, AUTHENTICATION_ERROR) to `server/src/errors/index.ts`
    - Add `ForbiddenError` (403, FORBIDDEN) to `server/src/errors/index.ts`
    - Both extend existing `AppError` class with proper prototype chain
    - _Requirements: 2.2, 2.3, 4.2, 4.3, 4.4, 5.2_

  - [x] 1.4 Update Prisma schema and generate migration
    - Add `password String @db.VarChar(72)` field to User model (required, non-nullable)
    - Run `npx prisma migrate dev` to create migration
    - Run `npx prisma generate` to update the client
    - _Requirements: 1.1, 1.3_

  - [x] 1.5 Update seed script with password hashing
    - Import `bcrypt` in `server/prisma/seed.ts`
    - Hash each user's password with bcrypt cost factor 10 before insert
    - Use a default dev password (e.g., "password123") for all seeded users
    - Terminate without inserting if hashing fails, log which user failed
    - _Requirements: 1.2, 1.4_

- [x] 2. Authentication service and login endpoint
  - [x] 2.1 Create auth validation schema
    - Create `server/src/schemas/authSchemas.ts`
    - Define `loginSchema` with Zod: email (required, valid email format), password (required)
    - Export `LoginInput` type
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 2.2 Implement auth service
    - Create `server/src/services/authService.ts`
    - Implement `login(email, password)` function
    - Look up user by email via Prisma, compare password with `bcrypt.compare`
    - On match: sign JWT with `{ id, email, role }` claims using config secret and expiry
    - On mismatch or user not found: throw `AuthenticationError`
    - Return `{ token, user: { id, name, email, role } }`
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 2.8_

  - [x] 2.3 Implement auth controller
    - Create `server/src/controllers/authController.ts`
    - Implement `login` handler: validate body with loginSchema, delegate to authService, return 200 with token and user
    - _Requirements: 2.1_

  - [x] 2.4 Create auth routes and mount in app
    - Create `server/src/routes/authRoutes.ts`
    - Define `POST /auth/login` route with validation middleware and controller
    - Mount auth routes on `/api` prefix in `app.ts` — no auth middleware on this route
    - _Requirements: 2.1, 4.6_

  - [x] 2.5 Write unit tests for auth service
    - Test login success returns token and user
    - Test wrong email returns 401
    - Test wrong password returns 401
    - Test bcrypt comparison is called correctly
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.6 Write property test for bcrypt hashing
    - **Property 1: Bcrypt hashing produces valid hashes**
    - Generate random passwords (1–72 bytes), hash with cost 10, verify 60-char output with `$2b$10$` prefix
    - **Validates: Requirements 1.2**

  - [x] 2.7 Write property test for login token-response consistency
    - **Property 2: Login token-response consistency**
    - For valid user records, verify response user object (id, email, role) matches decoded JWT claims
    - **Validates: Requirements 2.1, 2.7**

  - [x] 2.8 Write property test for invalid email format rejection
    - **Property 3: Invalid email format rejection**
    - Generate random non-email strings, submit to login endpoint, verify 400 response (not 401 or 200)
    - **Validates: Requirements 2.6**

- [x] 3. Checkpoint - Backend auth service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Authentication middleware and role guard
  - [x] 4.1 Implement auth middleware
    - Create `server/src/middleware/authMiddleware.ts`
    - Extract `Authorization: Bearer <token>` header
    - Verify token with `jwt.verify(token, config.jwt.secret)`
    - On success: attach `{ id, email, role }` to `req.user`, call `next()`
    - On missing header: return 401 "Authentication required"
    - On expired token: return 401 "Token expired"
    - On invalid/malformed token: return 401 "Invalid token"
    - Must NOT modify `req.body` or `req.query`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_

  - [x] 4.2 Add Express Request type extension
    - Create or update `server/src/types/express.d.ts` to declare `req.user` with `{ id, email, role }`
    - _Requirements: 4.1_

  - [x] 4.3 Implement role guard middleware
    - Create `server/src/middleware/roleGuard.ts`
    - Implement `requireRole(...roles)` that checks `req.user.role`
    - Return 403 "Only ADMIN users can change ticket status" if role not in allowed set
    - _Requirements: 5.1, 5.2_

  - [x] 4.4 Apply middleware to ticket routes
    - Apply `authenticate` middleware to all `/api/tickets` routes (including sub-routes for comments and tags)
    - Apply `requireRole('ADMIN')` specifically to `PATCH /api/tickets/:id/status`
    - Ensure login endpoint remains unprotected
    - _Requirements: 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 4.5 Write unit tests for auth middleware
    - Test valid token decodes and attaches user
    - Test expired token returns 401 "Token expired"
    - Test malformed token returns 401 "Invalid token"
    - Test missing header returns 401 "Authentication required"
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.6 Write unit tests for role guard
    - Test ADMIN allowed on status PATCH
    - Test AGENT blocked with 403 on status PATCH
    - Test middleware ordering (auth before role)
    - _Requirements: 5.1, 5.2_

  - [x] 4.7 Write property test for valid token decode correctness
    - **Property 4: Valid token decode correctness**
    - Generate JWTs with random valid `{ id, email, role }` payloads signed with app secret, verify middleware decodes and attaches matching values
    - **Validates: Requirements 4.1**

  - [x] 4.8 Write property test for invalid token rejection
    - **Property 5: Invalid token rejection**
    - Generate random non-JWT strings and tokens signed with wrong secret, verify middleware rejects all with 401
    - **Validates: Requirements 4.4**

  - [x] 4.9 Write property test for middleware body/query preservation
    - **Property 6: Middleware preserves request body and query**
    - Generate random body objects and query parameter sets, pass through middleware with valid token, verify `req.body` and `req.query` are unchanged
    - **Validates: Requirements 4.7**

  - [x] 4.10 Write property test for role restriction scope
    - **Property 7: Role restriction scoped exclusively to status PATCH**
    - Generate requests to non-status-PATCH ticket endpoints (GET, POST, etc.) as AGENT, verify none return 403
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

- [x] 5. Checkpoint - Backend middleware and RBAC
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend integration tests
  - [x] 6.1 Write integration tests for full auth flow
    - Test full login flow: POST /api/auth/login → receive token → use on protected route
    - Test AGENT can GET/POST tickets but cannot PATCH status
    - Test ADMIN can perform all operations including PATCH status
    - Test protected routes return 401 without token
    - Test login endpoint accessible without token
    - _Requirements: 2.1, 4.1, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Frontend auth context and API client
  - [x] 7.1 Create AuthContext provider
    - Create `client/src/contexts/AuthContext.tsx`
    - Implement `AuthProvider` with `useState` for token and user (memory only)
    - Expose `token`, `user`, `isAuthenticated`, `login(token, user)`, `logout()`
    - Token is lost on refresh by design — no localStorage/sessionStorage
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.2 Update API client for authenticated requests
    - Modify `client/src/api/client.ts` to accept a token getter function
    - If token present: add `Authorization: Bearer <token>` to all `/api/tickets` requests
    - If token absent: omit the header
    - Do NOT add auth header to `/api/auth/login` requests
    - On 401 response: clear token, redirect to `/login`, reject with session-expired error
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 7.3 Write unit tests for AuthContext
    - Test login stores token and user
    - Test logout clears both to null
    - Test isAuthenticated is derived correctly
    - _Requirements: 7.1, 7.3, 7.5, 7.6_

  - [x] 7.4 Write property test for authorization header presence
    - **Property 8: Authorization header presence equals token presence**
    - Generate random tokens and paths, verify header attached if and only if token is non-null for `/api/tickets` paths
    - **Validates: Requirements 8.1, 8.2**

- [x] 8. Frontend login page and route protection
  - [x] 8.1 Create LoginPage component
    - Create `client/src/pages/LoginPage.tsx` at route `/login`
    - Email input (type="email", max 254 chars), password input (type="password", max 128 chars)
    - Submit button labeled "Login"
    - Client-side validation: required fields, email format
    - On success: call `authContext.login(token, user)`, redirect to `/`
    - On error: display error message, preserve email value
    - Loading state: disable button, show spinner/indicator
    - Handle network errors with "Server is unavailable" message
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 8.2 Create ProtectedRoute component
    - Create `client/src/components/ProtectedRoute.tsx`
    - If `isAuthenticated` is false: redirect to `/login`
    - If authenticated: render children
    - Must NOT render protected content before redirect
    - _Requirements: 9.1, 9.3_

  - [x] 8.3 Wire routing with auth guards
    - Wrap App with `AuthProvider`
    - Add `/login` route rendering LoginPage
    - Wrap existing routes (`/`, `/tickets/new`, `/tickets/:id`) with ProtectedRoute
    - If authenticated user visits `/login`, redirect to `/`
    - Pass token getter from AuthContext to API client
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 8.4 Write unit tests for LoginPage
    - Test form renders with email, password inputs and Login button
    - Test client-side validation prevents submission with empty fields
    - Test successful login redirects to /
    - Test error display on failed login
    - Test loading state disables button
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 8.5 Write unit tests for ProtectedRoute
    - Test redirects unauthenticated users to /login
    - Test renders children when authenticated
    - _Requirements: 9.1, 9.3_

  - [x] 8.6 Write property test for route protection
    - **Property 9: Unauthenticated route protection**
    - Generate protected route paths (`/`, `/tickets/new`, `/tickets/:id`), verify redirect to `/login` when no token present
    - **Validates: Requirements 9.1, 9.3**

- [x] 9. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Backend uses Jest + Supertest; frontend uses Vitest + React Testing Library
- All property-based tests use `fast-check` (already available as dev dependency)
- The implementation language is TypeScript throughout (backend and frontend)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["1.5", "2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["2.3", "2.5", "2.6"] },
    { "id": 6, "tasks": ["2.4", "2.7", "2.8"] },
    { "id": 7, "tasks": ["4.1", "4.2"] },
    { "id": 8, "tasks": ["4.3", "4.5", "4.7", "4.8", "4.9"] },
    { "id": 9, "tasks": ["4.4", "4.6", "4.10"] },
    { "id": 10, "tasks": ["6.1"] },
    { "id": 11, "tasks": ["7.1"] },
    { "id": 12, "tasks": ["7.2", "7.3"] },
    { "id": 13, "tasks": ["7.4", "8.1", "8.2"] },
    { "id": 14, "tasks": ["8.3", "8.4", "8.5"] },
    { "id": 15, "tasks": ["8.6"] }
  ]
}
```
