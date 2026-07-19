# Requirements Document

## Introduction

Add JWT-based authentication to the Support Ticket Management System. This feature introduces a login endpoint that authenticates users against seeded credentials, protects all ticket-related API routes with token verification middleware, enforces role-based access control for ticket status transitions, and provides a frontend login page that stores the token in memory only.

## Glossary

- **Auth_Service**: The backend service layer responsible for verifying user credentials and issuing JWT tokens.
- **Auth_Middleware**: Express middleware that extracts and validates a JWT from the Authorization header on protected routes.
- **Login_Endpoint**: The POST /api/auth/login route that accepts credentials and returns a JWT.
- **Token**: A JSON Web Token (JWT) containing the user's id, email, and role as claims, signed with a server-side secret.
- **Auth_Context**: A React context provider that holds the current user's token and profile in component state (memory only).
- **Login_Page**: A frontend route-level component that collects email and password and calls the Login_Endpoint.
- **Protected_Route**: Any route under /api/tickets that requires a valid Token in the request.
- **ADMIN**: A user role that grants permission to change ticket status.
- **AGENT**: A user role that can create tickets and add comments but cannot change ticket status.

## Requirements

### Requirement 1: User Password Storage

**User Story:** As a system administrator, I want user passwords stored as bcrypt hashes in the database, so that credentials are never persisted in plain text.

#### Acceptance Criteria

1. THE User model SHALL include a password field of type String with a minimum storage capacity of 60 characters that stores a bcrypt hash.
2. WHEN the database is seeded, THE Seed_Script SHALL hash each user's plain-text password using bcrypt with a cost factor of 10 before inserting the record, and the resulting stored value SHALL be a valid bcrypt hash string (60 characters, beginning with a recognized bcrypt prefix such as "$2b$").
3. IF a User record is inserted or updated with a null or empty-string password field, THEN THE database SHALL reject the operation and the record SHALL NOT be persisted.
4. IF the bcrypt hashing operation fails during seeding, THEN THE Seed_Script SHALL terminate without inserting the affected user record and SHALL log an error message indicating which user failed to hash.

### Requirement 2: Login Endpoint

**User Story:** As a staff member, I want to log in with my email and password, so that I receive a token granting access to the system.

#### Acceptance Criteria

1. WHEN a POST request is sent to /api/auth/login with a JSON body containing a valid email and password combination, THE Auth_Service SHALL return a 200 status with a JSON response containing a "token" field holding the signed Token and a "user" object containing the user's id, name, email, and role, WHERE the "user" object field values SHALL match the corresponding claims in the Token payload.
2. WHEN a POST request is sent to /api/auth/login with an email that does not exist in the database, THE Auth_Service SHALL return a 401 status with a JSON response containing an error message "Invalid email or password".
3. WHEN a POST request is sent to /api/auth/login with a valid email but incorrect password, THE Auth_Service SHALL return a 401 status with a JSON response containing an error message "Invalid email or password".
4. WHEN a POST request is sent to /api/auth/login with a missing or empty email field, THE Auth_Service SHALL return a 400 status with a JSON response containing a validation error message indicating the email field is required.
5. WHEN a POST request is sent to /api/auth/login with a missing or empty password field, THE Auth_Service SHALL return a 400 status with a JSON response containing a validation error message indicating the password field is required.
6. WHEN a POST request is sent to /api/auth/login with an email value that is not a valid email format, THE Auth_Service SHALL return a 400 status with a JSON response containing a validation error message indicating the email must be a valid email address.
7. THE Token SHALL contain the user's id, email, and role as payload claims.
8. THE Token SHALL expire after the duration specified by the JWT_EXPIRES_IN environment variable.

### Requirement 3: JWT Configuration

**User Story:** As a developer, I want JWT secrets and expiry configured through environment variables, so that they can be changed without code modifications.

#### Acceptance Criteria

1. THE Config_Module SHALL read a JWT_SECRET environment variable and expose it to the Auth_Service.
2. THE Config_Module SHALL read a JWT_EXPIRES_IN environment variable (e.g., "1h", "7d") and expose it to the Auth_Service.
3. IF the JWT_SECRET environment variable is not set or is an empty string, THEN THE Config_Module SHALL log an error message indicating that JWT_SECRET is required and SHALL then terminate the application process during startup.
4. IF the JWT_SECRET environment variable is set to a value shorter than 32 characters, THEN THE Config_Module SHALL log an error message indicating that JWT_SECRET is too short and SHALL then terminate the application process during startup.
5. IF the JWT_EXPIRES_IN environment variable is not set or is an empty string, THEN THE Config_Module SHALL log an error message indicating that JWT_EXPIRES_IN is required and SHALL then terminate the application process during startup.

### Requirement 4: Authentication Middleware

**User Story:** As a system administrator, I want all ticket-related routes protected by token verification, so that unauthenticated users cannot access ticket data.

#### Acceptance Criteria

1. WHEN a request to any Protected_Route includes a valid, non-expired Token in the Authorization header (format: "Bearer <token>"), THE Auth_Middleware SHALL decode the Token and attach the user's id, email, and role to the request object, then allow the request to proceed to the next handler.
2. WHEN a request to any Protected_Route does not include an Authorization header, THE Auth_Middleware SHALL return a 401 status with a JSON response containing an error message "Authentication required".
3. WHEN a request to any Protected_Route includes an expired Token, THE Auth_Middleware SHALL return a 401 status with a JSON response containing an error message "Token expired".
4. WHEN a request to any Protected_Route includes an Authorization header that does not follow the "Bearer <token>" format, or contains a token that fails signature verification, THE Auth_Middleware SHALL return a 401 status with a JSON response containing an error message "Invalid token".
5. THE Auth_Middleware SHALL be applied to all routes under /api/tickets, including sub-routes for comments and tags.
6. THE Login_Endpoint (/api/auth/login) SHALL remain accessible without a Token.
7. WHEN a request to any Protected_Route is allowed to proceed, THE Auth_Middleware SHALL NOT modify the request body or query parameters.

