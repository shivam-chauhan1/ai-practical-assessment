import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorDisplay from '../src/components/ErrorDisplay';
import { ApiError } from '../src/api/client';

describe('ErrorDisplay', () => {
  it('returns null when error is null', () => {
    const { container } = render(<ErrorDisplay error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "Ticket Locked" text and terminal state message for TICKET_LOCKED', () => {
    const error = new ApiError(403, 'TICKET_LOCKED', 'Ticket is locked');
    render(<ErrorDisplay error={error} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Ticket Locked')).toBeInTheDocument();
    expect(screen.getByText(/terminal state/i)).toBeInTheDocument();
  });

  it('renders "Network Error" text and server unavailable message for NETWORK_ERROR', () => {
    const error = new ApiError(0, 'NETWORK_ERROR', 'Server is unavailable');
    render(<ErrorDisplay error={error} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Network Error')).toBeInTheDocument();
    expect(screen.getByText(/server is unavailable/i)).toBeInTheDocument();
  });

  it('renders "Not Found" text and resource not found message for NOT_FOUND', () => {
    const error = new ApiError(404, 'NOT_FOUND', 'Not found');
    render(<ErrorDisplay error={error} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Not Found')).toBeInTheDocument();
    expect(screen.getByText(/does not exist/i)).toBeInTheDocument();
  });

  it('renders "Invalid Transition" text and the error message for INVALID_TRANSITION', () => {
    const error = new ApiError(
      422,
      'INVALID_TRANSITION',
      'Cannot transition from OPEN to CLOSED'
    );
    render(<ErrorDisplay error={error} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Invalid Transition')).toBeInTheDocument();
    expect(
      screen.getByText('Cannot transition from OPEN to CLOSED')
    ).toBeInTheDocument();
  });

  it('renders "Validation Error" text and field-specific messages when details are provided', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', [
      { field: 'title', message: 'Title is required' },
      { field: 'description', message: 'Description too short' },
    ]);
    render(<ErrorDisplay error={error} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Validation Error')).toBeInTheDocument();
    // Field-specific messages rendered in a list
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Description too short')).toBeInTheDocument();
    // Rendered as list items
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
  });

  it('renders just the error message for VALIDATION_ERROR without details', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Something went wrong');
    render(<ErrorDisplay error={error} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Validation Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // No list items when no details
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const error = new ApiError(404, 'NOT_FOUND', 'Not found');
    const onDismiss = vi.fn();
    render(<ErrorDisplay error={error} onDismiss={onDismiss} />);

    const dismissButton = screen.getByLabelText('Dismiss error');
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button when onDismiss is not provided', () => {
    const error = new ApiError(404, 'NOT_FOUND', 'Not found');
    render(<ErrorDisplay error={error} />);

    expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument();
  });
});
