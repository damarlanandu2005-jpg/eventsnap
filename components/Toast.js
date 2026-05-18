import { useState, useEffect, useCallback, createContext, useContext } from 'react';

// ─────────────────────────────────────────────────────────────
// Toast notification system
// Usage:
//   import { ToastProvider, useToast } from '@/components/Toast';
//
//   // Wrap your app:
//   <ToastProvider><App /></ToastProvider>
//
//   // In any component:
//   const toast = useToast();
//   toast.success('Photos uploaded!');
//   toast.error('Upload failed');
//   toast.info('Processing...');
// ─────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 5000),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '380px' }}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const styles = {
    success: { bg: 'bg-green-500/15 border-green-500/30', icon: '✓', iconBg: 'bg-green-500', text: 'text-green-300' },
    error: { bg: 'bg-red-500/15 border-red-500/30', icon: '✕', iconBg: 'bg-red-500', text: 'text-red-300' },
    info: { bg: 'bg-violet-500/15 border-violet-500/30', icon: 'ℹ', iconBg: 'bg-violet-500', text: 'text-violet-300' },
  };

  const s = styles[toast.type] || styles.info;

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${s.bg} ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}
      onClick={onDismiss}
      role="alert"
    >
      <div className={`w-6 h-6 rounded-full ${s.iconBg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
        {s.icon}
      </div>
      <p className={`text-sm font-medium ${s.text}`}>{toast.message}</p>
    </div>
  );
}
