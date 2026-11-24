import React, { useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Phone,
  CheckCircle2,
  Circle,
  Search,
} from 'lucide-react';
import type {
  EisenhowerQuadrant,
  Mission,
  MissionPriority,
  MissionStatus,
  TaskItem,
} from '../types/horizonte';
import { Modal } from '../components/Modal';

interface MisionesViewProps {
  missions: Mission[];
  tasks: TaskItem[];
  onSaveMission: (mission: Mission) => void;
  onDeleteMission: (id: string) => void;
  onSaveTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'done'>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onClearDoneTasks: () => void;
  triggerNewMissionModal?: boolean;
  onConsumeNewMissionModal?: () => void;
}

const PRIORITIES: MissionPriority[] = [
  'Imprescindible',
  'Alta',
  'Importante',
  'Media',
  'Conveniente',
  'Prescindible',
];

const STATUSES: MissionStatus[] = [
  'Nueva',
  'Analizando',
  'Ejecutando',
  'Verificando',
  'Activa',
  'En riesgo',
  'Bloqueada',
  'Pausada',
  'Completada',
  'Cancelada',
];

const QUADRANTS: { key: EisenhowerQuadrant; label: string; hint: string }[] = [
  { key: 'hacer', label: 'Hacer ahora', hint: 'Urgente e importante' },
  { key: 'planificar', label: 'Planificar', hint: 'Importante, no urgente' },
  { key: 'delegar', label: 'Delegar / Automatizar', hint: 'Urgente, menor impacto' },
  { key: 'eliminar', label: 'Posponer / Eliminar', hint: 'Baja prioridad' },
];

function statusTone(estado: MissionStatus): string {
  if (estado === 'Completada') return 'text-emerald-700 dark:text-emerald-400';
  if (estado === 'En riesgo' || estado === 'Bloqueada') return 'text-red-700 dark:text-red-400';
  if (estado === 'Ejecutando' || estado === 'Activa') return 'text-sky-700 dark:text-sky-400';
  return 'text-slate-600 dark:text-slate-400';
}

