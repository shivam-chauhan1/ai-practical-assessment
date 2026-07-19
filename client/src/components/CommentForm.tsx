import { useState } from 'react';
import { addComment } from '../api/comments';
import { ApiError } from '../api/client';
import type { Comment, User } from '../api/types';
import ErrorDisplay from './ErrorDisplay';

interface CommentFormProps {
  ticketId: string;
  users: User[];
  onCommentAdded: (comment: Comment) => void;
}

export default function CommentForm({ ticketId, users, onCommentAdded }: CommentFormProps) {
  const [body, setBody] = useState('');
  const [authorId, setAuthorId] = useState(users[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !authorId) return;

    setSubmitting(true);
    setError(null);
    try {
      const comment = await addComment(ticketId, { body: body.trim(), authorId });
      onCommentAdded(comment);
      setBody('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'NETWORK_ERROR', 'Failed to add comment'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <select
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment..."
        rows={3}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', resize: 'vertical', boxSizing: 'border-box' }}
      />
      {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}
      <button
        type="submit"
        disabled={submitting || !body.trim()}
        style={{
          marginTop: '8px',
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: submitting || !body.trim() ? 'not-allowed' : 'pointer',
          opacity: submitting || !body.trim() ? 0.6 : 1,
        }}
      >
        {submitting ? 'Adding...' : 'Add Comment'}
      </button>
    </form>
  );
}
