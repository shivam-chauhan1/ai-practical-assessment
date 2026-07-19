import { useState } from 'react';
import type { Priority, User } from '../api/types';
import ErrorBanner from './ErrorBanner';

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export interface TicketFormValues {
  title: string;
  description: string;
  priority: Priority;
  createdBy: string;
  assignedTo: string;
}

interface TicketFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<TicketFormValues>;
  users: User[];
  onSubmit: (values: TicketFormValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  serverFieldErrors: Array<{ field: string; message: string }>;
}

interface FormErrors {
  title?: string;
  description?: string;
  createdBy?: string;
}

export default function TicketForm({
  mode,
  initialValues,
  users,
  onSubmit,
  onCancel,
  submitting,
  serverError,
  serverFieldErrors,
}: TicketFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [priority, setPriority] = useState<Priority>(initialValues?.priority ?? 'MEDIUM');
  const [createdBy, setCreatedBy] = useState(initialValues?.createdBy ?? '');
  const [assignedTo, setAssignedTo] = useState(initialValues?.assignedTo ?? '');
  const [clientErrors, setClientErrors] = useState<FormErrors>({});

  const validateClient = (): boolean => {
    const errors: FormErrors = {};
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      errors.title = 'Title is required';
    } else if (trimmedTitle.length < 3) {
      errors.title = 'Title must be at least 3 characters';
    } else if (trimmedTitle.length > 200) {
      errors.title = 'Title must be at most 200 characters';
    }

    if (!trimmedDescription) {
      errors.description = 'Description is required';
    } else if (trimmedDescription.length > 5000) {
      errors.description = 'Description must be at most 5000 characters';
    }

    if (mode === 'create' && !createdBy) {
      errors.createdBy = 'Please select who is creating this ticket';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateClient()) return;
    await onSubmit({ title, description, priority, createdBy, assignedTo });
  };

  const getFieldError = (field: string): string | undefined => {
    return serverFieldErrors.find((e) => e.field === field)?.message;
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Title */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>
          Title <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setClientErrors((prev) => ({ ...prev, title: undefined })); }}
          placeholder="Brief summary of the issue"
          style={{ width: '100%', padding: '8px 12px', border: `1px solid ${clientErrors.title || getFieldError('title') ? '#dc2626' : '#d1d5db'}`, borderRadius: '6px', boxSizing: 'border-box' }}
        />
        {clientErrors.title && <span style={{ color: '#dc2626', fontSize: '13px' }}>{clientErrors.title}</span>}
        {getFieldError('title') && (
          <span style={{ color: '#dc2626', fontSize: '13px', display: 'block' }}>{getFieldError('title')}</span>
        )}
      </div>

      {/* Description */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>
          Description <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); setClientErrors((prev) => ({ ...prev, description: undefined })); }}
          placeholder="Detailed description of the issue or request"
          rows={5}
          style={{ width: '100%', padding: '8px 12px', border: `1px solid ${clientErrors.description || getFieldError('description') ? '#dc2626' : '#d1d5db'}`, borderRadius: '6px', resize: 'vertical', boxSizing: 'border-box' }}
        />
        {clientErrors.description && <span style={{ color: '#dc2626', fontSize: '13px' }}>{clientErrors.description}</span>}
        {getFieldError('description') && (
          <span style={{ color: '#dc2626', fontSize: '13px', display: 'block' }}>{getFieldError('description')}</span>
        )}
      </div>

      {/* Priority + Created By row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>
            Priority <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {mode === 'create' && (
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>
              Created By <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={createdBy}
              onChange={(e) => { setCreatedBy(e.target.value); setClientErrors((prev) => ({ ...prev, createdBy: undefined })); }}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${clientErrors.createdBy ? '#dc2626' : '#d1d5db'}`, borderRadius: '6px' }}
            >
              <option value="">Select user...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
            {clientErrors.createdBy && <span style={{ color: '#dc2626', fontSize: '13px' }}>{clientErrors.createdBy}</span>}
          </div>
        )}
      </div>

      {/* Assignee (optional) */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>
          Assignee <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional)</span>
        </label>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        >
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
      </div>

      {/* Server error banner */}
      {serverError && (
        <ErrorBanner message={serverError} />
      )}

      {/* Submit */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting
            ? (mode === 'create' ? 'Creating...' : 'Saving...')
            : (mode === 'create' ? 'Create Ticket' : 'Save Changes')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            textDecoration: 'none',
            color: '#374151',
            cursor: 'pointer',
            background: 'white',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
