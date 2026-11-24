import React, { useCallback, useEffect, useState } from 'react';
import {
  Compass,
  Target,
  BookOpen,
  Bot,
  Database,
  Cloud,
  Terminal as TerminalIcon,
  Settings,
  Plus,
  Mic,
  Maximize2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { SEED_STATE, ALADIN_CHECKLIST_DEFAULT } from './data/seedData';
import type {
  AppTab,
  CliLogEntry,
  HorizonteState,
  MemoryItem,
  Mission,
  PromptItem,
  SkillItem,
  SuperAgentMode,
  TaskItem,
  TemplateItem,
  AgentItem,
} from './types/horizonte';
import {
  exportHorizonteJson,
  exportHorizonteTxt,
  migrateJsonState,
  parseHorizonteTxt,
  runDryRunDiagnostic,
} from './utils/txtParser';
import { playCompletionChime } from './utils/sound';
import { InicioView } from './views/InicioView';
import { MisionesView } from './views/MisionesView';
import { BibliotecaView } from './views/BibliotecaView';
import { AgentesView } from './views/AgentesView';
import { MemoriaView } from './views/MemoriaView';
import { TerminalView } from './views/TerminalView';
import { AjustesView } from './views/AjustesView';
import { WorkspaceView } from './views/WorkspaceView';
import { FocusOverlay } from './components/FocusOverlay';
import { VoiceDrawer } from './components/VoiceDrawer';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { GlobalSearchBar } from './components/GlobalSearchBar';
import {
  clearWorkspaceAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './lib/firebase';
import { syncAuthProfile } from './services/cloudSync';
import { ensureFirestoreUserProfile } from './services/firestoreSync';

const STORAGE_KEY = 'horizonte_os_v19_4_unified';
const LEGACY_V12_KEY = 'horizonte_os_v12';

function loadInitialState(): HorizonteState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const migrated = migrateJsonState(parsed);
      return {
        ...SEED_STATE,
        ...migrated,
        perfil: { ...SEED_STATE.perfil, ...(parsed.state?.perfil || parsed.perfil || {}) },
        ajustes: { ...SEED_STATE.ajustes, ...(parsed.state?.ajustes || parsed.ajustes || {}) },
        gema: { ...SEED_STATE.gema, ...(parsed.state?.gema || parsed.gema || {}) },
        pomodoro: {
          ...SEED_STATE.pomodoro,
          ...(parsed.state?.pomodoro || parsed.pomodoro || {}),
          running: false,
        },
        aladinChecklist:
          Array.isArray(parsed.state?.aladinChecklist || parsed.aladinChecklist)
            ? parsed.state?.aladinChecklist || parsed.aladinChecklist
            : ALADIN_CHECKLIST_DEFAULT,
      };
    }

    const legacyV12 = localStorage.getItem(LEGACY_V12_KEY);
    if (legacyV12) {
      const parsedLegacy = JSON.parse(legacyV12);
      const migrated = migrateJsonState(parsedLegacy);
      return {
        ...SEED_STATE,
        misiones:
          migrated.misiones && migrated.misiones.length > 0
            ? migrated.misiones
            : SEED_STATE.misiones,
        memoria:
          migrated.memoria && migrated.memoria.length > 0
            ? [...migrated.memoria, ...SEED_STATE.memoria]
            : SEED_STATE.memoria,
        plantillas:
          migrated.plantillas && migrated.plantillas.length > 0
            ? migrated.plantillas
            : SEED_STATE.plantillas,
        skills:
          migrated.skills && migrated.skills.length > 0
            ? [...migrated.skills, ...SEED_STATE.skills]
            : SEED_STATE.skills,
        prompts:
          migrated.prompts && migrated.prompts.length > 0
            ? [...migrated.prompts, ...SEED_STATE.prompts]
            : SEED_STATE.prompts,
      };
    }
  } catch {
    // Fallback to clean seed
  }
  return SEED_STATE;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function computeCognitiveLoad(energy: number): HorizonteState['gema']['cargaCognitiva'] {
  if (energy >= 70) return 'Baja';
  if (energy >= 45) return 'Moderada';
  if (energy >= 25) return 'Alta';
  return 'Sobrecarga';
}

const NAV_ITEMS: { id: AppTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'inicio', label: 'Inicio', shortLabel: 'Inicio', icon: Compass },
  { id: 'misiones', label: 'Misiones y Tareas', shortLabel: 'Misiones', icon: Target },
  { id: 'biblioteca', label: 'Biblioteca IA', shortLabel: 'Biblioteca', icon: BookOpen },
  { id: 'agentes', label: 'Agentes y Aladín', shortLabel: 'Agentes', icon: Bot },
  { id: 'memoria', label: 'Memoria', shortLabel: 'Memoria', icon: Database },
  { id: 'workspace', label: 'Google Workspace', shortLabel: 'Workspace', icon: Cloud },
  { id: 'terminal', label: 'Terminal CLI', shortLabel: 'CLI', icon: TerminalIcon },
  { id: 'ajustes', label: 'Ajustes y Backup', shortLabel: 'Ajustes', icon: Settings },
];

