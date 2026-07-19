# Implementation Plan: OpenAPI Documentation

## Overview

Add interactive OpenAPI 3.0 documentation to the Express backend. The implementation proceeds bottom-up: install dependencies, create the registry, define response schemas, register all routes, build the generator, mount Swagger UI in app.ts, and finally add tests.

## Tasks

- [x] 1. Install dependencies
  - Run `npm install @asteasolutions/zod-to-openapi swagger-ui-express` in the server directory
  - Run `npm install -D @types/swagger-ui-express` in the server directory
  - _Requirements: 1.1, 5.1_

- [x] 2. Create registry and response schemas
  - [x] 2.1 Create `server/src/openapi/registry.ts`
    - Create the `openapi/` directory under `server/src/`
    - Instantiate a single `OpenAPIRegistry` from `@asteasolutions/zod-to-openapi`
    - Register the BearerAuth security scheme (type: http, scheme: bearer, bearerFormat: JWT)
    - Export the registry instance
    - _Requirements: 1.1, 4.1_

  - [x] 2.2 Create `server/src/openapi/responseSchemas.ts`
    - Call `extendZodWithOpenApi(z)` to enable `.openapi()` on Zod types
    - Define and export: `UserResponseSchema`, `LoginResponseSchema`, `TagResponseSchema`, `CommentResponseSchema`, `TicketResponseSchema`, `TicketListResponseSchema`, `ErrorResponseSchema`, `HealthResponseSchema`
    - Each schema must call `.openapi('SchemaName')` for registry registration
    - Login response includes `token` (string) and `user` (object with id, name, email, role)
    - Ticket response includes all model fields plus nested creator, assignee, tags, comments, validTransitions
    - Paginated list response includes `data` array and `pagination` object (page, pageSize, total, totalPages)
    - Error response includes `error` object with `code`, `message`, and optional `details` array
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_

- [x] 3. Create route registration files
  - [x] 3.1 Create `server/src/openapi/routes/auth.ts`
    - Import the shared registry from `../registry`
    - Import `loginSchema` from `../../schemas/authSchemas` (same instance used by middleware)
    - Import `LoginResponseSchema` and `ErrorResponseSchema` from `../responseSchemas`
    - Register POST `/auth/login` with request body referencing loginSchema, 200 response with LoginResponseSchema, 401 response with ErrorResponseSchema
    - Do NOT apply BearerAuth security to this endpoint
    - _Requirements: 3.1, 3.4, 4.4, 7.1_

  - [x] 3.2 Create `server/src/openapi/routes/tickets.ts`
    - Import registry, request schemas (`createTicketSchema`, `updateTicketSchema`, `changeStatusSchema`, `listTicketsQuerySchema`, `uuidParamSchema`), and response schemas
    - Register POST `/tickets` — auth required, request body: createTicketSchema, 201 response: TicketResponseSchema, errors: 400, 401
    - Register GET `/tickets` — auth required, query params from listTicketsQuerySchema (status, priority, assignedTo, search, page, pageSize with defaults and enums), 200 response: TicketListResponseSchema, errors: 400, 401
    - Register GET `/tickets/{id}` — auth required, path param: id (uuid), 200: TicketResponseSchema, errors: 401, 404
    - Register PATCH `/tickets/{id}` — auth required, path param: id (uuid), request body: updateTicketSchema, 200: TicketResponseSchema, errors: 400, 401, 403, 404
    - Register PATCH `/tickets/{id}/status` — auth required, path param: id (uuid), request body: changeStatusSchema, 200: TicketResponseSchema, errors: 400, 401, 403, 404, 409
    - Include description on status endpoint listing valid transitions: OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED, OPEN→CANCELLED, IN_PROGRESS→CANCELLED
    - Register POST `/tickets/{id}/comments` — auth required, path param: id (uuid), request body: createCommentSchema, 201: CommentResponseSchema, errors: 400, 401, 404
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.2, 6.1, 6.2, 7.1_

  - [x] 3.3 Create `server/src/openapi/routes/users.ts`
    - Import registry and UserResponseSchema
    - Register GET `/users` — auth required, 200 response: array of UserResponseSchema, errors: 401
    - _Requirements: 3.1, 4.2_

  - [x] 3.4 Create `server/src/openapi/routes/tags.ts`
    - Import registry, request schemas (`createTagSchema`, `deleteTagParamsSchema`), and response schemas
    - Register POST `/tags` — auth required, request body: createTagSchema, 201: TagResponseSchema, errors: 400, 401, 409
    - Register GET `/tags` — auth required, 200 response: array of TagResponseSchema, errors: 401
    - Register DELETE `/tags/{id}` — auth required, path param: id (uuid), 204 response (no content), errors: 401, 404
    - Also register GET `/health` — no auth, 200: HealthResponseSchema
    - _Requirements: 3.1, 3.2, 4.2_

