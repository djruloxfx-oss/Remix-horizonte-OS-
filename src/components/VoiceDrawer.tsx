import React, { useRef, useState } from 'react';
import { Mic, MicOff, Send, ExternalLink } from 'lucide-react';
import { Modal } from './Modal';

interface VoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  onExecuteVoiceText: (text: string) => {
    reply: string;
    externalUrl?: string;
    externalLabel?: string;
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export const VoiceDrawer: React.FC<VoiceDrawerProps> = ({
  open,
  onClose,
  onExecuteVoiceText,
}) => {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('Pulsa el micrófono o escribe un comando de voz.');
  const [manualText, setManualText] = useState('');
  const [externalAction, setExternalAction] = useState<{ url: string; label: string } | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  const handleTextSubmit = (txt: string) => {
    const trimmed = txt.trim();
    if (!trimmed) return;
    const res = onExecuteVoiceText(trimmed);
    setStatus(res.reply);
    if (res.externalUrl) {
      setExternalAction({
        url: res.externalUrl,
        label: res.externalLabel || 'Abrir enlace',
      });
    } else {
      setExternalAction(null);
    }
  };

  const toggleMic = () => {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (!SR) {
      setStatus('Tu navegador no soporta reconocimiento de voz nativo. Usa el campo de texto inferior.');
      return;
    }

    if (listening && recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }

    try {
      const rec = new SR();
      rec.lang = 'es-ES';
      rec.interimResults = false;
      recRef.current = rec;
      setListening(true);
      setStatus('Escuchando en español...');
      setExternalAction(null);

      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript.trim();
        setManualText(transcript);
        setListening(false);
        handleTextSubmit(transcript);
      };
      rec.onerror = (e) => {
        setListening(false);
        setStatus(`No se pudo completar la escucha (${e.error}). Puedes intentarlo de nuevo o escribirlo.`);
      };
      rec.onend = () => {
        setListening(false);
      };
      rec.start();
    } catch (err) {
      setListening(false);
      setStatus(`No se pudo iniciar el micrófono: ${err instanceof Error ? err.message : 'error'}`);
    }
  };

  return (
    <Modal open={open} title="Comandos de voz y entrada rápida" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            Ejemplos compatibles:
          </p>
          <p>
            “Tarea: Revisar acta” · “Prioridad alta: Llamar taller” · “Gasto: 18 euros libro” ·
            “Idea: Plantilla resumen” · “Buscar en Horizonte agentes” · “Energía 65” · “Resumen del día”
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900">
          {status}
          {externalAction && (
            <div className="mt-3">
              <a
                href={externalAction.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{externalAction.label}</span>
              </a>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleMic}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 min-h-[46px] text-sm font-semibold transition-colors ${
            listening
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-sky-600 hover:bg-sky-700 text-white'
          }`}
        >
          {listening ? (
            <>
              <MicOff className="w-4 h-4" aria-hidden="true" />
              <span>Detener micrófono</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" aria-hidden="true" />
              <span>Empezar a escuchar</span>
            </>
          )}
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTextSubmit(manualText);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="O escribe aquí un comando (ej. Tarea: ...)"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 min-h-[42px] text-sm font-semibold shrink-0"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>Ejecutar</span>
          </button>
        </form>
      </div>
    </Modal>
  );
};
