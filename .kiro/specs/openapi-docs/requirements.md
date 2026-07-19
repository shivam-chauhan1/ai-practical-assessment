# Requirements Document

## Introduction

Add interactive OpenAPI 3.0 documentation to the support ticket management system's Express backend. The documentation is derived from existing Zod validation schemas using `@asteasolutions/zod-to-openapi`, ensuring the docs stay in sync with the actual request validation. The interactive Swagger UI is served at `/api-docs` via `swagger-ui-express`.

## Glossary

- **OpenAPI_Registry**: A central registry object from `@asteasolutions/zod-to-openapi` that holds all registered Zod schemas and route definitions, and produces the final OpenAPI 3.0 JSON document.
- **Swagger_UI**: The interactive HTML interface served by `swagger-ui-express` that renders the OpenAPI specification for developers to explore and test endpoints.
- **Request_Schema**: A Zod schema that validates incoming request data (body, query parameters, or path parameters).
- **Response_Schema**: A Zod schema that describes the shape of a successful or error response returned by an endpoint.
- **Bearer_Token**: A JWT access token passed in the `Authorization` header using the format `Bearer <token>`.
- **Status_State_Machine**: The set of valid ticket status transitions: OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED, OPEN→CANCELLED, IN_PROGRESS→CANCELLED.
- **Doc_Generator**: The module that builds the complete OpenAPI document from the OpenAPI_Registry.

## Requirements

### Requirement 1: Schema Registration

**User Story:** As a developer, I want all existing Zod request schemas registered in an OpenAPI registry, so that the documentation accurately reflects the actual validation logic.

#### Acceptance Criteria

1. WHEN the OpenAPI_Registry is initialized, THE Doc_Generator SHALL register all existing request Zod schemas (loginSchema, createTicketSchema, updateTicketSchema, changeStatusSchema, listTicketsQuerySchema, uuidParamSchema, createTagSchema, deleteTagParamsSchema, createCommentSchema) with the registry.
2. WHEN a Zod schema contains constraints (min, max, regex, enum values), THE OpenAPI_Registry SHALL preserve those constraints in the generated OpenAPI schema properties.
3. WHEN a Zod schema field is marked optional, THE OpenAPI_Registry SHALL mark that field as not required in the generated OpenAPI schema.

### Requirement 2: Response Schema Definition

**User Story:** As a developer, I want response shapes documented as Zod schemas, so that the documentation covers both request and response contracts.

#### Acceptance Criteria

1. THE Doc_Generator SHALL define response Zod schemas for every endpoint covering success responses (200, 201).
2. THE Doc_Generator SHALL define a shared error response Zod schema containing `error` (string) and optional `details` (array of validation messages) fields.
3. WHEN an endpoint can return multiple error codes (400, 401, 403, 404, 409), THE OpenAPI_Registry SHALL document each applicable error code with the error response schema.
4. THE Response_Schema for the login endpoint SHALL include `token` (string) and `user` (object with id, name, email, role) fields.
5. THE Response_Schema for ticket endpoints SHALL include all Ticket model fields (id, title, description, status, priority, createdBy, assignedTo, createdAt, updatedAt) plus nested creator, assignee, comments, and tags.
6. THE Response_Schema for the list tickets endpoint SHALL include a `tickets` array, `total` count, `page` number, and `pageSize` number.

### Requirement 3: Route Documentation

**User Story:** As a developer, I want every API endpoint registered with its HTTP method, path, request schema, and response schema, so that the docs provide a complete contract.

#### Acceptance Criteria

1. THE OpenAPI_Registry SHALL contain route registrations for all 12 endpoints: POST /api/auth/login, GET /api/users, POST /api/tickets, GET /api/tickets, GET /api/tickets/:id, PATCH /api/tickets/:id, PATCH /api/tickets/:id/status, POST /api/tickets/:id/comments, POST /api/tags, GET /api/tags, DELETE /api/tags/:id, GET /api/health.
2. WHEN a route accepts path parameters, THE OpenAPI_Registry SHALL document them with their type and validation constraints (e.g., UUID format).
3. WHEN a route accepts query parameters, THE OpenAPI_Registry SHALL document each parameter with its type, enum values where applicable, and default values.
4. WHEN a route accepts a request body, THE OpenAPI_Registry SHALL reference the corresponding registered Zod schema.

### Requirement 4: Authentication Documentation

**User Story:** As a developer, I want the docs to show which endpoints require authentication and how to provide credentials, so that consumers can correctly call protected endpoints.

#### Acceptance Criteria

1. THE OpenAPI_Registry SHALL define a Bearer authentication security scheme with type `http`, scheme `bearer`, and bearerFormat `JWT`.
2. WHEN an endpoint requires authentication, THE OpenAPI_Registry SHALL apply the Bearer security scheme to that endpoint's registration.
3. THE Swagger_UI SHALL allow users to enter a Bearer_Token that is automatically included in subsequent "Try it out" requests.
4. THE Doc_Generator SHALL mark the POST /api/auth/login endpoint as not requiring authentication.

### Requirement 5: Swagger UI Serving

**User Story:** As a developer, I want to access an interactive documentation UI at /api-docs, so that I can explore and test the API without external tools.

#### Acceptance Criteria

1. WHEN a user navigates to /api-docs, THE Swagger_UI SHALL render the complete OpenAPI specification as an interactive HTML page.
2. WHEN the server starts, THE Doc_Generator SHALL produce a valid OpenAPI 3.0 JSON document from the OpenAPI_Registry.
3. THE Swagger_UI SHALL support the "Try it out" feature allowing users to send real HTTP requests to the API.
4. WHEN the /api-docs path is requested, THE server SHALL serve the Swagger UI without requiring authentication.

### Requirement 6: Status State Machine Documentation

**User Story:** As a developer, I want the ticket status transitions documented clearly, so that API consumers understand which status changes are valid.

#### Acceptance Criteria

1. THE OpenAPI_Registry SHALL document the PATCH /api/tickets/:id/status endpoint description with the complete list of valid status transitions (OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED, OPEN→CANCELLED, IN_PROGRESS→CANCELLED).
2. WHEN an invalid status transition is documented as a possible error, THE OpenAPI_Registry SHALL include a 409 Conflict response describing the invalid transition scenario.

### Requirement 7: Schema-Doc Synchronization

**User Story:** As a developer, I want the documentation derived directly from the Zod schemas used at runtime, so that docs never drift from actual validation behavior.

#### Acceptance Criteria

1. THE Doc_Generator SHALL import and reference the same Zod schema instances used by the route validation middleware (not copies or duplicates).
2. WHEN a Zod schema is modified in the source code, THE OpenAPI documentation SHALL reflect that change without requiring separate manual updates to documentation files.
3. THE Doc_Generator SHALL produce the OpenAPI document programmatically at server startup from the registered schemas, not from a static JSON or YAML file.