- [x] 4. Create generator and mount Swagger UI
  - [x] 4.1 Create `server/src/openapi/generator.ts`
    - Import `OpenApiGeneratorV3` from `@asteasolutions/zod-to-openapi`
    - Import registry from `./registry`
    - Import all route registration files (side-effect imports: `./routes/auth`, `./routes/tickets`, `./routes/users`, `./routes/tags`)
    - Export a `generateOpenApiDocument()` function that calls `generator.generateDocument()` with info (title: "Support Ticket Management API", version: "1.0.0"), servers: [{ url: "/api" }]
    - _Requirements: 5.2, 7.3_

  - [x] 4.2 Modify `server/src/app.ts` to mount Swagger UI
    - Add `import swaggerUi from 'swagger-ui-express'`
    - Add `import { generateOpenApiDocument } from './openapi/generator'`
    - Call `generateOpenApiDocument()` and store the result
    - Mount `swaggerUi.serve` and `swaggerUi.setup(document)` at `/api-docs` BEFORE auth-protected routes
    - _Requirements: 5.1, 5.3, 5.4_

- [x] 5. Checkpoint
  - Ensure the server compiles without errors (`npm run build` in server directory)
  - Manually verify `/api-docs` renders the Swagger UI (ask the user if questions arise)

- [x] 6. Add tests
  - [x] 6.1 Write property test for schema fidelity
    - Create `server/src/openapi/__tests__/openapi.property.test.ts`
    - **Property 1: Schema fidelity**
    - Generate random Zod schemas with constraints (minLength, maxLength, enum, optional fields, uuid format) using fast-check
    - Register them in a fresh OpenAPIRegistry, generate the document, assert constraints are preserved and optional fields are not in the required array
    - Minimum 100 iterations
    - **Validates: Requirements 1.2, 1.3**

  - [x] 6.2 Write property test for error documentation completeness
    - **Property 2: Error documentation completeness**
    - Generate random sets of error codes (400, 401, 403, 404, 409), register paths with those error codes referencing ErrorResponseSchema
    - Assert all documented error responses in the generated OpenAPI doc reference the ErrorResponse schema
    - Minimum 100 iterations
    - **Validates: Requirements 2.3**

  - [x] 6.3 Write property test for route parameter documentation completeness
    - **Property 3: Route parameter documentation completeness**
    - Generate random route registrations with path params (uuid type), query params (with enums), and request bodies
    - Assert all params appear in the generated doc with correct types/formats, and request bodies reference a named schema
    - Minimum 100 iterations
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [x] 6.4 Write property test for security scheme application consistency
    - **Property 4: Security scheme application consistency**
    - Generate random sets of endpoints, some marked as requiring auth and some not
    - Assert that only auth-required endpoints have BearerAuth in their security array, and non-auth endpoints do not
    - Minimum 100 iterations
    - **Validates: Requirements 4.2, 4.4**

  - [x] 6.5 Write integration test for /api-docs endpoint
    - Create `server/src/openapi/__tests__/openapi.integration.test.ts`
    - Test GET `/api-docs` returns HTTP 200 with HTML content-type (no auth token required)
    - Test the generated OpenAPI document contains all 12 registered paths
    - Test the generated document has valid OpenAPI 3.0 structure (has openapi, info, paths keys)
    - _Requirements: 5.1, 5.4, 3.1_

- [x] 7. Final checkpoint
  - Run `npm test` in the server directory to ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "tasks": ["1"] },
    { "tasks": ["2.1", "2.2"] },
    { "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "tasks": ["4.1"] },
    { "tasks": ["4.2"] },
    { "tasks": ["5"] },
    { "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5"] },
    { "tasks": ["7"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The implementation language is TypeScript (matching the existing server codebase)
- Dependencies are installed first so TypeScript compilation works at every subsequent step
- Route registration files import the SAME Zod schema instances used by runtime middleware (Req 7.1, 7.2)
- The openapi module is read-only relative to the app — it imports schemas but exports nothing that runtime routes depend on
- Property tests use fast-check (already in devDependencies)
- Each property test targets a specific correctness property from the design document
