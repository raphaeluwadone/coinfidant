import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import "./Toasts.css";

type Toast = { id: number; text: string; action?: { label: string; run: () => void }; tone?: "dark" | "accent" };
type ShowToast = (t: Omit<Toast, "id">, ms?: number) => () => void;

const ToastContext = createContext<ShowToast>(() => () => {});

export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const show = useCallback<ShowToast>((t, ms = 3500) => {
    const id = ++seq.current;
    setToasts((all) => [...all, { ...t, id }]);
    const dismiss = () => setToasts((all) => all.filter((x) => x.id !== id));
    setTimeout(dismiss, ms);
    return dismiss;
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "accent" ? "is-accent" : ""}`}>
            <span>{t.text}</span>
            {t.action && (
              <button
                className="toast__action"
                onClick={() => {
                  t.action!.run();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
