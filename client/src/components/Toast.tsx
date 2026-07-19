import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

const TOAST_COLORS = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  error: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
};

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const colors = TOAST_COLORS[type];

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      padding: '12px 20px',
      backgroundColor: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      color: colors.text,
      fontSize: '14px',
      fontWeight: 500,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      maxWidth: '400px',
    }}>
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: colors.text, cursor: 'pointer', fontSize: '18px', padding: '0' }}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}
