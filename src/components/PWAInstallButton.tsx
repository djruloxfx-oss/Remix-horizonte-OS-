import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{compact ? 'Instalar' : 'Instalar App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
              <h3 id="ios-install-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Instalar en iPhone / iPad
              </h3>
              <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
                <li>Pulsa el botón <strong>Compartir</strong> en la barra inferior de Safari.</li>
                <li>Desplázate hacia abajo y selecciona <strong>Añadir a pantalla de inicio</strong>.</li>
                <li>Pulsa <strong>Añadir</strong> para usar Horizonte OS offline.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-slate-900 dark:bg-slate-100 py-2.5 px-4 min-h-[44px] text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
