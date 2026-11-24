import React, { useState } from 'react';
import { Plus, Copy, Edit3, Trash2, Search, Shield } from 'lucide-react';
import type { MemoryItem, MemoryType } from '../types/horizonte';
import { Modal } from '../components/Modal';
import { ModuleExportImportBar } from '../components/ModuleExportImportBar';
import {
  downloadTextFile,
  exportPartialTxt,
  exportSectionJson,
} from '../utils/txtParser';

interface MemoriaViewProps {
  memoria: MemoryItem[];
  onSaveMemoria: (m: MemoryItem) => void;
  onDeleteMemoria: (id: string) => void;
  onImportData: (rawText: string, fileName: string, mode: 'merge' | 'replace') => void;
  onNotify: (msg: string, kind?: 'ok' | 'warn' | 'info') => void;
}

const MEMORY_TYPES: MemoryType[] = [
  'Preferencia',
  'Decisión',
  'Dato',
  'Proyecto',
  'Hecho verificado',
  'Contexto de proyecto',
  'Suposición',
  'Aprendizaje',
  'Gasto',
  'Idea',
];

export const MemoriaView: React.FC<MemoriaViewProps> = ({
  memoria,
  onSaveMemoria,
  onDeleteMemoria,
  onImportData,
  onNotify,
}) => {
  const [query, setQuery] = useState('');
  const [filterScope, setFilterScope] = useState<'todas' | 'permanente' | 'proyecto'>('todas');
  const [editItem, setEditItem] = useState<MemoryItem | null>(null);

  const filtered = memoria.filter((m) => {
    if (filterScope === 'permanente' && !m.permanente) return false;
    if (filterScope === 'proyecto' && m.permanente) return false;
    if (!query.trim()) return true;
    return `${m.titulo} ${m.contenido} ${m.tipo}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });

  const copyPermanentTxt = async () => {
    const perms = memoria.filter((m) => m.permanente);
    const body = [
      'HORIZONTE OS — MEMORIA PERMANENTE',
      `Fecha de exportación: ${new Date().toLocaleDateString('es-ES')}`,
      '',
      ...perms.map((m) => `${m.titulo.toUpperCase()}\n${m.contenido}\n`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(body);
      onNotify('Memoria Permanente copiada en formato TXT.');
    } catch {
      onNotify('No se pudo copiar al portapapeles.', 'warn');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 self-start">
          {[
            { key: 'todas', label: `Todas (${memoria.length})` },
            {
              key: 'permanente',
              label: `Permanente (${memoria.filter((m) => m.permanente).length})`,
            },
            {
              key: 'proyecto',
              label: `Notas y proyectos (${memoria.filter((m) => !m.permanente).length})`,
            },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilterScope(t.key as typeof filterScope)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                filterScope === t.key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ModuleExportImportBar
            label="Memoria"
            onExportJson={() => {
              downloadTextFile(
                exportSectionJson('memoria', { memoria }),
                'horizonte-memoria.json',
                'application/json'
              );
              onNotify(`${memoria.length} registros de memoria exportados en JSON.`);
            }}
            onExportTxt={() => {
              downloadTextFile(
                exportPartialTxt({ title: 'Memoria', memoria }),
                'horizonte_memoria_txt1.txt'
              );
              onNotify(`${memoria.length} registros de memoria exportados en TXT-1.`);
            }}
            onImportFile={onImportData}
          />
          <button
            type="button"
            onClick={copyPermanentTxt}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 min-h-[38px] text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Copiar Permanente TXT</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setEditItem({
                id: '',
                titulo: '',
                contenido: '',
                tipo: 'Preferencia',
                confianza: 'Alta',
                permanente: false,
                fecha: new Date().toISOString(),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 min-h-[38px] text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Nueva memoria</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search
          className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar hechos, preferencias, decisiones o gastos..."
          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
          No hay registros de memoria para mostrar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {m.tipo} · Confianza {m.confianza}
                  </span>
                  {m.permanente && (
                    <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 font-semibold">
                      <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                      Permanente
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {m.titulo}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {m.contenido}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {new Date(m.fecha).toLocaleDateString('es-ES')}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditItem({ ...m })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMemoria(m.id)}
                    aria-label={`Eliminar memoria ${m.titulo}`}
                    className="p-2 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editItem)}
        title={editItem?.id ? 'Editar memoria' : 'Nueva memoria'}
        onClose={() => setEditItem(null)}
      >
        {editItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editItem.titulo.trim()) return;
              onSaveMemoria({
                ...editItem,
                id: editItem.id || crypto.randomUUID(),
                titulo: editItem.titulo.trim(),
                fecha: new Date().toISOString(),
              });
              setEditItem(null);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Título *
              </label>
              <input
                required
                type="text"
                value={editItem.titulo}
                onChange={(e) => setEditItem({ ...editItem, titulo: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tipo
                </label>
                <select
                  value={editItem.tipo}
                  onChange={(e) =>
                    setEditItem({ ...editItem, tipo: e.target.value as MemoryType })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {MEMORY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Confianza
                </label>
                <select
                  value={editItem.confianza}
                  onChange={(e) =>
                    setEditItem({
                      ...editItem,
                      confianza: e.target.value as MemoryItem['confianza'],
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(editItem.permanente)}
                onChange={(e) =>
                  setEditItem({ ...editItem, permanente: e.target.checked })
                }
                className="rounded border-slate-300"
              />
              Incluir en bloque de Memoria Permanente TXT
            </label>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Contenido *
              </label>
              <textarea
                required
                rows={5}
                value={editItem.contenido}
                onChange={(e) => setEditItem({ ...editItem, contenido: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 text-sm font-semibold"
              >
                Guardar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
