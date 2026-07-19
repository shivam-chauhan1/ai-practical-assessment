import type { Comment } from '../api/types';
import { formatRelativeTime } from '../utils/formatTime';

export default function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No comments yet.</p>;
  }

  return (
    <div>
      {comments.map((comment) => (
        <div key={comment.id} style={{ padding: '12px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>{comment.author.name}</span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{formatRelativeTime(comment.createdAt)}</span>
          </div>
          <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap' }}>{comment.body}</p>
        </div>
      ))}
    </div>
  );
}
