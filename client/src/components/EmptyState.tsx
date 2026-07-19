export default function EmptyState({ message }: { message?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px', color: '#6b7280' }}>
      <p style={{ fontSize: '16px' }}>{message || 'No tickets found.'}</p>
    </div>
  );
}
