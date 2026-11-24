import React, { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Modal } from './Modal';

interface ModuleExportImportBarProps {
  label: string;
  onExportJson: () => void;
  onExportTxt: () => void;
  onImportFile?: (rawText: string, fileName: string, mode: 'merge' | 'replace') => void;
  allowReplace?: boolean;
}

export const ModuleExportImportBar: React.FC<ModuleExportImportBarProps> = ({
  label,
  onExportJson,
  onExportTxt,
  onImportFile,
  allowReplace = true,
}) => {
  const [pendingImport, setPendingImport] = useState<{
    text: string;
    fileName: string;
  } | null>(null);

  return (
    <>
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onExportJson}
          title={`Exportar ${label} en JSON`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>JSON</span>
        </button>
        <button
          type="button"
          onClick={onExportTxt}
          title={`Exportar ${label} en TXT-1`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>TXT</span>
        </button>
        {onImportFile && (
          <label className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Importar</span>
            <input
              type="file"
              accept=".json,.txt,.md"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                e.target.value = '';
                if (!allowReplace) {
                  onImportFile(text, file.name, 'merge');
                } else {
                  setPendingImport({ text, fileName: file.name });
                }
              }}
            />
          </label>
        )}
      </div>

      <Modal
        open={Boolean(pendingImport)}
        title={`Importar ${label}`}
        onClose={() => setPendingImport(null)}
        maxWidthClass="max-w-md"
      >
        {pendingImport && onImportFile && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Archivo seleccionado:{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {pendingImport.fileName}
              </span>
              . Elige si quieres fusionar los elementos nuevos con los existentes o reemplazar esta sección.
            </p>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 max-h-32 overflow-y-auto">
              {pendingImport.text.slice(0, 320)}
              {pendingImport.text.length > 320 ? '...' : ''}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onImportFile(pendingImport.text, pendingImport.fileName, 'merge');
                  setPendingImport(null);
                }}
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-semibold"
              >
                Fusionar
              </button>
              <button
                type="button"
                onClick={() => {
                  onImportFile(pendingImport.text, pendingImport.fileName, 'replace');
                  setPendingImport(null);
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-semibold"
              >
                Reemplazar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
