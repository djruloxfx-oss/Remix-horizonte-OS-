import React, { useState } from 'react';
import {
  Copy,
  ExternalLink,
  Plus,
  Edit3,
  Trash2,
  Upload,
  Check,
  Search,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AI_PROVIDERS } from '../data/seedData';
import type {
  AIProviderKey,
  MemoryItem,
  Mission,
  PromptItem,
  SkillItem,
  TemplateItem,
} from '../types/horizonte';
import { Modal } from '../components/Modal';

interface BibliotecaViewProps {
  plantillas: TemplateItem[];
  skills: SkillItem[];
  prompts: PromptItem[];
  memoria: MemoryItem[];
  onSavePlantilla: (p: TemplateItem) => void;
  onDeletePlantilla: (id: string) => void;
  onCreateMissionFromTemplate: (m: Mission) => void;
  onSaveSkill: (s: SkillItem) => void;
  onDeleteSkill: (id: string) => void;
  onToggleSkill: (id: string) => void;
  onSavePrompt: (p: PromptItem) => void;
  onDeletePrompt: (id: string) => void;
  onTogglePrompt: (id: string) => void;
  onImportTxtOrJson: (rawText: string, fileName: string) => void;
  onNotify: (msg: string, kind?: 'ok' | 'warn' | 'info') => void;
}