### Requirement 5: Role-Based Status Transition Authorization

**User Story:** As a product owner, I want only ADMIN users to change ticket status, so that status transitions remain controlled and auditable.

#### Acceptance Criteria

1. WHEN an authenticated user with the ADMIN role sends a PATCH request to /api/tickets/:id/status, THE Auth_Middleware SHALL allow the request to proceed to the status transition logic.
2. WHEN an authenticated user with the AGENT role sends a PATCH request to /api/tickets/:id/status, THE Auth_Middleware SHALL return a 403 status with an error message indicating that only ADMIN users can change ticket status.
3. WHILE a user has the AGENT role, THE system SHALL allow the user to create tickets via POST /api/tickets.
4. WHILE a user has the AGENT role, THE system SHALL allow the user to add comments via POST /api/tickets/:id/comments.
5. WHILE a user has the AGENT role, THE system SHALL allow the user to read tickets and ticket details via GET /api/tickets and GET /api/tickets/:id.
6. WHILE a user has the ADMIN role, THE system SHALL unconditionally allow the user to perform all operations available to the AGENT role (create tickets, add comments, and read tickets) in addition to changing ticket status, without requiring the ADMIN to specify which operation they intend to perform.
7. THE Auth_Middleware SHALL enforce the role-based restriction exclusively on PATCH /api/tickets/:id/status and SHALL NOT restrict access to other ticket endpoints based on role.

### Requirement 6: Frontend Login Page

**User Story:** As a staff member, I want a login page where I can enter my credentials, so that I can authenticate and access the ticket system.

#### Acceptance Criteria

1. THE Login_Page SHALL be rendered at the /login route and SHALL display an email input field (type="email", maximum 254 characters), a password input field (type="password", maximum 128 characters), and a submit button labeled with the text "Login" or "Sign in".
2. WHEN the user submits valid credentials, THE Login_Page SHALL call the Login_Endpoint and store the returned Token and user profile in the Auth_Context.
3. WHEN the user submits valid credentials and the Token is stored successfully, THE Login_Page SHALL redirect the user to the "/" route (ticket list page).
4. WHEN the Login_Endpoint returns an error response, THE Login_Page SHALL display the error message in a visible element on the login form without navigating away, and SHALL preserve the email value the user entered.
5. WHILE the login request is in progress, THE Login_Page SHALL disable the submit button and display a visible loading indicator.
6. IF the user attempts to submit the form with an empty email field or an empty password field, THEN THE Login_Page SHALL not send a request to the Login_Endpoint and SHALL display a validation message indicating which field(s) must be filled.
7. IF the email field value is not a valid email format, THEN THE Login_Page SHALL not send a request to the Login_Endpoint and SHALL display a validation message indicating the email format is invalid.
8. IF a network error occurs during the login request, THEN THE Login_Page SHALL display an error message indicating the server is unavailable and SHALL re-enable the submit button.

### Requirement 7: In-Memory Token Storage

**User Story:** As a security-conscious developer, I want the JWT stored in React component state only, so that the token is not accessible via localStorage or sessionStorage XSS attacks.

#### Acceptance Criteria

1. THE Auth_Context SHALL store the Token in React state (useState or useReducer), not in localStorage, sessionStorage, or cookies.
2. WHEN the browser tab is refreshed or closed, THE Auth_Context SHALL lose the Token, requiring the user to log in again.
3. WHEN the logout function exposed by the Auth_Context is invoked, THE Auth_Context SHALL set the Token to null and the user profile to null, causing the authentication status to become unauthenticated.
4. THE Auth_Context SHALL expose the current user's profile (id, name, email, role) to child components when a Token is present, and SHALL expose null when no Token is present.
5. THE Auth_Context SHALL expose a login function that accepts a Token string and a user profile object (containing id, name, email, and role) and SHALL store both values in React state such that subsequent reads of the Token and profile return the provided inputs.
6. THE Auth_Context SHALL expose a boolean authentication status indicating whether a valid Token is currently held in state.

### Requirement 8: Authenticated API Requests from Frontend

**User Story:** As a developer, I want the API client to automatically attach the token to outgoing requests, so that protected endpoints are called correctly without manual header management in each component.

#### Acceptance Criteria

1. WHEN a Token is present in the Auth_Context, THE API_Client SHALL include an Authorization header with the value "Bearer <token>" on every request to /api/tickets and its sub-routes.
2. IF no Token is present in the Auth_Context, THEN THE API_Client SHALL omit the Authorization header from the request.
3. WHEN the API_Client receives a 401 response from any Protected_Route, THE API_Client SHALL clear the stored Token in the Auth_Context, redirect the user to the Login_Page, and reject the original request's promise with an error indicating the user's session has expired.
4. THE API_Client SHALL NOT include the Authorization header on requests to /api/auth/login.

### Requirement 9: Route Protection on Frontend

**User Story:** As a staff member, I want to be redirected to the login page if I try to access a protected page without being authenticated, so that the application behaves predictably.

#### Acceptance Criteria

1. WHEN a user with no Token in Auth_Context navigates to the ticket list page (/), the create ticket page (/tickets/new), or the ticket detail page (/tickets/:id), THE application SHALL allow the navigation attempt but SHALL redirect the user to the Login_Page (/login) before rendering any protected page content.
2. WHEN a user with a valid Token in Auth_Context navigates to the Login_Page (/login), THE application SHALL redirect the user to the ticket list page (/).
3. WHILE the Auth_Context has no Token, THE application SHALL not render the content of any protected page component to the user.
