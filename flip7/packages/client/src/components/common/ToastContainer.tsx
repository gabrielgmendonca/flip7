import React from 'react';
import './Toast.css';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

function ToastItemComponent({ toast, onRemove }: { toast: ToastItem; onRemove: () => void }) {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onRemove, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <div className={`toast toast-${toast.type} ${isVisible ? 'toast-visible' : 'toast-hidden'}`}>
      {toast.message}
      <button className="toast-close" onClick={() => { setIsVisible(false); setTimeout(onRemove, 300); }}>
        &times;
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItemComponent key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}