export default function App() {
  const [state, setState] = useState<HorizonteState>(loadInitialState);
  const [tab, setTab] = useState<AppTab>('inicio');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [openNewMissionFlag, setOpenNewMissionFlag] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [needsWorkspaceAuth, setNeedsWorkspaceAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [cliLogs, setCliLogs] = useState<CliLogEntry[]>([
    {
      id: 'init-1',
      type: 'out',
      text: 'Horizonte OS v19.4 · Kernel Local listo. Escribe "help" para ver los comandos disponibles.',
      ts: new Date().toISOString(),
    },
  ]);

  const notify = useCallback((text: string, kind: ToastMessage['kind'] = 'ok') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-3), { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  // Listen to Firebase Auth state (in-memory OAuth access token only)
  useEffect(() => {
    const unsubscribe = initAuth(({ user, accessToken, needsAuth }) => {
      setAuthUser(user);
      setWorkspaceToken(accessToken);
      setNeedsWorkspaceAuth(needsAuth);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    try {
      const { user, accessToken } = await googleSignIn();
      setAuthUser(user);
      setWorkspaceToken(accessToken);
      setNeedsWorkspaceAuth(false);
      try {
        await Promise.all([
          syncAuthProfile(),
          ensureFirestoreUserProfile(user, state.perfil.superAgenteModo),
        ]);
      } catch {
        // Non-blocking for Workspace UI
      }
      notify('Cuenta de Google conectada con Workspace y Firebase.');
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el inicio de sesión con Google.',
        'warn'
      );
    } finally {
      setIsSigningIn(false);
    }
  }, [notify, state.perfil.superAgenteModo]);

  const handleGoogleLogout = useCallback(async () => {
    await logout();
    setAuthUser(null);
    setWorkspaceToken(null);
    setNeedsWorkspaceAuth(true);
    notify('Sesión de Google cerrada.');
  }, [notify]);

  // Sync dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (state.ajustes.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state.ajustes.theme]);

  // Pomodoro 1s tick (React state isolated so inputs never lose focus)
  useEffect(() => {
    if (!state.pomodoro.running) return;
    const timer = window.setInterval(() => {
      setState((prev) => {
        if (!prev.pomodoro.running) return prev;
        if (prev.pomodoro.remainingSeconds <= 1) {
          if (prev.ajustes.alarma) {
            playCompletionChime();
          }
          const finishedWork = prev.pomodoro.mode === 'trabajo';
          const nextMode = finishedWork ? 'descanso' : 'trabajo';
          const nextDuration =
            (nextMode === 'trabajo' ? prev.pomodoro.workMinutes : prev.pomodoro.breakMinutes) * 60;
          return {
            ...prev,
            pomodoro: {
              ...prev.pomodoro,
              running: false,
              mode: nextMode,
              remainingSeconds: nextDuration,
              cyclesCompleted: finishedWork
                ? prev.pomodoro.cyclesCompleted + 1
                : prev.pomodoro.cyclesCompleted,
            },
          };
        }
        return {
          ...prev,
          pomodoro: {
            ...prev.pomodoro,
            remainingSeconds: prev.pomodoro.remainingSeconds - 1,
          },
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.pomodoro.running]);

  // Helper mutations
  const appendCli = useCallback((type: CliLogEntry['type'], text: string) => {
    setCliLogs((prev) => [
      ...prev.slice(-120),
      { id: crypto.randomUUID(), type, text, ts: new Date().toISOString() },
    ]);
  }, []);

  const handleExportJson = useCallback(() => {
    const json = exportHorizonteJson(state);
    downloadFile(json, 'horizonte-os-v19.4-backup.json', 'application/json');
    notify('Copia JSON exportada.');
  }, [state, notify]);

  const handleExportTxt = useCallback(() => {
    const txt = exportHorizonteTxt(state);
    downloadFile(txt, 'horizonte_os_backup_v19_4.txt', 'text/plain;charset=utf-8');
    notify('Backup TXT-1 exportado.');
  }, [state, notify]);

  const handleImportData = useCallback(
    (rawText: string, fileName: string, mode: 'merge' | 'replace' = 'merge') => {
      try {
        if (fileName.toLowerCase().endsWith('.json') || rawText.trim().startsWith('{')) {
          const parsedJson = JSON.parse(rawText);
          const mig = migrateJsonState(parsedJson);

          setState((prev) => {
            if (mode === 'replace') {
              return {
                ...prev,
                ...mig,
                misiones: mig.misiones || [],
                tareas: mig.tareas || prev.tareas,
                memoria: mig.memoria || [],
                plantillas: mig.plantillas || [],
                skills: mig.skills || [],
                prompts: mig.prompts || [],
                agentes: mig.agentes || prev.agentes,
              };
            }
            const mergeByTitle = <T extends { titulo?: string; nombre?: string }>(
              existing: T[],
              incoming?: T[]
            ) => {
              if (!incoming) return existing;
              const seen = new Set(
                existing.map((x) => (x.titulo || x.nombre || '').toLowerCase())
              );
              const fresh = incoming.filter(
                (x) => !seen.has((x.titulo || x.nombre || '').toLowerCase())
              );
              return [...fresh, ...existing];
            };
            return {
              ...prev,
              misiones: mergeByTitle(prev.misiones, mig.misiones),
              memoria: mergeByTitle(prev.memoria, mig.memoria),
              plantillas: mergeByTitle(prev.plantillas, mig.plantillas),
              skills: mergeByTitle(prev.skills, mig.skills),
              prompts: mergeByTitle(prev.prompts, mig.prompts),
              agentes: mergeByTitle(prev.agentes, mig.agentes),
            };
          });
          notify(`JSON importado (${mode === 'merge' ? 'fusionado' : 'reemplazado'}).`);
        } else {
          const parsed = parseHorizonteTxt(rawText);
          const count =
            parsed.misiones.length +
            parsed.memoria.length +
            parsed.plantillas.length +
            parsed.skills.length +
            parsed.prompts.length +
            parsed.agentes.length;

          if (count === 0) {
            notify('No se detectaron bloques TXT-1 válidos en el archivo.', 'warn');
            return;
          }

          setState((prev) => {
            if (mode === 'replace') {
              return {
                ...prev,
                perfil: {
                  ...prev.perfil,
                  nombre: parsed.perfilNombre || prev.perfil.nombre,
                  objetivo: parsed.perfilObjetivo || prev.perfil.objetivo,
                },
                misiones: parsed.misiones.length ? parsed.misiones : prev.misiones,
                memoria: parsed.memoria.length ? parsed.memoria : prev.memoria,
                plantillas: parsed.plantillas.length ? parsed.plantillas : prev.plantillas,
                skills: parsed.skills.length ? parsed.skills : prev.skills,
                prompts: parsed.prompts.length ? parsed.prompts : prev.prompts,
                agentes: parsed.agentes.length ? parsed.agentes : prev.agentes,
              };
            }

            const mergeByKey = <T extends { titulo?: string; nombre?: string }>(
              existing: T[],
              incoming: T[]
            ) => {
              const seen = new Set(
                existing.map((x) => (x.titulo || x.nombre || '').toLowerCase())
              );
              const fresh = incoming.filter(
                (x) => !seen.has((x.titulo || x.nombre || '').toLowerCase())
              );
              return [...fresh, ...existing];
            };

            return {
              ...prev,
              misiones: mergeByKey(prev.misiones, parsed.misiones),
              memoria: mergeByKey(prev.memoria, parsed.memoria),
              plantillas: mergeByKey(prev.plantillas, parsed.plantillas),
              skills: mergeByKey(prev.skills, parsed.skills),
              prompts: mergeByKey(prev.prompts, parsed.prompts),
              agentes: mergeByKey(prev.agentes, parsed.agentes),
            };
          });
          notify(`TXT-1 importado: ${count} bloques procesados.`);
        }
      } catch (err) {
        notify(
          `Error al importar: ${err instanceof Error ? err.message : 'archivo no válido'}`,
          'warn'
        );
      }
    },
    [notify]
  );

  const handleRunCliCommand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      appendCli('cmd', trimmed);
      const lower = trimmed.toLowerCase();

      if (lower === 'clear') {
        setCliLogs([]);
        return;
      }

      if (lower === 'help') {
        appendCli(
          'out',
          [
            'Comandos disponibles en Horizonte OS v19.4:',
            '  status                Resumen del estado actual',
            '  start [min]           Inicia Pomodoro (opcional minutos)',
            '  break [min]           Inicia descanso (opcional minutos)',
            '  reset                 Reinicia el temporizador actual',
            '  pomodoro              Alterna pausa/reanudar Pomodoro',
            '  task add <texto>      Crea nueva tarea en cuadrante Hacer',
            '  task done <n|texto>   Marca tarea como completada',
            '  task clear            Elimina tareas ya completadas',
            '  energy <0-100>        Ajusta nivel de energía GEMA',
            '  gema                  Muestra diagnóstico GEMA actual',
            '  theme [dark|light]    Cambia tema visual',
            '  focus                 Activa/desactiva Modo Focus',
            '  mission [título]      Lista misiones o crea una nueva',
            '  templates             Lista plantillas disponibles',
            '  memories              Lista últimos registros de memoria',
            '  agents                Lista agentes especializados',
            '  export                Descarga copia JSON',
            '  backup txt            Descarga copia TXT-1',
            '  dryrun                Ejecuta autodiagnóstico de integridad',
            '  clear                 Limpia la consola',
          ].join('\n')
        );
        return;
      }

      if (lower === 'status') {
        const activeM = state.misiones.filter(
          (m) => !['Completada', 'Cancelada'].includes(m.estado)
        ).length;
        const pendT = state.tareas.filter((t) => !t.done).length;
        appendCli(
          'ok',
          `Estado Horizonte OS v${state.version}\n· Modo Súper Agente: ${state.perfil.superAgenteModo}\n· Misiones activas: ${activeM}/${state.misiones.length}\n· Tareas pendientes: ${pendT}/${state.tareas.length}\n· GEMA: ${state.gema.energia}% (${state.gema.cargaCognitiva})\n· Pomodoro: ${state.pomodoro.mode} (${Math.floor(state.pomodoro.remainingSeconds / 60)}m ${state.pomodoro.running ? 'en marcha' : 'en pausa'})\n· Biblioteca: ${state.prompts.length} prompts, ${state.skills.length} skills, ${state.plantillas.length} plantillas, ${state.agentes.length} agentes.`
        );
        return;
      }

      if (lower.startsWith('start')) {
        const arg = Number.parseInt(trimmed.slice(5).trim(), 10);
        const mins = !Number.isNaN(arg) && arg > 0 && arg <= 120 ? arg : state.pomodoro.workMinutes;
        setState((prev) => ({
          ...prev,
          pomodoro: {
            ...prev.pomodoro,
            mode: 'trabajo',
            workMinutes: mins,
            remainingSeconds: mins * 60,
            running: true,
          },
        }));
        appendCli('ok', `Pomodoro de trabajo iniciado (${mins} min).`);
        return;
      }

      if (lower.startsWith('break')) {
        const arg = Number.parseInt(trimmed.slice(5).trim(), 10);
        const mins = !Number.isNaN(arg) && arg > 0 && arg <= 60 ? arg : state.pomodoro.breakMinutes;
        setState((prev) => ({
          ...prev,
          pomodoro: {
            ...prev.pomodoro,
            mode: 'descanso',
            breakMinutes: mins,
            remainingSeconds: mins * 60,
            running: true,
          },
        }));
        appendCli('ok', `Descanso iniciado (${mins} min).`);
        return;
      }

      if (lower === 'reset') {
        setState((prev) => ({
          ...prev,
          pomodoro: {
            ...prev.pomodoro,
            running: false,
            remainingSeconds:
              (prev.pomodoro.mode === 'trabajo'
                ? prev.pomodoro.workMinutes
                : prev.pomodoro.breakMinutes) * 60,
          },
        }));
        appendCli('ok', 'Temporizador reiniciado.');
        return;
      }

      if (lower === 'pomodoro') {
        setState((prev) => ({
          ...prev,
          pomodoro: { ...prev.pomodoro, running: !prev.pomodoro.running },
        }));
        appendCli('ok', 'Estado de Pomodoro alternado.');
        return;
      }

      if (lower.startsWith('task add ')) {
        const title = trimmed.slice(9).trim();
        if (!title) {
          appendCli('err', 'Indica el texto de la tarea: task add <texto>');
          return;
        }
        const newTask: TaskItem = {
          id: crypto.randomUUID(),
          titulo: title,
          quadrant: 'hacer',
          done: false,
          energyCost: 'medio',
          createdAt: new Date().toISOString(),
        };
        setState((prev) => ({ ...prev, tareas: [newTask, ...prev.tareas] }));
        appendCli('ok', `Tarea añadida: "${title}"`);
        return;
      }

      if (lower.startsWith('task done ')) {
        const arg = trimmed.slice(10).trim();
        const idx = Number.parseInt(arg, 10);
        let target: TaskItem | undefined;
        if (!Number.isNaN(idx) && idx >= 1 && idx <= state.tareas.length) {
          target = state.tareas[idx - 1];
        } else {
          target = state.tareas.find((t) =>
            t.titulo.toLowerCase().includes(arg.toLowerCase())
          );
        }
        if (!target) {
          appendCli('warn', `No se encontró ninguna tarea coincidente con "${arg}".`);
          return;
        }
        setState((prev) => ({
          ...prev,
          tareas: prev.tareas.map((t) =>
            t.id === target!.id ? { ...t, done: true } : t
          ),
        }));
        appendCli('ok', `Tarea completada: "${target.titulo}"`);
        return;
      }

      if (lower === 'task clear') {
        const doneCount = state.tareas.filter((t) => t.done).length;
        setState((prev) => ({
          ...prev,
          tareas: prev.tareas.filter((t) => !t.done),
        }));
        appendCli('ok', `Eliminadas ${doneCount} tareas completadas.`);
        return;
      }

      if (lower.startsWith('energy')) {
        const val = Number.parseInt(trimmed.slice(6).trim(), 10);
        if (Number.isNaN(val) || val < 0 || val > 100) {
          appendCli('err', 'Usa un valor entre 0 y 100: energy 75');
          return;
        }
        const load = computeCognitiveLoad(val);
        setState((prev) => ({
          ...prev,
          gema: {
            ...prev.gema,
            energia: val,
            cargaCognitiva: load,
            actualizado: new Date().toISOString(),
          },
        }));
        appendCli('ok', `GEMA actualizado: Energía ${val}% · Carga cognitiva ${load}.`);
        return;
      }

      if (lower === 'gema') {
        appendCli(
          'out',
          `GEMA actual: ${state.gema.energia}% · Carga cognitiva: ${state.gema.cargaCognitiva}\n${
            state.gema.energia < 40
              ? 'Sugerencia: reduce tareas activas y entra en Modo Focus.'
              : 'Sugerencia: capacidad adecuada para avanzar en la misión principal.'
          }`
        );
        return;
      }

      if (lower.startsWith('theme')) {
        const arg = lower.slice(5).trim();
        const nextTheme =
          arg === 'dark' || arg === 'oscuro'
            ? 'dark'
            : arg === 'light' || arg === 'claro'
              ? 'light'
              : state.ajustes.theme === 'dark'
                ? 'light'
                : 'dark';
        setState((prev) => ({
          ...prev,
          ajustes: { ...prev.ajustes, theme: nextTheme },
        }));
        appendCli('ok', `Tema cambiado a ${nextTheme}.`);
        return;
      }

      if (lower === 'focus') {
        setState((prev) => ({
          ...prev,
          ajustes: { ...prev.ajustes, focusMode: !prev.ajustes.focusMode },
        }));
        appendCli('ok', `Modo Focus ${!state.ajustes.focusMode ? 'activado' : 'desactivado'}.`);
        return;
      }

      if (lower === 'mission' || lower === 'missions') {
        const list = state.misiones
          .map((m, i) => `${i + 1}. [${m.estado}] ${m.titulo} — ${m.siguiente || '-'}`)
          .join('\n');
        appendCli('out', list || 'Sin misiones.');
        return;
      }

      if (lower.startsWith('mission ')) {
        const title = trimmed.slice(8).trim();
        const m: Mission = {
          id: crypto.randomUUID(),
          titulo: title,
          categoria: 'CLI',
          objetivo: title,
          contexto: '',
          restricciones: '',
          criterios: '',
          prioridad: 'Importante',
          estado: 'Nueva',
          planA: '',
          planB: '',
          riesgo: '',
          siguiente: 'Definir próxima acción',
          actualizada: new Date().toISOString(),
        };
        setState((prev) => ({ ...prev, misiones: [m, ...prev.misiones] }));
        appendCli('ok', `Misión creada: "${title}"`);
        return;
      }

      if (lower === 'templates') {
        appendCli(
          'out',
          state.plantillas
            .map((p, i) => `${i + 1}. ${p.titulo} (${p.categoria || 'General'})`)
            .join('\n')
        );
        return;
      }

      if (lower === 'memories') {
        appendCli(
          'out',
          state.memoria
            .slice(0, 8)
            .map((m, i) => `${i + 1}. [${m.tipo}] ${m.titulo}`)
            .join('\n')
        );
        return;
      }

      if (lower === 'agents') {
        appendCli(
          'out',
          state.agentes
            .map((a, i) => `${i + 1}. ${a.nombre} (${a.categoria} · ${a.fiabilidad}%)`)
            .join('\n')
        );
        return;
      }

      if (lower === 'export') {
        handleExportJson();
        appendCli('ok', 'Copia JSON exportada.');
        return;
      }

      if (lower === 'backup txt' || lower === 'backups') {
        handleExportTxt();
        appendCli('ok', 'Backup TXT-1 exportado.');
        return;
      }

      if (lower === 'dryrun') {
        const res = runDryRunDiagnostic(state);
        const lines = res.checks.map(
          (c) => `${c.pass ? '[OK]' : '[FALLO]'} ${c.label}: ${c.detail}`
        );
        appendCli(res.ok ? 'ok' : 'warn', lines.join('\n'));
        return;
      }

      appendCli('err', `Comando no reconocido: "${trimmed}". Escribe "help" para ver la lista.`);
    },
    [appendCli, handleExportJson, handleExportTxt, state]
  );

  const handleVoiceCommand = useCallback(
    (texto: string) => {
      const t = texto.toLowerCase().trim();
      const after = (re: RegExp) => texto.replace(re, '').trim();

      if (/^(tarea|apunta tarea|crea misi[oó]n|nueva misi[oó]n)\b/.test(t)) {
        const titulo = after(/^(tarea[:,]?|apunta tarea[:,]?|crea misi[oó]n[:,]?|nueva misi[oó]n[:,]?)\s*/i);
        if (!titulo) return { reply: 'Di el título después de "Tarea:".' };
        const m: Mission = {
          id: crypto.randomUUID(),
          titulo,
          objetivo: titulo,
          contexto: '',
          restricciones: '',
          criterios: '',
          prioridad: 'Importante',
          estado: 'Nueva',
          planA: '',
          planB: '',
          riesgo: '',
          siguiente: 'Definir próxima acción',
          actualizada: new Date().toISOString(),
        };
        setState((prev) => ({ ...prev, misiones: [m, ...prev.misiones] }));
        return { reply: `Misión creada: ${titulo}` };
      }

      if (/^(prioridad alta|bloqueada)\b/.test(t)) {
        const isBlocked = t.startsWith('bloqueada');
        const titulo = after(/^(prioridad alta[:,]?|bloqueada[:,]?)\s*/i);
        const m: Mission = {
          id: crypto.randomUUID(),
          titulo: titulo || 'Misión de voz',
          objetivo: titulo || '',
          contexto: '',
          restricciones: '',
          criterios: '',
          prioridad: isBlocked ? 'Importante' : 'Imprescindible',
          estado: isBlocked ? 'Bloqueada' : 'Nueva',
          planA: '',
          planB: '',
          riesgo: '',
          siguiente: isBlocked ? 'Identificar causa de bloqueo' : 'Ejecutar cuanto antes',
          actualizada: new Date().toISOString(),
        };
        setState((prev) => ({ ...prev, misiones: [m, ...prev.misiones] }));
        return { reply: `Misión registrada (${m.estado}): ${m.titulo}` };
      }

      if (/^(gasto|idea|aprendizaje|aprend[ií]|nota)\b/.test(t)) {
        const tipo: MemoryItem['tipo'] = t.startsWith('gasto')
          ? 'Gasto'
          : t.startsWith('idea')
            ? 'Idea'
            : t.startsWith('aprend')
              ? 'Aprendizaje'
              : 'Preferencia';
        const contenido = after(/^(gasto|idea|aprendizaje|aprend[ií]|nota)[:,]?\s*/i);
        const mem: MemoryItem = {
          id: crypto.randomUUID(),
          titulo: contenido.slice(0, 60) || tipo,
          contenido: contenido || texto,
          tipo,
          confianza: 'Alta',
          fecha: new Date().toISOString(),
        };
        setState((prev) => ({ ...prev, memoria: [mem, ...prev.memoria] }));
        return { reply: `Guardado en Memoria (${tipo}).` };
      }

      if (/^buscar en horizonte\b/.test(t)) {
        const q = after(/^buscar en horizonte\s*/i).toLowerCase();
        const foundM = state.misiones.filter((m) =>
          `${m.titulo} ${m.objetivo}`.toLowerCase().includes(q)
        );
        const foundMem = state.memoria.filter((m) =>
          `${m.titulo} ${m.contenido}`.toLowerCase().includes(q)
        );
        return {
          reply:
            foundM.length + foundMem.length > 0
              ? `Encontrados ${foundM.length} misiones y ${foundMem.length} memorias para "${q}".`
              : `Sin resultados internos para "${q}".`,
        };
      }

      if (/^(buscar|busca|google)\b/.test(t)) {
        const q = after(/^(buscar|busca|google)\s*/i);
        if (!q) return { reply: 'Indica qué quieres buscar.' };
        return {
          reply: `Búsqueda preparada para "${q}".`,
          externalUrl: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
          externalLabel: `Buscar "${q}" en Google`,
        };
      }

      if (/^(energ[ií]a)\b/.test(t)) {
        const num = Number.parseInt(t.replace(/[^\d]/g, ''), 10);
        if (!Number.isNaN(num) && num >= 0 && num <= 100) {
          const load = computeCognitiveLoad(num);
          setState((prev) => ({
            ...prev,
            gema: { ...prev.gema, energia: num, cargaCognitiva: load, actualizado: new Date().toISOString() },
          }));
          return { reply: `GEMA ajustado a ${num}% (${load}).` };
        }
      }

      if (/focus/.test(t)) {
        setState((prev) => ({
          ...prev,
          ajustes: { ...prev.ajustes, focusMode: true },
        }));
        return { reply: 'Modo Focus activado.' };
      }

      if (/resumen del d[ií]a/.test(t)) {
        const act = state.misiones.filter(
          (m) => !['Completada', 'Cancelada'].includes(m.estado)
        );
        return {
          reply: act.length
            ? `${act.length} misiones activas: ${act.map((m) => m.titulo).join(' · ')}`
            : 'No hay misiones activas hoy.',
        };
      }

      if (/exportar copia/.test(t)) {
        handleExportJson();
        return { reply: 'Copia de seguridad JSON exportada.' };
      }

      return {
        reply: 'No lo he reconocido. Prueba con "Tarea: ...", "Idea: ...", "Energía 70" o "Resumen del día".',
      };
    },
    [handleExportJson, state.memoria, state.misiones]
  );

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === tab)?.label || 'Horizonte OS';
  const activePomodoroMission = state.misiones.find(
    (m) => m.id === state.pomodoro.activeMissionId
  );
  const nextPendingTask = state.tareas.find((t) => !t.done);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-16 px-5 flex items-center border-b border-slate-200 dark:border-slate-800">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap">
            Horizonte OS
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <button
            type="button"
            onClick={() => setVoiceOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <Mic className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Comando de voz</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setState((prev) => ({
                ...prev,
                ajustes: { ...prev.ajustes, focusMode: true },
              }))
            }
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-2 min-h-[40px] text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Entrar en Focus</span>
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (3-zone contract, <=56px mobile height) */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0">
              Horizonte OS
            </span>
            <span className="hidden lg:inline text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {activeNavLabel}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
            <span>GEMA {state.gema.energia}%</span>
            <button
              type="button"
              onClick={() => setTab('terminal')}
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              CLI
            </button>
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              Voz
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTab('workspace')}
              aria-label="Abrir Google Drive y Sheets"
              className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 min-h-[38px] text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <Cloud className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>Drive</span>
            </button>
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => {
                setTab('misiones');
                setOpenNewMissionFlag(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 min-h-[38px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Nueva misión</span>
            </button>
          </div>
        </header>

        {/* Viewport content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-10">
          <GlobalSearchBar
            state={state}
            onNavigate={setTab}
            onToggleTask={(id) =>
              setState((prev) => ({
                ...prev,
                tareas: prev.tareas.map((t) =>
                  t.id === id ? { ...t, done: !t.done } : t
                ),
              }))
            }
            onNotify={notify}
          />
          {tab === 'inicio' && (
            <InicioView
              missions={state.misiones}
              tasks={state.tareas}
              gema={state.gema}
              pomodoro={state.pomodoro}
              superAgenteModo={state.perfil.superAgenteModo}
              memoriesCount={state.memoria.length}
              agentsCount={state.agentes.length}
              onChangeMode={(mode: SuperAgentMode) =>
                setState((prev) => ({
                  ...prev,
                  perfil: { ...prev.perfil, superAgenteModo: mode },
                }))
              }
              onChangeEnergy={(val: number) =>
                setState((prev) => ({
                  ...prev,
                  gema: {
                    ...prev.gema,
                    energia: val,
                    cargaCognitiva: computeCognitiveLoad(val),
                    actualizado: new Date().toISOString(),
                  },
                }))
              }
              onToggleTask={(id) =>
                setState((prev) => ({
                  ...prev,
                  tareas: prev.tareas.map((t) =>
                    t.id === id ? { ...t, done: !t.done } : t
                  ),
                }))
              }
              onQuickAddTask={(title) =>
                setState((prev) => ({
                  ...prev,
                  tareas: [
                    {
                      id: crypto.randomUUID(),
                      titulo: title,
                      quadrant: 'hacer',
                      done: false,
                      energyCost: 'medio',
                      createdAt: new Date().toISOString(),
                    },
                    ...prev.tareas,
                  ],
                }))
              }
              onTogglePomodoro={() =>
                setState((prev) => ({
                  ...prev,
                  pomodoro: { ...prev.pomodoro, running: !prev.pomodoro.running },
                }))
              }
              onResetPomodoro={() =>
                setState((prev) => ({
                  ...prev,
                  pomodoro: {
                    ...prev.pomodoro,
                    running: false,
                    remainingSeconds:
                      (prev.pomodoro.mode === 'trabajo'
                        ? prev.pomodoro.workMinutes
                        : prev.pomodoro.breakMinutes) * 60,
                  },
                }))
              }
              onSwitchPomodoroMode={(mode) =>
                setState((prev) => ({
                  ...prev,
                  pomodoro: {
                    ...prev.pomodoro,
                    mode,
                    running: false,
                    remainingSeconds:
                      (mode === 'trabajo'
                        ? prev.pomodoro.workMinutes
                        : prev.pomodoro.breakMinutes) * 60,
                  },
                }))
              }
              onSelectPomodoroMission={(missionId) =>
                setState((prev) => ({
                  ...prev,
                  pomodoro: { ...prev.pomodoro, activeMissionId: missionId || undefined },
                }))
              }
              onEnterFocus={() =>
                setState((prev) => ({
                  ...prev,
                  ajustes: { ...prev.ajustes, focusMode: true },
                }))
              }
              onOpenVoice={() => setVoiceOpen(true)}
              onNavigate={setTab}
              onOpenNewMission={() => {
                setTab('misiones');
                setOpenNewMissionFlag(true);
              }}
            />
          )}

          {tab === 'misiones' && (
            <MisionesView
              missions={state.misiones}
              tasks={state.tareas}
              triggerNewMissionModal={openNewMissionFlag}
              onConsumeNewMissionModal={() => setOpenNewMissionFlag(false)}
              onSaveMission={(m) => {
                setState((prev) => {
                  const exists = prev.misiones.some((x) => x.id === m.id);
                  return {
                    ...prev,
                    misiones: exists
                      ? prev.misiones.map((x) => (x.id === m.id ? m : x))
                      : [m, ...prev.misiones],
                  };
                });
                notify('Misión guardada.');
              }}
              onDeleteMission={(id) => {
                setState((prev) => ({
                  ...prev,
                  misiones: prev.misiones.filter((m) => m.id !== id),
                }));
                notify('Misión eliminada.');
              }}
              onSaveTask={(taskInput) => {
                setState((prev) => ({
                  ...prev,
                  tareas: [
                    {
                      ...taskInput,
                      id: crypto.randomUUID(),
                      done: false,
                      createdAt: new Date().toISOString(),
                    },
                    ...prev.tareas,
                  ],
                }));
                notify('Tarea añadida a la matriz.');
              }}
              onToggleTask={(id) =>
                setState((prev) => ({
                  ...prev,
                  tareas: prev.tareas.map((t) =>
                    t.id === id ? { ...t, done: !t.done } : t
                  ),
                }))
              }
              onDeleteTask={(id) =>
                setState((prev) => ({
                  ...prev,
                  tareas: prev.tareas.filter((t) => t.id !== id),
                }))
              }
              onClearDoneTasks={() => {
                setState((prev) => ({
                  ...prev,
                  tareas: prev.tareas.filter((t) => !t.done),
                }));
                notify('Tareas completadas eliminadas.');
              }}
            />
          )}

          {tab === 'biblioteca' && (
            <BibliotecaView
              plantillas={state.plantillas}
              skills={state.skills}
              prompts={state.prompts}
              memoria={state.memoria}
              onSavePlantilla={(p: TemplateItem) => {
                setState((prev) => {
                  const exists = prev.plantillas.some((x) => x.id === p.id);
                  return {
                    ...prev,
                    plantillas: exists
                      ? prev.plantillas.map((x) => (x.id === p.id ? p : x))
                      : [p, ...prev.plantillas],
                  };
                });
                notify('Plantilla guardada.');
              }}
              onDeletePlantilla={(id) => {
                setState((prev) => ({
                  ...prev,
                  plantillas: prev.plantillas.filter((x) => x.id !== id),
                }));
                notify('Plantilla eliminada.');
              }}
              onCreateMissionFromTemplate={(m) => {
                setState((prev) => ({ ...prev, misiones: [m, ...prev.misiones] }));
                setTab('misiones');
                notify('Misión creada desde plantilla.');
              }}
              onSaveSkill={(s: SkillItem) => {
                setState((prev) => {
                  const exists = prev.skills.some((x) => x.id === s.id);
                  return {
                    ...prev,
                    skills: exists
                      ? prev.skills.map((x) => (x.id === s.id ? s : x))
                      : [s, ...prev.skills],
                  };
                });
                notify('Skill guardada.');
              }}
              onDeleteSkill={(id) => {
                setState((prev) => ({
                  ...prev,
                  skills: prev.skills.filter((x) => x.id !== id),
                }));
                notify('Skill eliminada.');
              }}
              onToggleSkill={(id) =>
                setState((prev) => ({
                  ...prev,
                  skills: prev.skills.map((x) =>
                    x.id === id ? { ...x, activa: !x.activa } : x
                  ),
                }))
              }
              onSavePrompt={(p: PromptItem) => {
                setState((prev) => {
                  const exists = prev.prompts.some((x) => x.id === p.id);
                  return {
                    ...prev,
                    prompts: exists
                      ? prev.prompts.map((x) => (x.id === p.id ? p : x))
                      : [p, ...prev.prompts],
                  };
                });
                notify('Prompt guardado.');
              }}
              onDeletePrompt={(id) => {
                setState((prev) => ({
                  ...prev,
                  prompts: prev.prompts.filter((x) => x.id !== id),
                }));
                notify('Prompt eliminado.');
              }}
              onTogglePrompt={(id) =>
                setState((prev) => ({
                  ...prev,
                  prompts: prev.prompts.map((x) =>
                    x.id === id ? { ...x, activa: !x.activa } : x
                  ),
                }))
              }
              onImportTxtOrJson={(txt, name) => handleImportData(txt, name, 'merge')}
              onNotify={notify}
            />
          )}

          {tab === 'agentes' && (
            <AgentesView
              agents={state.agentes}
              missions={state.misiones}
              aladinChecklist={state.aladinChecklist}
              superAgenteModo={state.perfil.superAgenteModo}
              onSaveAgent={(a: AgentItem) => {
                setState((prev) => {
                  const exists = prev.agentes.some((x) => x.id === a.id);
                  return {
                    ...prev,
                    agentes: exists
                      ? prev.agentes.map((x) => (x.id === a.id ? a : x))
                      : [a, ...prev.agentes],
                  };
                });
                notify('Agente guardado.');
              }}
              onDeleteAgent={(id) => {
                setState((prev) => ({
                  ...prev,
                  agentes: prev.agentes.filter((x) => x.id !== id),
                }));
                notify('Agente eliminado.');
              }}
              onToggleAladinStep={(stepId) =>
                setState((prev) => ({
                  ...prev,
                  aladinChecklist: prev.aladinChecklist.map((s) =>
                    s.id === stepId ? { ...s, completed: !s.completed } : s
                  ),
                }))
              }
              onResetAladinChecklist={() => {
                setState((prev) => ({
                  ...prev,
                  aladinChecklist: ALADIN_CHECKLIST_DEFAULT,
                }));
                notify('Checklist Aladín v0.2 reiniciada.');
              }}
              onNotify={notify}
            />
          )}

          {tab === 'memoria' && (
            <MemoriaView
              memoria={state.memoria}
              onSaveMemoria={(m) => {
                setState((prev) => {
                  const exists = prev.memoria.some((x) => x.id === m.id);
                  return {
                    ...prev,
                    memoria: exists
                      ? prev.memoria.map((x) => (x.id === m.id ? m : x))
                      : [m, ...prev.memoria],
                  };
                });
                notify('Registro de memoria guardado.');
              }}
              onDeleteMemoria={(id) => {
                setState((prev) => ({
                  ...prev,
                  memoria: prev.memoria.filter((x) => x.id !== id),
                }));
                notify('Registro eliminado.');
              }}
              onNotify={notify}
            />
          )}

          {tab === 'workspace' && (
            <WorkspaceView
              state={state}
              user={authUser}
              accessToken={workspaceToken}
              needsAuth={needsWorkspaceAuth}
              isSigningIn={isSigningIn}
              onSignIn={handleGoogleSignIn}
              onLogout={handleGoogleLogout}
              onTokenExpired={() => {
                clearWorkspaceAccessToken();
                setWorkspaceToken(null);
                setNeedsWorkspaceAuth(true);
              }}
              onImportData={handleImportData}
              onApplyCloudState={(incoming) => {
                const mig = migrateJsonState(incoming);
                setState((prev) => ({
                  ...prev,
                  ...mig,
                  perfil: { ...prev.perfil, ...(incoming.perfil || {}) },
                  ajustes: { ...prev.ajustes, ...(incoming.ajustes || {}) },
                  gema: { ...prev.gema, ...(incoming.gema || {}) },
                  pomodoro: {
                    ...prev.pomodoro,
                    ...(incoming.pomodoro || {}),
                    running: false,
                  },
                  misiones: mig.misiones || prev.misiones,
                  tareas: mig.tareas || prev.tareas,
                  memoria: mig.memoria || prev.memoria,
                  plantillas: mig.plantillas || prev.plantillas,
                  skills: mig.skills || prev.skills,
                  prompts: mig.prompts || prev.prompts,
                  agentes: mig.agentes || prev.agentes,
                  aladinChecklist: incoming.aladinChecklist || prev.aladinChecklist,
                }));
              }}
              onAddTasksFromSheet={(tasksInput) => {
                const now = new Date().toISOString();
                const fresh: TaskItem[] = tasksInput.map((t) => ({
                  ...t,
                  id: crypto.randomUUID(),
                  createdAt: now,
                }));
                setState((prev) => ({
                  ...prev,
                  tareas: [...fresh, ...prev.tareas],
                }));
              }}
              onAddMemoryFromDoc={(title, content) => {
                const mem: MemoryItem = {
                  id: crypto.randomUUID(),
                  titulo: title.slice(0, 120),
                  contenido: content,
                  tipo: 'Proyecto',
                  confianza: 'Alta',
                  fecha: new Date().toISOString(),
                };
                setState((prev) => ({
                  ...prev,
                  memoria: [mem, ...prev.memoria],
                }));
              }}
              onNotify={notify}
            />
          )}

          {tab === 'terminal' && (
            <TerminalView logs={cliLogs} onRunCommand={handleRunCliCommand} />
          )}

          {tab === 'ajustes' && (
            <AjustesView
              state={state}
              onUpdateProfile={(nombre, objetivo, superAgenteModo) => {
                setState((prev) => ({
                  ...prev,
                  perfil: { nombre, objetivo, superAgenteModo },
                }));
                notify('Perfil actualizado.');
              }}
              onToggleTheme={() =>
                setState((prev) => ({
                  ...prev,
                  ajustes: {
                    ...prev.ajustes,
                    theme: prev.ajustes.theme === 'dark' ? 'light' : 'dark',
                  },
                }))
              }
              onToggleAlarm={() =>
                setState((prev) => ({
                  ...prev,
                  ajustes: { ...prev.ajustes, alarma: !prev.ajustes.alarma },
                }))
              }
              onExportJson={handleExportJson}
              onExportTxt={handleExportTxt}
              onImportFile={handleImportData}
              onOpenWorkspace={() => setTab('workspace')}
              onResetDefaults={() => {
                setState(SEED_STATE);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_STATE));
                notify('Sistema restaurado a la base inicial.');
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (5 primary destinations + compact <= 56px height) */}
      <nav
        aria-label="Navegación móvil"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm grid grid-cols-5"
      >
        {(
          [
            NAV_ITEMS[0],
            NAV_ITEMS[1],
            NAV_ITEMS[2],
            NAV_ITEMS[3],
            NAV_ITEMS[6],
          ] as typeof NAV_ITEMS
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[10px] font-medium transition-colors ${
                active
                  ? 'text-sky-600 dark:text-sky-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="truncate max-w-[64px]">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <FocusOverlay
        open={state.ajustes.focusMode}
        pomodoro={state.pomodoro}
        gema={state.gema}
        activeMission={activePomodoroMission}
        nextTask={nextPendingTask}
        onToggleRun={() =>
          setState((prev) => ({
            ...prev,
            pomodoro: { ...prev.pomodoro, running: !prev.pomodoro.running },
          }))
        }
        onReset={() =>
          setState((prev) => ({
            ...prev,
            pomodoro: {
              ...prev.pomodoro,
              running: false,
              remainingSeconds:
                (prev.pomodoro.mode === 'trabajo'
                  ? prev.pomodoro.workMinutes
                  : prev.pomodoro.breakMinutes) * 60,
            },
          }))
        }
        onCompleteTask={(id) => {
          setState((prev) => ({
            ...prev,
            tareas: prev.tareas.map((t) => (t.id === id ? { ...t, done: true } : t)),
          }));
          notify('Tarea completada.');
        }}
        onExit={() =>
          setState((prev) => ({
            ...prev,
            ajustes: { ...prev.ajustes, focusMode: false },
          }))
        }
      />

      <VoiceDrawer
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onExecuteVoiceText={handleVoiceCommand}
      />

      <OfflineIndicator />
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
