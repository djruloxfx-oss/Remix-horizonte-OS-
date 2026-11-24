import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  kind?: 'ok' | 'warn' | 'info';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-5 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]"
    >
      {toasts.map((t) => {
        const Icon =
          t.kind === 'warn' ? AlertTriangle : t.kind === 'info' ? Info : CheckCircle2;
        const tone =
          t.kind === 'warn'
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100'
            : t.kind === 'info'
              ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
              : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100';

        return (
          <div
            key={t.id}
            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-md ${tone}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t.text}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Descartar aviso"
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
