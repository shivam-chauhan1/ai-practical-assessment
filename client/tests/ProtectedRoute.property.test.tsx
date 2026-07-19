// Feature: jwt-auth, Property 9: Unauthenticated route protection
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ProtectedRoute } from '../src/components/ProtectedRoute';

/**
 * **Validates: Requirements 9.1, 9.3**
 *
 * Property 9: Unauthenticated route protection
 * For any protected route path (`/`, `/tickets/new`, `/tickets/:id`), when no token
 * is present in AuthContext, navigating to that path SHALL result in a redirect to
 * `/login` without rendering any protected page content.
 */
describe('Property 9: Unauthenticated route protection', () => {
  // Arbitrary for generating a UUID-like string for ticket IDs
  const uuidArb = fc.uuid();

  // Arbitrary for generating protected route paths
  const protectedRouteArb = fc.oneof(
    fc.constant('/'),
    fc.constant('/tickets/new'),
    uuidArb.map((id) => `/tickets/${id}`)
  );

  it('redirects to /login and does not render protected content for any protected route when unauthenticated', () => {
    fc.assert(
      fc.property(protectedRouteArb, (path) => {
        // Determine which route pattern matches the path
        const isTicketDetail = path.startsWith('/tickets/') && path !== '/tickets/new';

        const { unmount } = render(
          <MemoryRouter initialEntries={[path]}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <div data-testid="protected-content">Ticket List</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tickets/new"
                  element={
                    <ProtectedRoute>
                      <div data-testid="protected-content">Create Ticket</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tickets/:id"
                  element={
                    <ProtectedRoute>
                      <div data-testid="protected-content">Ticket Detail</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/login"
                  element={<div data-testid="login-page">Login Page</div>}
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        // Verify redirect to /login happened
        expect(screen.getByTestId('login-page')).toBeInTheDocument();

        // Verify no protected content is rendered
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

        // Clean up after each iteration to avoid DOM accumulation
        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
