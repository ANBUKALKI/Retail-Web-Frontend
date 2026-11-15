import { createContext, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [list, setList] = useState([]);

  const api = useMemo(() => {
    const push = (type, msg) => {
      const id = Math.random().toString(36).slice(2);
      setList((l) => [...l, { id, type, msg }]);
      setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), type === 'err' ? 6000 : 3500);
    };
    return { ok: (m) => push('ok', m), err: (m) => push('err', m), info: (m) => push('info', m) };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts no-print" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
