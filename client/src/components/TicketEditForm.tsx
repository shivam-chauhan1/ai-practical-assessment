import { useState } from 'react';
import { updateTicket } from '../api/tickets';
import { ApiError } from '../api/client';
import type { Ticket, User } from '../api/types';
import TicketForm, { type TicketFormValues } from './TicketForm';
import ErrorDisplay from './ErrorDisplay';

interface TicketEditFormProps {
  ticket: Ticket;
  users: User[];
  onSaved: (updated: Ticket) => void;
  onCancel: () => void;
}

export default function TicketEditForm({ ticket, users, onSaved, onCancel }: TicketEditFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const handleSubmit = async (values: TicketFormValues) => {
    setServerError(null);
    setServerFieldErrors([]);
    setApiError(null);
    setSubmitting(true);
    try {
      const updated = await updateTicket(ticket.id, {
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        assignedTo: values.assignedTo || null,
      });
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err);
        setServerError(err.message);
        if (err.details) {
          setServerFieldErrors(err.details);
        }
      } else {
        setServerError('Failed to update ticket');
        setApiError(new ApiError(0, 'NETWORK_ERROR', 'Failed to update ticket'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Show ErrorDisplay for TICKET_LOCKED and NETWORK_ERROR (non-validation errors)
  const showErrorDisplay = apiError && apiError.code !== 'VALIDATION_ERROR';

  return (
    <div>
      {showErrorDisplay && (
        <ErrorDisplay error={apiError} onDismiss={() => setApiError(null)} />
      )}
      <TicketForm
        mode="edit"
        initialValues={{
          title: ticket.title,
          description: ticket.description,
          priority: ticket.priority,
          createdBy: ticket.createdBy,
          assignedTo: ticket.assignedTo ?? '',
        }}
        users={users}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        submitting={submitting}
        serverError={serverError}
        serverFieldErrors={serverFieldErrors}
      />
    </div>
  );
}
