import React, { useState } from 'react';
import {
  Mic,
  Phone,
  ArrowRight,
  CheckCircle2,
  Circle,
  Brain,
  ShieldCheck,
  Terminal,
  Plus,
} from 'lucide-react';
import type {
  AppTab,
  GemaState,
  Mission,
  PomodoroState,
  SuperAgentMode,
  TaskItem,
} from '../types/horizonte';
import { PomodoroTimerCard } from '../components/PomodoroTimerCard';

interface InicioViewProps {
  missions: Mission[];
  tasks: TaskItem[];
  gema: GemaState;
  pomodoro: PomodoroState;
  superAgenteModo: SuperAgentMode;
  memoriesCount: number;
  agentsCount: number;
  onChangeMode: (mode: SuperAgentMode) => void;
  onChangeEnergy: (val: number) => void;
  onToggleTask: (id: string) => void;
  onQuickAddTask: (title: string) => void;
  onTogglePomodoro: () => void;
  onResetPomodoro: () => void;
  onSwitchPomodoroMode: (mode: 'trabajo' | 'descanso') => void;
  onSelectPomodoroMission: (id: string) => void;
  onEnterFocus: () => void;
  onOpenVoice: () => void;
  onNavigate: (tab: AppTab) => void;
  onOpenNewMission: () => void;
}

