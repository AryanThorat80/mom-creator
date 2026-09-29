import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', durationMs = 4000) => {
    const id = `${Date.now()}_${Math.random()}`;
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    if (durationMs > 0) {
      setTimeout(() => {
        removeToast(id);
      }, durationMs);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
        {toasts.map((toast) => {
          let Icon = Info;
          let borderClass = 'border-slate-200 bg-white text-slate-800 shadow-lg';
          let iconClass = 'text-slate-500';

          if (toast.type === 'success') {
            Icon = CheckCircle2;
            borderClass = 'border-emerald-200 bg-emerald-50/95 text-emerald-900 shadow-md';
            iconClass = 'text-emerald-600';
          } else if (toast.type === 'error') {
            Icon = AlertCircle;
            borderClass = 'border-rose-200 bg-rose-50/95 text-rose-900 shadow-md';
            iconClass = 'text-rose-600';
          } else if (toast.type === 'warning') {
            Icon = AlertTriangle;
            borderClass = 'border-amber-200 bg-amber-50/95 text-amber-900 shadow-md';
            iconClass = 'text-amber-600';
          }

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border text-sm transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${borderClass}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconClass}`} />
              <div className="flex-1 font-medium leading-relaxed break-words">{toast.message}</div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 p-0.5 -mr-1 -mt-0.5 rounded transition-colors"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
