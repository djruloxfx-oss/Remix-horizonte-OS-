import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, CornerDownLeft } from 'lucide-react';
import type { CliLogEntry } from '../types/horizonte';
import { ModuleExportImportBar } from '../components/ModuleExportImportBar';
import {
  downloadTextFile,
  exportCliLogsTxt,
  exportSectionJson,
} from '../utils/txtParser';

interface TerminalViewProps {
  logs: CliLogEntry[];
  onRunCommand: (raw: string) => void;
  onImportCli: (rawText: string, fileName: string, mode: 'merge' | 'replace') => void;
  onNotify: (msg: string, kind?: 'ok' | 'warn' | 'info') => void;
}

const QUICK_COMMANDS = [
  'help',
  'status',
  'start',
  'break',
  'reset',
  'energy 80',
  'gema',
  'focus',
  'theme',
  'ui',
  'templates',
  'memories',
  'agents',
  'export',
  'backup txt',
  'dryrun',
  'clear',
];

export const TerminalView: React.FC<TerminalViewProps> = ({
  logs,
  onRunCommand,
  onImportCli,
  onNotify,
}) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number>(-1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const submitCommand = (cmdText: string) => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;
    setHistory((prev) => [trimmed, ...prev.slice(0, 39)]);
    setHistIdx(-1);
    onRunCommand(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(nextIdx);
      setInput(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx <= 0) {
        setHistIdx(-1);
        setInput('');
      } else {
        const nextIdx = histIdx - 1;
        setHistIdx(nextIdx);
        setInput(history[nextIdx]);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Comandos rápidos
          </div>
          <ModuleExportImportBar
            label="Historial / Script CLI"
            onExportJson={() => {
              downloadTextFile(
                exportSectionJson('cli', { cliLogs: logs }),
                'horizonte-cli-logs.json',
                'application/json'
              );
              onNotify('Historial CLI exportado en JSON.');
            }}
            onExportTxt={() => {
              downloadTextFile(
                exportCliLogsTxt(logs),
                'horizonte_cli_logs.txt'
              );
              onNotify('Historial CLI exportado en TXT.');
            }}
            onImportFile={onImportCli}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => submitCommand(cmd)}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono text-xs text-slate-700 dark:text-slate-200 transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950 text-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <TerminalIcon className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <span>Horizonte OS CLI · Kernel Local v19.4</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Escribe help para ver sintaxis
          </span>
        </div>

        <div className="p-4 h-[380px] overflow-y-auto font-mono text-xs space-y-2 leading-relaxed">
          {logs.map((entry) => {
            const color =
              entry.type === 'cmd'
                ? 'text-sky-400 font-semibold'
                : entry.type === 'ok'
                  ? 'text-emerald-400'
                  : entry.type === 'warn'
                    ? 'text-amber-400'
                    : entry.type === 'err'
                      ? 'text-red-400'
                      : 'text-slate-300';

            return (
              <div key={entry.id} className={`whitespace-pre-wrap ${color}`}>
                {entry.type === 'cmd' ? `$ ${entry.text}` : entry.text}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitCommand(input);
          }}
          className="flex items-center gap-2 border-t border-slate-800 bg-slate-900 px-3 py-2.5"
        >
          <span className="font-mono text-sm text-sky-400 select-none pl-1">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comando (ej. task add Revisar acta, energy 75, dryrun)..."
            aria-label="Entrada de comandos CLI"
            className="flex-1 bg-transparent text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 text-xs font-semibold shrink-0"
          >
            <CornerDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ejecutar</span>
          </button>
        </form>
      </div>
    </div>
  );
};