export const MisionesView: React.FC<MisionesViewProps> = ({
  missions,
  tasks,
  onSaveMission,
  onDeleteMission,
  onSaveTask,
  onToggleTask,
  onDeleteTask,
  onClearDoneTasks,
  triggerNewMissionModal,
  onConsumeNewMissionModal,
}) => {
  const [subtab, setSubtab] = useState<'misiones' | 'matriz'>('misiones');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('activas');

  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [missionModalOpen, setMissionModalOpen] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskQuadrant, setNewTaskQuadrant] = useState<EisenhowerQuadrant>('hacer');
  const [newTaskEnergy, setNewTaskEnergy] = useState<'bajo' | 'medio' | 'alto'>('medio');
  const [newTaskMissionId, setNewTaskMissionId] = useState<string>('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  React.useEffect(() => {
    if (triggerNewMissionModal) {
      openMissionEditor();
      onConsumeNewMissionModal?.();
    }
  }, [triggerNewMissionModal]);

  const openMissionEditor = (m?: Mission) => {
    setEditingMission(
      m
        ? { ...m }
        : {
            id: '',
            titulo: '',
            categoria: 'General',
            objetivo: '',
            resultado: '',
            contexto: '',
            restricciones: '',
            criterios: '',
            prioridad: 'Importante',
            estado: 'Nueva',
            planA: '',
            planB: '',
            riesgo: '',
            siguiente: '',
            pasos: [],
            telefono: '',
            actualizada: new Date().toISOString(),
          }
    );
    setMissionModalOpen(true);
  };

  const filteredMissions = missions.filter((m) => {
    const matchesQ =
      !query.trim() ||
      `${m.titulo} ${m.objetivo} ${m.siguiente} ${m.categoria || ''}`
        .toLowerCase()
        .includes(query.toLowerCase());
    if (!matchesQ) return false;
    if (statusFilter === 'activas') return !['Completada', 'Cancelada'].includes(m.estado);
    if (statusFilter === 'riesgo') return ['En riesgo', 'Bloqueada'].includes(m.estado);
    if (statusFilter === 'completadas') return m.estado === 'Completada';
    return true;
  });

  const handleSubmitMission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMission || !editingMission.titulo.trim()) return;
    onSaveMission({
      ...editingMission,
      id: editingMission.id || crypto.randomUUID(),
      titulo: editingMission.titulo.trim(),
      actualizada: new Date().toISOString(),
    });
    setMissionModalOpen(false);
    setEditingMission(null);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onSaveTask({
      titulo: newTaskTitle.trim(),
      quadrant: newTaskQuadrant,
      energyCost: newTaskEnergy,
      missionId: newTaskMissionId || undefined,
    });
    setNewTaskTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation & primary action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 self-start">
          <button
            type="button"
            onClick={() => setSubtab('misiones')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              subtab === 'misiones'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Misiones ({missions.length})
          </button>
          <button
            type="button"
            onClick={() => setSubtab('matriz')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              subtab === 'matriz'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Matriz de tareas ({tasks.filter((t) => !t.done).length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => openMissionEditor()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 min-h-[42px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Nueva misión</span>
        </button>
      </div>

      {subtab === 'misiones' ? (
        <div className="space-y-4">
          {/* Search & filter bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar misiones por título, objetivo o próxima acción..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>

            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto">
              {[
                { key: 'activas', label: 'Activas' },
                { key: 'riesgo', label: 'En riesgo' },
                { key: 'completadas', label: 'Completadas' },
                { key: 'todas', label: 'Todas' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === f.key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredMissions.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No hay misiones que coincidan con este filtro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMissions.map((m) => (
                <article
                  key={m.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold ${statusTone(m.estado)}`}>{m.estado}</span>
                      <span aria-hidden="true">·</span>
                      <span>Prioridad {m.prioridad}</span>
                      {m.categoria && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{m.categoria}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {m.titulo}
                    </h3>

                    {m.objetivo && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {m.objetivo}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {m.siguiente && (
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Próxima acción:{' '}
                          </span>
                          {m.siguiente}
                        </div>
                      )}
                      {m.planA && (
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Plan A:{' '}
                          </span>
                          {m.planA}
                        </div>
                      )}
                      {m.planB && (
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Plan B:{' '}
                          </span>
                          {m.planB}
                        </div>
                      )}
                      {m.riesgo && (
                        <div>
                          <span className="font-semibold text-red-700 dark:text-red-400">
                            Riesgo:{' '}
                          </span>
                          {m.riesgo}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      {m.telefono && (
                        <a
                          href={`tel:${m.telefono.replace(/[^\d+]/g, '')}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Llamar</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openMissionEditor(m)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Editar</span>
                      </button>

                      {confirmDeleteId === m.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteMission(m.id);
                            setConfirmDeleteId(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 min-h-[36px] text-xs font-semibold"
                        >
                          Confirmar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(m.id)}
                          aria-label={`Eliminar misión ${m.titulo}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/60 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Add task form */}
          <form
            onSubmit={handleAddTask}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Nueva tarea
              </label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Ej. Comprobar 3 fichas al azar en rfef.es"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Cuadrante
              </label>
              <select
                value={newTaskQuadrant}
                onChange={(e) => setNewTaskQuadrant(e.target.value as EisenhowerQuadrant)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                {QUADRANTS.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Coste GEMA
              </label>
              <select
                value={newTaskEnergy}
                onChange={(e) => setNewTaskEnergy(e.target.value as 'bajo' | 'medio' | 'alto')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 min-h-[40px] text-xs font-semibold"
              >
                Añadir
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Matriz de Eisenhower integrada con el medidor GEMA y comandos CLI (`task add/done/clear`).
            </p>
            {tasks.some((t) => t.done) && (
              <button
                type="button"
                onClick={onClearDoneTasks}
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline whitespace-nowrap"
              >
                Limpiar completadas
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {QUADRANTS.map((q) => {
              const qTasks = tasks.filter((t) => t.quadrant === q.key);
              return (
                <section
                  key={q.key}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {q.label}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{q.hint}</p>
                    </div>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {qTasks.filter((t) => !t.done).length} pend.
                    </span>
                  </div>

                  <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                    {qTasks.length === 0 ? (
                      <p className="py-5 text-xs text-slate-400 text-center">
                        Sin tareas en este cuadrante.
                      </p>
                    ) : (
                      qTasks.map((t) => (
                        <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleTask(t.id)}
                            className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                          >
                            {t.done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span
                              className={`text-sm truncate ${
                                t.done
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {t.titulo}
                            </span>
                          </button>

                          <span className="text-[11px] text-slate-400 shrink-0">
                            {t.energyCost}
                          </span>

                          <button
                            type="button"
                            onClick={() => onDeleteTask(t.id)}
                            aria-label="Eliminar tarea"
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* Mission Edit/Create Modal */}
      <Modal
        open={missionModalOpen}
        title={editingMission?.id ? 'Editar misión' : 'Nueva misión'}
        onClose={() => setMissionModalOpen(false)}
        maxWidthClass="max-w-2xl"
      >
        {editingMission && (
          <form onSubmit={handleSubmitMission} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Título *
                </label>
                <input
                  required
                  type="text"
                  value={editingMission.titulo}
                  onChange={(e) =>
                    setEditingMission({ ...editingMission, titulo: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Prioridad
                </label>
                <select
                  value={editingMission.prioridad}
                  onChange={(e) =>
                    setEditingMission({
                      ...editingMission,
                      prioridad: e.target.value as MissionPriority,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Estado
                </label>
                <select
                  value={editingMission.estado}
                  onChange={(e) =>
                    setEditingMission({
                      ...editingMission,
                      estado: e.target.value as MissionStatus,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Objetivo
              </label>
              <textarea
                rows={2}
                value={editingMission.objetivo}
                onChange={(e) =>
                  setEditingMission({ ...editingMission, objetivo: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Próxima acción
                </label>
                <input
                  type="text"
                  value={editingMission.siguiente}
                  onChange={(e) =>
                    setEditingMission({ ...editingMission, siguiente: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Teléfono de contacto (opcional)
                </label>
                <input
                  type="tel"
                  value={editingMission.telefono || ''}
                  onChange={(e) =>
                    setEditingMission({ ...editingMission, telefono: e.target.value })
                  }
                  placeholder="600 123 456"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Plan A
                </label>
                <textarea
                  rows={2}
                  value={editingMission.planA}
                  onChange={(e) =>
                    setEditingMission({ ...editingMission, planA: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Plan B
                </label>
                <textarea
                  rows={2}
                  value={editingMission.planB}
                  onChange={(e) =>
                    setEditingMission({ ...editingMission, planB: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Riesgos
                </label>
                <input
                  type="text"
                  value={editingMission.riesgo}
                  onChange={(e) =>
                    setEditingMission({ ...editingMission, riesgo: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Criterio de éxito
                </label>
                <input
                  type="text"
                  value={editingMission.criterios}
                  onChange={(e) =>
                    setEditingMission({ ...editingMission, criterios: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMissionModalOpen(false)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 text-sm font-semibold"
              >
                Guardar misión
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
