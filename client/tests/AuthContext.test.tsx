import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuthProvider, useAuth, type UserProfile } from '../src/contexts/AuthContext';

function TestConsumer() {
  const { token, user, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="token">{token ?? 'null'}</span>
      <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
      <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
      <button onClick={() => login('test-token', mockUser)}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

const mockUser: UserProfile = {
  id: '123',
  name: 'Alice Admin',
  email: 'alice@example.com',
  role: 'ADMIN',
};

describe('AuthContext', () => {
  it('starts with null token, null user, and isAuthenticated false', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
  });

  it('login stores token and user, sets isAuthenticated to true', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    act(() => {
      screen.getByText('login').click();
    });

    expect(screen.getByTestId('token').textContent).toBe('test-token');
    expect(screen.getByTestId('user').textContent).toBe(JSON.stringify(mockUser));
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
  });

  it('logout clears token and user, sets isAuthenticated to false', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    act(() => {
      screen.getByText('login').click();
    });

    expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');

    act(() => {
      screen.getByText('logout').click();
    });

    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
  });

  it('throws error when useAuth is used outside AuthProvider', () => {
    // Suppress React error boundary console output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