export const BibliotecaView: React.FC<BibliotecaViewProps> = ({
  plantillas,
  skills,
  prompts,
  memoria,
  onSavePlantilla,
  onDeletePlantilla,
  onCreateMissionFromTemplate,
  onSaveSkill,
  onDeleteSkill,
  onToggleSkill,
  onSavePrompt,
  onDeletePrompt,
  onTogglePrompt,
  onImportTxtOrJson,
  onNotify,
}) => {
  const [sub, setSub] = useState<'prompts' | 'skills' | 'plantillas'>('prompts');
  const [iaFilter, setIaFilter] = useState<'todos' | AIProviderKey>('todos');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals
  const [editPrompt, setEditPrompt] = useState<PromptItem | null>(null);
  const [editSkill, setEditSkill] = useState<SkillItem | null>(null);
  const [editPlantilla, setEditPlantilla] = useState<TemplateItem | null>(null);
  const [useTemplateTarget, setUseTemplateTarget] = useState<TemplateItem | null>(null);
  const [useTemplateValues, setUseTemplateValues] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteIa, setPasteIa] = useState<AIProviderKey>('general');
  const [pasteContent, setPasteContent] = useState('');

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(`${label} copiado al portapapeles.`);
    } catch {
      onNotify('No se pudo acceder al portapapeles.', 'warn');
    }
  };

  const copyActiveBundle = async () => {
    const activePrompts = prompts.filter((p) => p.activa);
    const activeSkills = skills.filter((s) => s.activa);
    const permanentMemories = memoria.filter((m) => m.permanente);

    const blocks: string[] = ['ACTIVA HORIZONTE OS · PACK DE CONTEXTO\n'];
    if (permanentMemories.length > 0) {
      blocks.push('=== MEMORIA PERMANENTE ===');
      permanentMemories.forEach((m) => {
        blocks.push(`## ${m.titulo}\n${m.contenido}\n`);
      });
    }
    if (activePrompts.length > 0) {
      blocks.push('=== PROMPTS ACTIVOS ===');
      activePrompts.forEach((p) => {
        blocks.push(`## PROMPT: ${p.titulo}\n${p.contenido}\n`);
      });
    }
    if (activeSkills.length > 0) {
      blocks.push('=== SKILLS ACTIVAS ===');
      activeSkills.forEach((s) => {
        blocks.push(`## SKILL: ${s.titulo}\n${s.contenido}\n`);
      });
    }

    if (activePrompts.length === 0 && activeSkills.length === 0 && permanentMemories.length === 0) {
      onNotify('Activa al menos un Prompt o Skill antes de copiar el pack.', 'warn');
      return;
    }

    await copyText(blocks.join('\n'), 'Pack de instrucciones activas');
  };

  const filterList = <T extends { titulo: string; contenido: string; ia?: AIProviderKey }>(
    items: T[]
  ) => {
    return items.filter((item) => {
      const matchesIA = iaFilter === 'todos' || (item.ia || 'general') === iaFilter;
      const matchesQ =
        !query.trim() ||
        `${item.titulo} ${item.contenido}`.toLowerCase().includes(query.toLowerCase());
      return matchesIA && matchesQ;
    });
  };

  const filteredPrompts = filterList(prompts);
  const filteredSkills = filterList(skills);
  const filteredPlantillas = plantillas.filter(
    (p) =>
      !query.trim() ||
      `${p.titulo} ${p.categoria || ''} ${p.objetivo || ''} ${p.contenido}`
        .toLowerCase()
        .includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 self-start">
          <button
            type="button"
            onClick={() => setSub('prompts')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              sub === 'prompts'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Prompts ({prompts.length})
          </button>
          <button
            type="button"
            onClick={() => setSub('skills')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              sub === 'skills'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Skills ({skills.length})
          </button>
          <button
            type="button"
            onClick={() => setSub('plantillas')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              sub === 'plantillas'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Plantillas ({plantillas.length})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={copyActiveBundle}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 px-3.5 py-2 min-h-[40px] text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Copiar pack activo</span>
          </button>

          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 px-3.5 py-2 min-h-[40px] text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Importar TXT / JSON</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (sub === 'prompts') {
                setEditPrompt({
                  id: '',
                  titulo: '',
                  ia: 'general',
                  contenido: '',
                  activa: false,
                });
              } else if (sub === 'skills') {
                setEditSkill({
                  id: '',
                  titulo: '',
                  ia: 'general',
                  contenido: '',
                  activa: false,
                });
              } else {
                setEditPlantilla({
                  id: '',
                  titulo: '',
                  categoria: 'Productividad',
                  prioridad: 'Media',
                  objetivo: '',
                  resultado: '',
                  pasos: '',
                  variables: '',
                  contenido: '',
                });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 min-h-[40px] text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>
              {sub === 'prompts'
                ? 'Nuevo prompt'
                : sub === 'skills'
                  ? 'Nueva skill'
                  : 'Nueva plantilla'}
            </span>
          </button>
        </div>
      </div>

      {/* Search + AI Folders */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en la biblioteca por título o contenido..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        </div>

        {sub !== 'plantillas' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['todos', ...Object.keys(AI_PROVIDERS)] as ('todos' | AIProviderKey)[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setIaFilter(k)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                  iaFilter === k
                    ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {k === 'todos' ? 'Todas las IA' : AI_PROVIDERS[k].nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content lists */}
      {sub === 'prompts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPrompts.map((p) => {
            const provider = AI_PROVIDERS[p.ia || 'general'];
            const expanded = expandedId === p.id;
            return (
              <article
                key={p.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {provider.nombre} ·{' '}
                      <span
                        className={
                          p.activa
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {p.activa ? 'Activo en pack' : 'Inactivo'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onTogglePrompt(p.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                        p.activa
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {p.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {p.titulo}
                  </h3>

                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {expanded ? p.contenido : p.contenido.slice(0, 260) + (p.contenido.length > 260 ? '…' : '')}
                  </pre>

                  {p.ficha && expanded && (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {p.ficha}
                    </div>
                  )}

                  {(p.contenido.length > 260 || p.ficha) && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : p.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      {expanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Ver menos</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Ver completo {p.ficha ? 'y ficha informativa' : ''}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(p.contenido, 'Prompt')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 min-h-[36px] text-xs font-semibold hover:opacity-90"
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Copiar</span>
                    </button>
                    {provider.url !== '#' && (
                      <a
                        href={provider.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => copyText(p.contenido, 'Prompt')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Abrir {provider.nombre}</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditPrompt({ ...p })}
                      aria-label="Editar prompt"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePrompt(p.id)}
                      aria-label="Eliminar prompt"
                      className="p-2 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {filteredPrompts.length === 0 && (
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
              No hay prompts en esta carpeta.
            </div>
          )}
        </div>
      )}

      {sub === 'skills' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSkills.map((s) => {
            const provider = AI_PROVIDERS[s.ia || 'general'];
            const expanded = expandedId === s.id;
            return (
              <article
                key={s.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {provider.nombre} ·{' '}
                      <span
                        className={
                          s.activa
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {s.activa ? 'Activa en pack' : 'Inactiva'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleSkill(s.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                        s.activa
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {s.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {s.titulo}
                  </h3>

                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {expanded ? s.contenido : s.contenido.slice(0, 260) + (s.contenido.length > 260 ? '…' : '')}
                  </pre>

                  {s.contenido.length > 260 && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      {expanded ? 'Ver menos' : 'Ver completa'}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => copyText(s.contenido, 'Skill')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 min-h-[36px] text-xs font-semibold hover:opacity-90"
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copiar</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditSkill({ ...s })}
                      aria-label="Editar skill"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSkill(s.id)}
                      aria-label="Eliminar skill"
                      className="p-2 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {sub === 'plantillas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlantillas.map((pl) => (
            <article
              key={pl.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {pl.categoria || 'General'} · Prioridad {pl.prioridad || 'Media'}
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {pl.titulo}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {pl.contenido}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setUseTemplateTarget(pl);
                    setUseTemplateValues('');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 min-h-[36px] text-xs font-semibold"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Crear misión</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditPlantilla({ ...pl })}
                    aria-label="Editar plantilla"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePlantilla(pl.id)}
                    aria-label="Eliminar plantilla"
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

      {/* Modal: Prompt */}
      <Modal
        open={Boolean(editPrompt)}
        title={editPrompt?.id ? 'Editar prompt' : 'Nuevo prompt'}
        onClose={() => setEditPrompt(null)}
        maxWidthClass="max-w-2xl"
      >
        {editPrompt && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editPrompt.titulo.trim()) return;
              onSavePrompt({
                ...editPrompt,
                id: editPrompt.id || crypto.randomUUID(),
                titulo: editPrompt.titulo.trim(),
              });
              setEditPrompt(null);
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
                value={editPrompt.titulo}
                onChange={(e) => setEditPrompt({ ...editPrompt, titulo: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Optimizado para
              </label>
              <select
                value={editPrompt.ia}
                onChange={(e) =>
                  setEditPrompt({ ...editPrompt, ia: e.target.value as AIProviderKey })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {Object.entries(AI_PROVIDERS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Instrucciones del prompt *
              </label>
              <textarea
                required
                rows={8}
                value={editPrompt.contenido}
                onChange={(e) => setEditPrompt({ ...editPrompt, contenido: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditPrompt(null)}
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

      {/* Modal: Skill */}
      <Modal
        open={Boolean(editSkill)}
        title={editSkill?.id ? 'Editar skill' : 'Nueva skill'}
        onClose={() => setEditSkill(null)}
        maxWidthClass="max-w-2xl"
      >
        {editSkill && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editSkill.titulo.trim()) return;
              onSaveSkill({
                ...editSkill,
                id: editSkill.id || crypto.randomUUID(),
                titulo: editSkill.titulo.trim(),
              });
              setEditSkill(null);
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
                value={editSkill.titulo}
                onChange={(e) => setEditSkill({ ...editSkill, titulo: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Optimizado para
              </label>
              <select
                value={editSkill.ia}
                onChange={(e) =>
                  setEditSkill({ ...editSkill, ia: e.target.value as AIProviderKey })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {Object.entries(AI_PROVIDERS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Contenido *
              </label>
              <textarea
                required
                rows={8}
                value={editSkill.contenido}
                onChange={(e) => setEditSkill({ ...editSkill, contenido: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditSkill(null)}
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

      {/* Modal: Plantilla */}
      <Modal
        open={Boolean(editPlantilla)}
        title={editPlantilla?.id ? 'Editar plantilla' : 'Nueva plantilla'}
        onClose={() => setEditPlantilla(null)}
      >
        {editPlantilla && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editPlantilla.titulo.trim()) return;
              onSavePlantilla({
                ...editPlantilla,
                id: editPlantilla.id || crypto.randomUUID(),
                titulo: editPlantilla.titulo.trim(),
              });
              setEditPlantilla(null);
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
                value={editPlantilla.titulo}
                onChange={(e) =>
                  setEditPlantilla({ ...editPlantilla, titulo: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Categoría
                </label>
                <input
                  type="text"
                  value={editPlantilla.categoria || ''}
                  onChange={(e) =>
                    setEditPlantilla({ ...editPlantilla, categoria: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Variables
                </label>
                <input
                  type="text"
                  value={editPlantilla.variables}
                  onChange={(e) =>
                    setEditPlantilla({ ...editPlantilla, variables: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Contenido / Pasos *
              </label>
              <textarea
                required
                rows={5}
                value={editPlantilla.contenido}
                onChange={(e) =>
                  setEditPlantilla({ ...editPlantilla, contenido: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditPlantilla(null)}
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

      {/* Modal: Usar Plantilla */}
      <Modal
        open={Boolean(useTemplateTarget)}
        title={`Crear misión desde: ${useTemplateTarget?.titulo || ''}`}
        onClose={() => setUseTemplateTarget(null)}
      >
        {useTemplateTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCreateMissionFromTemplate({
                id: crypto.randomUUID(),
                titulo: useTemplateTarget.titulo,
                categoria: useTemplateTarget.categoria || 'General',
                objetivo: useTemplateValues.trim() || useTemplateTarget.objetivo || useTemplateTarget.contenido,
                resultado: useTemplateTarget.resultado || '',
                contexto: '',
                restricciones: '',
                criterios: useTemplateTarget.criterioExito || '',
                prioridad: (useTemplateTarget.prioridad as Mission['prioridad']) || 'Importante',
                estado: 'Nueva',
                planA: '',
                planB: '',
                riesgo: '',
                siguiente: useTemplateTarget.proximaAccion || 'Ejecutar primer paso',
                pasos: useTemplateTarget.pasos
                  ? useTemplateTarget.pasos
                      .split(/[;\n]+/)
                      .map((x) => x.trim())
                      .filter(Boolean)
                  : [],
                actualizada: new Date().toISOString(),
              });
              setUseTemplateTarget(null);
            }}
            className="space-y-4"
          >
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Variables sugeridas: {useTemplateTarget.variables || 'Objetivo específico'}
            </p>
            <textarea
              rows={4}
              value={useTemplateValues}
              onChange={(e) => setUseTemplateValues(e.target.value)}
              placeholder={useTemplateTarget.contenido}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUseTemplateTarget(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 text-sm font-semibold"
              >
                Crear misión
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Importar archivo TXT-1 / JSON o pegar texto */}
      <Modal
        open={importOpen}
        title="Importar TXT-1, JSON o texto pegado"
        onClose={() => setImportOpen(false)}
      >
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Opción 1: Subir archivo (.txt v18.4/v18.6 o .json)
            </label>
            <input
              type="file"
              accept=".txt,.md,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                onImportTxtOrJson(text, file.name);
                setImportOpen(false);
              }}
              className="w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm"
            />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pasteTitle.trim() || !pasteContent.trim()) return;
              if (sub === 'skills') {
                onSaveSkill({
                  id: crypto.randomUUID(),
                  titulo: pasteTitle.trim(),
                  ia: pasteIa,
                  contenido: pasteContent.trim(),
                  activa: false,
                });
              } else {
                onSavePrompt({
                  id: crypto.randomUUID(),
                  titulo: pasteTitle.trim(),
                  ia: pasteIa,
                  contenido: pasteContent.trim(),
                  activa: false,
                });
              }
              setPasteTitle('');
              setPasteContent('');
              setImportOpen(false);
            }}
            className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800"
          >
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Opción 2: Pegar texto directamente como {sub === 'skills' ? 'Skill' : 'Prompt'}
            </div>
            <input
              type="text"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="Título"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            />
            <select
              value={pasteIa}
              onChange={(e) => setPasteIa(e.target.value as AIProviderKey)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            >
              {Object.entries(AI_PROVIDERS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.nombre}
                </option>
              ))}
            </select>
            <textarea
              rows={4}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Pega aquí las instrucciones..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-semibold"
              >
                Guardar texto pegado
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};
