import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../src/pages/LoginPage';
import { AuthProvider } from '../src/contexts/AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../src/api/client', async () => {
  const actual = await vi.importActual('../src/api/client');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

import { apiRequest } from '../src/api/client';
import { ApiError } from '../src/api/client';

const mockedApiRequest = vi.mocked(apiRequest);

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input, password input, and Login button', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows validation error when email is empty', async () => {
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('shows validation error when password is empty', async () => {
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('shows validation error when email format is invalid', async () => {
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByText('Email format is invalid')).toBeInTheDocument();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('calls apiRequest and redirects on successful login', async () => {
    mockedApiRequest.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: '1', name: 'Alice', email: 'alice@example.com', role: 'ADMIN' },
    });

    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    expect(mockedApiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
    });
  });

  it('displays error message on API error and preserves email', async () => {
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError(401, 'AUTHENTICATION_ERROR', 'Invalid email or password')
    );

    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });

    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe('alice@example.com');
  });

  it('shows "Server is unavailable" on network error', async () => {
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR', 'Server is unavailable. Please try again later.')
    );

    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Server is unavailable')).toBeInTheDocument();
    });
  });

  it('disables submit button and shows loading state while request is in progress', async () => {
    let resolveRequest: (value: unknown) => void;
    mockedApiRequest.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));

    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    });

    resolveRequest!({
      token: 'jwt-token',
      user: { id: '1', name: 'Alice', email: 'alice@example.com', role: 'ADMIN' },
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
