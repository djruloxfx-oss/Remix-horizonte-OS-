import React, { useState } from 'react';
import {
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Cloud,
  Palette,
} from 'lucide-react';
import { INTERFACE_VARIANTS } from '../data/seedData';
import type {
  HorizonteState,
  InterfaceVariant,
  SuperAgentMode,
} from '../types/horizonte';
import { runDryRunDiagnostic } from '../utils/txtParser';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface AjustesViewProps {
  state: HorizonteState;
  onUpdateProfile: (nombre: string, objetivo: string, modo: SuperAgentMode) => void;
  onToggleTheme: () => void;
  onChangeInterfaceVariant: (variant: InterfaceVariant) => void;
  onToggleAlarm: () => void;
  onExportJson: () => void;
  onExportTxt: () => void;
  onImportFile: (text: string, fileName: string, mode: 'merge' | 'replace') => void;
  onOpenWorkspace: () => void;
  onResetDefaults: () => void;
}

export const AjustesView: React.FC<AjustesViewProps> = ({
  state,
  onUpdateProfile,
  onToggleTheme,
  onChangeInterfaceVariant,
  onToggleAlarm,
  onExportJson,
  onExportTxt,
  onImportFile,
  onOpenWorkspace,
  onResetDefaults,
}) => {
  const [nombre, setNombre] = useState(state.perfil.nombre);
  const [objetivo, setObjetivo] = useState(state.perfil.objetivo);
  const [modo, setModo] = useState<SuperAgentMode>(state.perfil.superAgenteModo);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [dryRunResult, setDryRunResult] = useState<ReturnType<typeof runDryRunDiagnostic> | null>(
    null
  );
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left column: Profile & Preferences */}
      <div className="lg:col-span-6 space-y-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Perfil del sistema y Súper Agente
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateProfile(nombre.trim() || 'Horizonte OS', objetivo.trim(), modo);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Nombre del entorno
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Objetivo principal
              </label>
              <textarea
                rows={2}
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Modo Súper Agente por defecto
              </label>
              <select
                value={modo}
                onChange={(e) => setModo(e.target.value as SuperAgentMode)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="modo1">Modo 1 — Diseña y propone</option>
                <option value="modo2">Modo 2 — Crea con aprobación</option>
                <option value="modo3">Modo 3 — Crea y coordina automáticamente</option>
              </select>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 min-h-[40px] text-xs font-semibold"
            >
              Guardar perfil
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Apariencia, alarmas e instalación PWA
          </h2>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Tema visual
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Alterna entre modo claro y oscuro (también desde CLI con `theme`).
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                {state.ajustes.theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4" />
                    <span>Modo claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    <span>Modo oscuro</span>
                  </>
                )}
              </button>
            </div>

            <div className="py-3 space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Selector de interfaz (5 estilos visuales)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Cambia al instante tipografía, paleta de acento, superficies y geometría. Compatible con modo claro y oscuro.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {INTERFACE_VARIANTS.map((variant) => {
                  const selected =
                    (state.ajustes.interfaceVariant || 'swiss') === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => onChangeInterfaceVariant(variant.id)}
                      className={`text-left rounded-lg border p-3 transition-all ${
                        selected
                          ? 'border-sky-600 ring-1 ring-sky-600/30 bg-sky-50/50 dark:bg-sky-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0 border border-black/10"
                            style={{ backgroundColor: variant.accentHex }}
                            aria-hidden="true"
                          />
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {variant.nombre}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
                          {selected ? 'Activa' : variant.badge}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {variant.subtitulo}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {variant.descripcion}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Alarma sonora Pomodoro
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Aviso acústico local al terminar un bloque de trabajo o descanso.
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleAlarm}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                {state.ajustes.alarma ? (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    <span>Activa</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-slate-400" />
                    <span>Silenciada</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Aplicación instalable (PWA)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Funciona offline en tu dispositivo sin cuentas ni servidores externos.
                </div>
              </div>
              <PWAInstallButton />
            </div>
          </div>
        </section>
      </div>

      {/* Right column: Backups & Dryrun */}
      <div className="lg:col-span-6 space-y-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Copias de seguridad (JSON v19.4 / v12 y TXT-1 v18.4 / v18.6)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Todos tus datos viven exclusivamente en tu dispositivo. Exporta copias periódicas para mantener control total.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onExportJson}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 min-h-[42px] text-xs font-semibold hover:opacity-90"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Exportar copia JSON</span>
            </button>

            <button
              type="button"
              onClick={onExportTxt}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2.5 min-h-[42px] text-xs font-semibold"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Exportar backup TXT-1</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenWorkspace}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50/60 dark:bg-sky-950/30 hover:bg-sky-100/70 dark:hover:bg-sky-950/50 text-sky-700 dark:text-sky-300 px-4 py-2.5 min-h-[40px] text-xs font-semibold transition-colors"
          >
            <Cloud className="w-4 h-4" aria-hidden="true" />
            <span>Abrir Google Workspace (Drive, Docs, Sheets, Slides)</span>
          </button>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Importar archivo (.json o .txt)
              </label>
              <div className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`px-2.5 py-1 rounded ${
                    importMode === 'merge'
                      ? 'bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-slate-100'
                      : 'text-slate-500'
                  }`}
                >
                  Fusionar
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`px-2.5 py-1 rounded ${
                    importMode === 'replace'
                      ? 'bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-slate-100'
                      : 'text-slate-500'
                  }`}
                >
                  Reemplazar
                </button>
              </div>
            </div>

            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-5 cursor-pointer hover:border-sky-500 transition-colors">
              <Upload className="w-5 h-5 text-slate-500" aria-hidden="true" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Seleccionar archivo .json o .txt compatible
              </span>
              <input
                type="file"
                accept=".json,.txt"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const txt = await file.text();
                  onImportFile(txt, file.name, importMode);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Autodiagnóstico local (dryrun)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comprueba integridad del almacenamiento, módulos y motor GEMA/Pomodoro.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDryRunResult(runDryRunDiagnostic(state))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Ejecutar dryrun
            </button>
          </div>

          {dryRunResult && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 px-3.5">
              {dryRunResult.checks.map((c) => (
                <div key={c.label} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    {c.pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {c.label}
                    </span>
                  </div>
                  <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {c.detail}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Restaurar datos iniciales de fábrica
            </span>
            {confirmReset ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetDefaults();
                    setConfirmReset(false);
                  }}
                  className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-semibold"
                >
                  Confirmar restauración
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restaurar base</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