export const InicioView: React.FC<InicioViewProps> = ({
  missions,
  tasks,
  gema,
  pomodoro,
  superAgenteModo,
  memoriesCount,
  agentsCount,
  onChangeMode,
  onChangeEnergy,
  onToggleTask,
  onQuickAddTask,
  onTogglePomodoro,
  onResetPomodoro,
  onSwitchPomodoroMode,
  onSelectPomodoroMission,
  onEnterFocus,
  onOpenVoice,
  onNavigate,
  onOpenNewMission,
}) => {
  const [quickTask, setQuickTask] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const activeMissions = missions.filter(
    (m) => !['Completada', 'Cancelada'].includes(m.estado)
  );
  const completedMissions = missions.filter((m) => m.estado === 'Completada');
  const riskMissions = missions.filter((m) =>
    ['En riesgo', 'Bloqueada'].includes(m.estado)
  );
  const pendingTasks = tasks.filter((t) => !t.done);

  const energyTone =
    gema.energia >= 70
      ? 'text-emerald-700 dark:text-emerald-400'
      : gema.energia >= 40
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-red-700 dark:text-red-400';

  const modeDescriptions: Record<SuperAgentMode, { label: string; desc: string }> = {
    modo1: {
      label: 'Modo 1 · Diseña y propone',
      desc: 'Entrega arquitectura, prompts y flujos listos para decidir sin ejecutar cambios.',
    },
    modo2: {
      label: 'Modo 2 · Crea con aprobación',
      desc: 'Prepara agentes y mejoras concretas solicitando confirmación antes de aplicar.',
    },
    modo3: {
      label: 'Modo 3 · Coordina automáticamente',
      desc: 'Distribuye tareas entre agentes especializados manteniendo control sobre cambios clave.',
    },
  };

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Misiones activas
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
            {activeMissions.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {completedMissions.length} completadas · {riskMissions.length} alertas
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tareas pendientes
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
            {pendingTasks.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {tasks.filter((t) => t.done).length} resueltas de {tasks.length}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            GEMA · Carga cognitiva
          </div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${energyTone}`}>
            {gema.energia}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Estado: {gema.cargaCognitiva}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Ecosistema local
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
            {agentsCount} agentes
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {memoriesCount} registros en memoria
          </div>
        </div>
      </div>

      {/* Main 2-column balanced grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column (7 cols): Pomodoro + GEMA + Super Agente Mode */}
        <div className="lg:col-span-7 space-y-6">
          <PomodoroTimerCard
            pomodoro={pomodoro}
            missions={missions}
            onToggleRun={onTogglePomodoro}
            onReset={onResetPomodoro}
            onSwitchMode={onSwitchPomodoroMode}
            onSelectMission={onSelectPomodoroMission}
            onEnterFocus={onEnterFocus}
          />

          {/* GEMA Cognitive Load Monitor */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    GEMA · Medidor de energía y carga cognitiva
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ajusta tu capacidad disponible para filtrar tareas por criterio 80/20.
                  </p>
                </div>
              </div>
              <span className={`text-lg font-mono font-semibold tabular-nums ${energyTone}`}>
                {gema.energia}%
              </span>
            </div>

            <div className="mt-4">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={gema.energia}
                aria-label="Nivel de energía disponible"
                onChange={(e) => onChangeEnergy(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Sobrecarga (0–39%)</span>
                <span>Moderada (40–69%)</span>
                <span>Óptima (70–100%)</span>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
              {gema.energia < 40
                ? 'Recomendación GEMA: Energía baja. Activa Modo Focus y ejecuta solo 1 tarea breve de bajo coste cognitivo.'
                : gema.energia < 70
                  ? 'Recomendación GEMA: Carga moderada. Trabaja en bloques Pomodoro de 25 min sobre la misión principal.'
                  : 'Recomendación GEMA: Capacidad óptima. Buen momento para diseño, verificación Aladín o tareas complejas.'}
            </div>
          </section>

          {/* Súper Agente Horizonte OS Mode Selector */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Súper Agente Horizonte OS
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Control humano y gobernanza operativa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('agentes')}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
              >
                Orquestar agentes
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['modo1', 'modo2', 'modo3'] as SuperAgentMode[]).map((m) => {
                const active = superAgenteModo === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChangeMode(m)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      active
                        ? 'border-sky-600 dark:border-sky-500 bg-sky-50/70 dark:bg-sky-950/50 text-slate-900 dark:text-slate-50'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {modeDescriptions[m].label}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      {modeDescriptions[m].desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right column (5 cols): Active Missions + Quick Tasks + Voice & Phone */}
        <div className="lg:col-span-5 space-y-6">
          {/* Próximas acciones de misiones */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Próximas acciones
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('misiones')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {activeMissions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No hay misiones activas todavía.
                </p>
                <button
                  type="button"
                  onClick={onOpenNewMission}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Crear primera misión</span>
                </button>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {activeMissions.slice(0, 4).map((m) => (
                  <div key={m.id} className="py-3 first:pt-1 last:pb-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {m.titulo}
                      </h3>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                        {m.prioridad} · {m.estado}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {m.siguiente || m.objetivo || 'Sin próxima acción definida'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tareas prioritarias rápidas */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Tareas prioritarias
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('misiones')}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
              >
                Matriz completa
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!quickTask.trim()) return;
                onQuickAddTask(quickTask.trim());
                setQuickTask('');
              }}
              className="mt-3 flex gap-2"
            >
              <input
                type="text"
                value={quickTask}
                onChange={(e) => setQuickTask(e.target.value)}
                placeholder="Añadir tarea rápida..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3.5 py-2 min-h-[40px] text-xs font-semibold hover:opacity-90 whitespace-nowrap shrink-0"
              >
                Añadir
              </button>
            </form>

            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {tasks.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggleTask(t.id)}
                  className="w-full py-2.5 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-md px-1 transition-colors"
                >
                  {t.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  )}
                  <span
                    className={`text-sm flex-1 min-w-0 truncate ${
                      t.done
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {t.titulo}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0 capitalize">
                    {t.quadrant}
                  </span>
                </button>
              ))}
              {tasks.length === 0 && (
                <p className="py-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                  Sin tareas registradas.
                </p>
              )}
            </div>
          </section>

          {/* Accesos rápidos: Voz, Llamada y CLI */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Entrada rápida y consola
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onOpenVoice}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2.5 min-h-[44px] text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Comando de voz</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('terminal')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 px-3.5 py-2.5 min-h-[44px] text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Terminal className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Abrir CLI</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label
                htmlFor="quick-phone-input"
                className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Llamada rápida (dispositivo móvil)
              </label>
              <div className="flex gap-2">
                <input
                  id="quick-phone-input"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="600 123 456"
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                />
                {phoneNumber.replace(/[^\d+]/g, '') ? (
                  <a
                    href={`tel:${phoneNumber.replace(/[^\d+]/g, '')}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 px-3.5 py-2 min-h-[40px] text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Llamar</span>
                  </a>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400 px-3.5 py-2 min-h-[40px] text-xs font-medium whitespace-nowrap shrink-0">
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Llamar</span>
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
