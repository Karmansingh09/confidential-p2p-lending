import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let globalToastDispatcher: ((item: Omit<ToastItem, 'id'>) => void) | null = null;

export const triggerToast = (message: string, type: ToastType = 'info', title?: string, duration = 4000) => {
  if (globalToastDispatcher) {
    globalToastDispatcher({ message, type, title, duration });
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastItem = { id, type, title, message, duration };
      setToasts((prev) => [...prev.slice(-4), newToast]);
    },
    []
  );

  useEffect(() => {
    globalToastDispatcher = (item) => {
      showToast(item.message, item.type, item.title, item.duration);
    };
    return () => {
      globalToastDispatcher = null;
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="toast-portal-container" aria-live="polite">
        {toasts.map((toast) => (
          <SingleToast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: triggerToast,
      removeToast: () => {},
    };
  }
  return ctx;
};

const SingleToast: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeIcons: Record<ToastType, JSX.Element> = {
    info: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A92A0" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    success: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    warning: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    error: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  };

  return (
    <div className={`toast-card toast-${toast.type}`} role="alert">
      <div className="toast-body">
        <div className="toast-icon">{typeIcons[toast.type]}</div>
        <div className="toast-content">
          {toast.title && <strong className="toast-title">{toast.title}</strong>}
          <p className="toast-message">{toast.message}</p>
        </div>
        <button type="button" className="toast-close-btn" onClick={onClose} aria-label="Close notification">
          &times;
        </button>
      </div>
      <div
        className="toast-progress-bar"
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
};
