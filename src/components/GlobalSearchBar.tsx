import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Copy, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import type { AppTab, HorizonteState } from '../types/horizonte';
import { AI_PROVIDERS } from '../data/seedData';

type SearchCategory =
  | 'todos'
  | 'misiones'
  | 'tareas'
  | 'prompts'
  | 'skills'
  | 'plantillas'
  | 'agentes'
  | 'memoria';

interface SearchResultItem {
  id: string;
  category: Exclude<SearchCategory, 'todos'>;
  categoryLabel: string;
  title: string;
  snippet: string;
  meta: string;
  targetTab: AppTab;
  copyText?: string;
  done?: boolean;
}

interface GlobalSearchBarProps {
  state: HorizonteState;
  onNavigate: (tab: AppTab) => void;
  onToggleTask: (id: string) => void;
  onNotify: (msg: string, kind?: 'ok' | 'warn' | 'info') => void;
}

function matchesKeywords(haystack: string, keywords: string[]): boolean {
  const lower = haystack.toLowerCase();
  return keywords.every((kw) => lower.includes(kw));
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  state,
  onNavigate,
  onToggleTask,
  onNotify,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SearchCategory>('todos');
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      } else if (e.key === 'Escape' && focused) {
        setFocused(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const keywords = useMemo(
    () =>
      query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    [query]
  );

  const allResults = useMemo<SearchResultItem[]>(() => {
    if (keywords.length === 0) return [];

    const items: SearchResultItem[] = [];

    for (const m of state.misiones) {
      const text = `${m.titulo} ${m.objetivo} ${m.siguiente} ${m.planA} ${m.planB} ${m.categoria || ''} ${m.estado} ${m.prioridad}`;
      if (matchesKeywords(text, keywords)) {
        items.push({
          id: m.id,
          category: 'misiones',
          categoryLabel: 'Misión',
          title: m.titulo,
          snippet: m.siguiente || m.objetivo || 'Sin descripción',
          meta: `${m.estado} · Prioridad ${m.prioridad}`,
          targetTab: 'misiones',
        });
      }
    }

    for (const t of state.tareas) {
      const text = `${t.titulo} ${t.quadrant} ${t.energyCost}`;
      if (matchesKeywords(text, keywords)) {
        items.push({
          id: t.id,
          category: 'tareas',
          categoryLabel: 'Tarea',
          title: t.titulo,
          snippet: `Cuadrante ${t.quadrant} · Coste GEMA ${t.energyCost}`,
          meta: t.done ? 'Completada' : 'Pendiente',
          targetTab: 'misiones',
          done: t.done,
        });
      }
    }

    for (const p of state.prompts) {
      const text = `${p.titulo} ${p.contenido} ${p.ficha || ''} ${p.ia} ${AI_PROVIDERS[p.ia].nombre}`;
      if (matchesKeywords(text, keywords)) {
        items.push({
          id: p.id,
          category: 'prompts',
          categoryLabel: 'Prompt',
          title: p.titulo,
          snippet: p.contenido.slice(0, 140),
          meta: `${AI_PROVIDERS[p.ia].nombre} · ${p.activa ? 'Activo' : 'Inactivo'}`,
          targetTab: 'biblioteca',
          copyText: p.contenido,
        });
      }
    }

    for (const s of state.skills) {
      const text = `${s.titulo} ${s.contenido} ${s.ia} ${AI_PROVIDERS[s.ia].nombre}`;
      if (matchesKeywords(text, keywords)) {
        items.push({
          id: s.id,
          category: 'skills',
          categoryLabel: 'Skill',
          title: s.titulo,
          snippet: s.contenido.slice(0, 140),
          meta: `${AI_PROVIDERS[s.ia].nombre} · ${s.activa ? 'Activa' : 'Inactiva'}`,
          targetTab: 'biblioteca',
          copyText: s.contenido,
        });
      }
    }

    for (const pl of state.plantillas) {
      const text = `${pl.titulo} ${pl.categoria || ''} ${pl.objetivo || ''} ${pl.contenido} ${pl.variables}`;
      if (matchesKeywords(text, keywords)) {
        items.push({
          id: pl.id,
          category: 'plantillas',
          categoryLabel: 'Plantilla',
          title: pl.titulo,
          snippet: pl.objetivo || pl.contenido.slice(0, 140),
          meta: `${pl.categoria || 'General'} · Prioridad ${pl.prioridad || 'Media'}`,
          targetTab: 'biblioteca',
          copyText: pl.contenido,
        });
      }
    }

    for (const ag of state.agentes) {
      const text = `${ag.nombre} ${ag.categoria} ${ag.rol} ${ag.especialidades} ${ag.instrucciones}`;
      if (matchesKeywords(text, keywords)) {
        items.push({
          id: ag.id,
          category: 'agentes',
          categoryLabel: 'Agente',
          title: ag.nombre,
          snippet: `${ag.rol} — ${ag.instrucciones}`,
          meta: `${ag.categoria} · Fiabilidad ${ag.fiabilidad}%`,
          targetTab: 'agentes',
          copyText: `ROL: ${ag.nombre} (${ag.rol})\nINSTRUCCIONES:\n${ag.instrucciones}`,
        });
      }
    }

    for (const mem of state.memoria) {
      const text = `${mem.titulo} ${mem.contenido} ${mem.tipo} ${mem.proyecto || ''}`;
      if (matchesKeywords(text, keywords)) {
        items.push({
          id: mem.id,
          category: 'memoria',
          categoryLabel: 'Memoria',
          title: mem.titulo,
          snippet: mem.contenido.slice(0, 140),
          meta: `${mem.tipo} · Confianza ${mem.confianza}`,
          targetTab: 'memoria',
          copyText: mem.contenido,
        });
      }
    }

    return items;
  }, [keywords, state]);

  const filteredResults = useMemo(() => {
    if (categoryFilter === 'todos') return allResults;
    return allResults.filter((r) => r.category === categoryFilter);
  }, [allResults, categoryFilter]);

  const counts = useMemo(() => {
    const map: Record<SearchCategory, number> = {
      todos: allResults.length,
      misiones: 0,
      tareas: 0,
      prompts: 0,
      skills: 0,
      plantillas: 0,
      agentes: 0,
      memoria: 0,
    };
    allResults.forEach((r) => {
      map[r.category] += 1;
    });
    return map;
  }, [allResults]);

  const showPanel = focused && keywords.length > 0;

  return (
    <div ref={containerRef} className="relative mb-6">
      <div className="relative flex items-center">
        <Search
          className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setFocused(true);
          }}
          placeholder="Buscar en todo Horizonte OS por palabras clave (misiones, tareas, prompts, skills, agentes, memoria)…"
          aria-label="Buscador global de contenido"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-24 py-2.5 min-h-[44px] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategoryFilter('todos');
                inputRef.current?.focus();
              }}
              aria-label="Limpiar búsqueda"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {showPanel && (
        <div
          role="region"
          aria-label="Resultados de búsqueda"
          className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden"
        >
          {/* Category filter bar */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap bg-slate-50/70 dark:bg-slate-950/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  ['todos', 'Todos'],
                  ['misiones', 'Misiones'],
                  ['tareas', 'Tareas'],
                  ['prompts', 'Prompts'],
                  ['skills', 'Skills'],
                  ['plantillas', 'Plantillas'],
                  ['agentes', 'Agentes'],
                  ['memoria', 'Memoria'],
                ] as [SearchCategory, string][]
              ).map(([key, label]) => {
                if (key !== 'todos' && counts[key] === 0) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategoryFilter(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                      categoryFilter === key
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    {label} ({counts[key]})
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {filteredResults.length} resultado{filteredResults.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Results list */}
          {filteredResults.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No se encontraron coincidencias para <span className="font-semibold">"{query}"</span>.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
              {filteredResults.map((item) => (
                <div
                  key={`${item.category}-${item.id}`}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span className="font-semibold text-sky-700 dark:text-sky-400">
                        {item.categoryLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.meta}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                      {item.snippet}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.category === 'tareas' && (
                      <button
                        type="button"
                        onClick={() => onToggleTask(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {item.done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{item.done ? 'Reabrir' : 'Completar'}</span>
                      </button>
                    )}

                    {item.copyText && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(item.copyText!);
                            onNotify(`${item.categoryLabel} copiado al portapapeles.`);
                          } catch {
                            onNotify('No se pudo copiar al portapapeles.', 'warn');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copiar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(item.targetTab);
                        setFocused(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 text-xs font-semibold hover:opacity-90"
                    >
                      <span>Ir</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
