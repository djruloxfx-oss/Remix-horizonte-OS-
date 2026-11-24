import React from 'react';
import { Play, Pause, RotateCcw, X, CheckCircle2 } from 'lucide-react';
import type { GemaState, Mission, PomodoroState, TaskItem } from '../types/horizonte';
import { formatSeconds } from './PomodoroTimerCard';

interface FocusOverlayProps {
  open: boolean;
  pomodoro: PomodoroState;
  gema: GemaState;
  activeMission?: Mission;
  nextTask?: TaskItem;
  onToggleRun: () => void;
  onReset: () => void;
  onCompleteTask: (id: string) => void;
  onExit: () => void;
}

export const FocusOverlay: React.FC<FocusOverlayProps> = ({
  open,
  pomodoro,
  gema,
  activeMission,
  nextTask,
  onToggleRun,
  onReset,
  onCompleteTask,
  onExit,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 text-slate-50 flex flex-col justify-between p-6 sm:p-10"
      role="dialog"
      aria-modal="true"
      aria-label="Modo Focus"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium text-slate-400">
          Modo Focus · GEMA {gema.energia}% ({gema.cargaCognitiva})
        </div>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 px-4 py-2 min-h-[42px] text-sm font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
          <span>Salir de Focus</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto w-full text-center space-y-6">
        <div className="text-xs font-medium text-sky-400">
          {pomodoro.mode === 'trabajo' ? 'Bloque de trabajo profundo' : 'Descanso activo'}
        </div>

        <div className="font-mono text-6xl sm:text-8xl font-semibold tracking-tight tabular-nums">
          {formatSeconds(pomodoro.remainingSeconds)}
        </div>

        {activeMission ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 text-left">
            <div className="text-xs text-slate-400">
              Misión activa · {activeMission.prioridad} · {activeMission.estado}
            </div>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {activeMission.titulo}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Próxima acción: <span className="text-white font-medium">{activeMission.siguiente || 'Avanzar al siguiente paso'}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Concéntrate en una sola tarea a la vez para mantener baja la carga cognitiva.
          </p>
        )}

        {nextTask && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 flex items-center justify-between gap-4 text-left">
            <div className="min-w-0">
              <div className="text-xs text-slate-400">Tarea prioritaria</div>
              <div className="text-sm font-medium text-slate-100 truncate">
                {nextTask.titulo}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onCompleteTask(nextTask.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white shrink-0 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Completar</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onToggleRun}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 px-6 py-3 min-h-[46px] text-sm font-semibold text-white transition-colors"
          >
            {pomodoro.running ? (
              <>
                <Pause className="w-4 h-4" aria-hidden="true" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>Iniciar</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 px-5 py-3 min-h-[46px] text-sm font-medium text-slate-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Reiniciar</span>
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500">
        Horizonte OS · Control humano y ejecución sin distracciones
      </div>
    </div>
  );
};
