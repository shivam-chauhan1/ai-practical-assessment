import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createTicket } from '../api/tickets';
import { listUsers } from '../api/users';
import { ApiError } from '../api/client';
import type { User } from '../api/types';
import TicketForm, { type TicketFormValues } from '../components/TicketForm';
import ErrorDisplay from '../components/ErrorDisplay';

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);

  useEffect(() => {
    listUsers()
      .then((data) => setUsers(data))
      .catch((err) => {
        if (err instanceof ApiError) {
          setLoadError(err);
        } else {
          setLoadError(new ApiError(0, 'NETWORK_ERROR', 'Failed to load users'));
        }
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  const handleSubmit = async (values: TicketFormValues) => {
    setServerError(null);
    setServerFieldErrors([]);
    setApiError(null);
    setSubmitting(true);
    try {
      await createTicket({
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        createdBy: values.createdBy,
        assignedTo: values.assignedTo || null,
      });
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err);
        setServerError(err.message);
        if (err.details) {
          setServerFieldErrors(err.details);
        }
      } else {
        setServerError('An unexpected error occurred');
        setApiError(new ApiError(0, 'NETWORK_ERROR', 'An unexpected error occurred'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUsers) {
    return <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}><p>Loading...</p></div>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <Link to="/" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px' }}>← Back to tickets</Link>
      <h1 style={{ marginTop: '16px' }}>Create Ticket</h1>

      {loadError && <ErrorDisplay error={loadError} />}
      {apiError && apiError.code !== 'VALIDATION_ERROR' && (
        <ErrorDisplay error={apiError} onDismiss={() => setApiError(null)} />
      )}

      <TicketForm
        mode="create"
        users={users}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/')}
        submitting={submitting}
        serverError={serverError}
        serverFieldErrors={serverFieldErrors}
      />
    </div>
  );
}
