import { useEffect } from 'react';
import './Toast.css';

export default function Toast({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`toast toast--${toast.type}`}>
      <span className="toast__icon">
        {toast.type === 'switch' && '⟳'}
        {toast.type === 'ratchet' && '↑'}
        {toast.type === 'observe' && '👁'}
        {toast.type === 'error' && '!'}
      </span>
      <span className="toast__message">{toast.message}</span>
      <button className="toast__dismiss" onClick={() => onDismiss(toast.id)}>
        ×
      </button>
    </div>
  );
}
