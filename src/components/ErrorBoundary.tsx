import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMsg = error.message || 'Ha ocurrido un error inesperado.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string };
      if (parsed && typeof parsed.error === 'string') {
        displayMsg = parsed.error;
      }
    } catch {
      // Keep original error message
    }
    return { hasError: true, message: displayMsg };
  }

  override componentDidCatch(error: Error) {
    console.error('Horizonte OS ErrorBoundary caught:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-md w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Algo interrumpió la vista actual
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-semibold"
            >
              Recargar Horizonte OS
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
