import React from 'react';
import { Play, Pause, RotateCcw, Maximize2 } from 'lucide-react';
import type { Mission, PomodoroState } from '../types/horizonte';

interface PomodoroTimerCardProps {
  pomodoro: PomodoroState;
  missions: Mission[];
  onToggleRun: () => void;
  onReset: () => void;
  onSwitchMode: (mode: 'trabajo' | 'descanso') => void;
  onSelectMission: (missionId: string) => void;
  onEnterFocus: () => void;
}

export function formatSeconds(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PomodoroTimerCard: React.FC<PomodoroTimerCardProps> = ({
  pomodoro,
  missions,
  onToggleRun,
  onReset,
  onSwitchMode,
  onSelectMission,
  onEnterFocus,
}) => {
  const activeMissions = missions.filter(
    (m) => !['Completada', 'Cancelada'].includes(m.estado)
  );
  const totalSec =
    (pomodoro.mode === 'trabajo' ? pomodoro.workMinutes : pomodoro.breakMinutes) * 60;
  const pct = totalSec > 0 ? Math.min(100, Math.max(0, ((totalSec - pomodoro.remainingSeconds) / totalSec) * 100)) : 0;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Temporizador Pomodoro
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            Ciclos completados: {pomodoro.cyclesCompleted}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => onSwitchMode('trabajo')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              pomodoro.mode === 'trabajo'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Trabajo {pomodoro.workMinutes}m
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('descanso')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              pomodoro.mode === 'descanso'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Descanso {pomodoro.breakMinutes}m
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="font-mono text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
          {formatSeconds(pomodoro.remainingSeconds)}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onToggleRun}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 min-h-[42px] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
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
            aria-label="Reiniciar temporizador"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 min-h-[42px] text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Reiniciar</span>
          </button>

          <button
            type="button"
            onClick={onEnterFocus}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 min-h-[42px] text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Maximize2 className="w-4 h-4" aria-hidden="true" />
            <span>Modo Focus</span>
          </button>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-sky-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor="pomodoro-mission-select"
          className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
        >
          Misión vinculada al bloque actual
        </label>
        <select
          id="pomodoro-mission-select"
          value={pomodoro.activeMissionId || ''}
          onChange={(e) => onSelectMission(e.target.value)}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <option value="">Sin misión vinculada</option>
          {activeMissions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.titulo}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
};
