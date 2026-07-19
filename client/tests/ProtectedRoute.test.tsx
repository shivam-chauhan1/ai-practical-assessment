import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { createContext, useContext } from 'react';
import { ProtectedRoute } from '../src/components/ProtectedRoute';
import { AuthProvider } from '../src/contexts/AuthContext';
import type { AuthContextValue } from '../src/contexts/AuthContext';

// Create a mock context provider for the authenticated state
// We directly mock the useAuth module for authenticated tests
import * as AuthModule from '../src/contexts/AuthContext';
import { vi } from 'vitest';

function renderUnauthenticated() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

function renderAuthenticated() {
  // Mock useAuth to return authenticated state
  vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
    token: 'test-token',
    user: { id: '1', name: 'Test User', email: 'test@example.com', role: 'AGENT' },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to /login when user is not authenticated', () => {
    renderUnauthenticated();

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    renderAuthenticated();

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('does NOT render protected content before redirect', () => {
    renderUnauthenticated();

    // Protected content should never appear in the DOM
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
