import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Bookmark,
  BookmarkCheck,
  Cloud,
  CloudDownload,
  CloudUpload,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LogOut,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  HorizonteState,
  TaskItem,
  WorkspaceBookmark,
} from '../types/horizonte';
import { exportHorizonteJson, exportHorizonteTxt } from '../utils/txtParser';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { Modal } from '../components/Modal';
import {
  addSlideWithText,
  appendGoogleDocText,
  appendSheetRows,
  createDriveTextFile,
  createGoogleDoc,
  createGooglePresentation,
  createSpreadsheet,
  deleteDriveFile,
  downloadDriveFileText,
  getGoogleDoc,
  getGooglePresentation,
  getSpreadsheetMeta,
  listDriveFiles,
  listGoogleDocs,
  listGooglePresentations,
  listSpreadsheets,
  readSheetRange,
  replaceGoogleDocText,
  updateDriveTextFile,
  updateSheetValues,
  WorkspaceAuthError,
  type DriveFileItem,
  type GoogleDocSummary,
  type GooglePresentationSummary,
  type SpreadsheetMeta,
} from '../services/googleWorkspace';
import {
  addWorkspaceBookmark,
  fetchCloudSnapshot,
  removeWorkspaceBookmark,
  saveCloudSnapshot,
} from '../services/cloudSync';
import {
  removeFirestoreWorkspaceItem,
  subscribeFirestoreMissions,
  syncMissionsToFirestore,
  upsertFirestoreWorkspaceItem,
} from '../services/firestoreSync';

interface WorkspaceViewProps {
  state: HorizonteState;
  user: User | null;
  accessToken: string | null;
  needsAuth: boolean;
  isSigningIn: boolean;
  onSignIn: () => Promise<void>;
  onLogout: () => Promise<void>;
  onTokenExpired: () => void;
  onImportData: (rawText: string, fileName: string, mode: 'merge' | 'replace') => void;
  onApplyCloudState: (incoming: Partial<HorizonteState>) => void;
  onAddTasksFromSheet: (tasks: Omit<TaskItem, 'id' | 'createdAt'>[]) => void;
  onAddMemoryFromDoc: (title: string, content: string) => void;
  onNotify: (msg: string, kind?: 'ok' | 'info' | 'warn') => void;
}

type WorkspaceSubTab = 'drive' | 'sheets' | 'docs' | 'slides';

type ConfirmAction =
  | {
      kind: 'delete_drive_file';
      file: DriveFileItem;
    }
  | {
      kind: 'overwrite_drive_file';
      file: DriveFileItem;
      format: 'json' | 'txt';
    }
  | {
      kind: 'export_sheet_overwrite';
      spreadsheet: SpreadsheetMeta;
      sheetTitle: string;
      rows: (string | number | boolean)[][];
    }
  | {
      kind: 'append_sheet_row';
      spreadsheet: SpreadsheetMeta;
      sheetTitle: string;
      row: string[];
    }
  | {
      kind: 'append_doc_text';
      doc: GoogleDocSummary;
      text: string;
    }
  | {
      kind: 'replace_doc_brief';
      doc: GoogleDocSummary;
      newText: string;
    }
  | {
      kind: 'add_slide_to_presentation';
      presentation: GooglePresentationSummary;
      slideTitle: string;
      bodyText: string;
    }
  | {
      kind: 'restore_cloud_snapshot';
      updatedAt: string | null;
      incoming: Partial<HorizonteState>;
    };

function formatFileSize(bytesStr?: string): string {
  if (!bytesStr) return '—';
  const bytes = Number.parseInt(bytesStr, 10);
  if (Number.isNaN(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMimeLabel(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Sheets';
  if (mimeType === 'application/vnd.google-apps.document') return 'Google Docs';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'Google Slides';
  if (mimeType === 'application/vnd.google-apps.folder') return 'Carpeta';
  if (mimeType === 'application/json') return 'Backup JSON';
  if (mimeType === 'text/plain') return 'Archivo TXT';
  return mimeType.split('/').pop() || 'Archivo';
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  state,
  user,
  accessToken,
  needsAuth,
  isSigningIn,
  onSignIn,
  onLogout,
  onTokenExpired,
  onImportData,
  onApplyCloudState,
  onAddTasksFromSheet,
  onAddMemoryFromDoc,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<WorkspaceSubTab>('drive');

  // Drive state
  const [driveQuery, setDriveQuery] = useState('');
  const [driveFilter, setDriveFilter] = useState<
    'all' | 'backups' | 'sheets' | 'docs' | 'slides'
  >('all');
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);

  // Sheets state
  const [spreadsheets, setSpreadsheets] = useState<DriveFileItem[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>('');
  const [sheetMeta, setSheetMeta] = useState<SpreadsheetMeta | null>(null);
  const [selectedSheetTitle, setSelectedSheetTitle] = useState<string>('');
  const [sheetValues, setSheetValues] = useState<string[][]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('Horizonte OS — Registro');
  const [rowTitle, setRowTitle] = useState('');
  const [rowCategory, setRowCategory] = useState('Misión');
  const [rowStatus, setRowStatus] = useState('Pendiente');
  const [rowNote, setRowNote] = useState('');

  // Docs state
  const [docsList, setDocsList] = useState<DriveFileItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [docMeta, setDocMeta] = useState<GoogleDocSummary | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('Horizonte OS — Informe');
  const [docAppendText, setDocAppendText] = useState('');

  // Slides state
  const [presentationsList, setPresentationsList] = useState<DriveFileItem[]>([]);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string>('');
  const [presentationMeta, setPresentationMeta] =
    useState<GooglePresentationSummary | null>(null);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [newPresentationTitle, setNewPresentationTitle] = useState(
    'Horizonte OS — Presentación'
  );
  const [slideTitleInput, setSlideTitleInput] = useState('');
  const [slideBodyInput, setSlideBodyInput] = useState('');
  const [slideSourceMissionId, setSlideSourceMissionId] = useState('');

  // Cloud & Firestore state
  const [bookmarks, setBookmarks] = useState<WorkspaceBookmark[]>([]);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [firestoreMissionCount, setFirestoreMissionCount] = useState<number | null>(
    null
  );
  const [syncBusy, setSyncBusy] = useState(false);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [mutating, setMutating] = useState(false);
  const [importChoice, setImportChoice] = useState<{
    file: DriveFileItem;
    text: string;
  } | null>(null);

  const handleWorkspaceError = useCallback(
    (err: unknown, fallbackMsg: string) => {
      if (err instanceof WorkspaceAuthError) {
        onTokenExpired();
        onNotify(err.message, 'warn');
        return;
      }
      onNotify(err instanceof Error ? err.message : fallbackMsg, 'warn');
    },
    [onNotify, onTokenExpired]
  );

  const refreshCloudMeta = useCallback(async () => {
    if (!user) {
      setBookmarks([]);
      setCloudUpdatedAt(null);
      return;
    }
    try {
      const data = await fetchCloudSnapshot();
      setBookmarks(data.bookmarks);
      setCloudUpdatedAt(data.updatedAt);
    } catch {
      // Keep UI interactive
    }
  }, [user]);

  useEffect(() => {
    refreshCloudMeta();
  }, [refreshCloudMeta]);

  // Real-time Firestore listener for user's missions when signed in & verified
  useEffect(() => {
    if (!user || !user.emailVerified) {
      setFirestoreMissionCount(null);
      return;
    }
    const unsub = subscribeFirestoreMissions(user, (count) => {
      setFirestoreMissionCount(count);
    });
    return () => unsub();
  }, [user]);

  // Load Drive files
  const loadDrive = useCallback(async () => {
    if (!accessToken) return;
    setDriveLoading(true);
    try {
      const files = await listDriveFiles(accessToken, {
        query: driveQuery,
        filter: driveFilter,
      });
      setDriveFiles(files);
    } catch (err) {
      handleWorkspaceError(err, 'No se pudieron cargar los archivos de Google Drive.');
    } finally {
      setDriveLoading(false);
    }
  }, [accessToken, driveFilter, driveQuery, handleWorkspaceError]);

  // Load Sheets list
  const loadSheetsList = useCallback(async () => {
    if (!accessToken) return;
    setSheetsLoading(true);
    try {
      const list = await listSpreadsheets(accessToken);
      setSpreadsheets(list);
      if (list.length > 0 && !selectedSpreadsheetId) {
        setSelectedSpreadsheetId(list[0].id);
      }
    } catch (err) {
      handleWorkspaceError(err, 'No se pudieron listar tus hojas de cálculo.');
    } finally {
      setSheetsLoading(false);
    }
  }, [accessToken, handleWorkspaceError, selectedSpreadsheetId]);

  // Load Docs list
  const loadDocsList = useCallback(async () => {
    if (!accessToken) return;
    setDocsLoading(true);
    try {
      const list = await listGoogleDocs(accessToken);
      setDocsList(list);
      if (list.length > 0 && !selectedDocId) {
        setSelectedDocId(list[0].id);
      }
    } catch (err) {
      handleWorkspaceError(err, 'No se pudieron listar tus documentos de Google Docs.');
    } finally {
      setDocsLoading(false);
    }
  }, [accessToken, handleWorkspaceError, selectedDocId]);

  // Load Slides list
  const loadPresentationsList = useCallback(async () => {
    if (!accessToken) return;
    setSlidesLoading(true);
    try {
      const list = await listGooglePresentations(accessToken);
      setPresentationsList(list);
      if (list.length > 0 && !selectedPresentationId) {
        setSelectedPresentationId(list[0].id);
      }
    } catch (err) {
      handleWorkspaceError(
        err,
        'No se pudieron listar tus presentaciones de Google Slides.'
      );
    } finally {
      setSlidesLoading(false);
    }
  }, [accessToken, handleWorkspaceError, selectedPresentationId]);

  useEffect(() => {
    if (accessToken && !needsAuth) {
      loadDrive();
      loadSheetsList();
      loadDocsList();
      loadPresentationsList();
    }
  }, [
    accessToken,
    needsAuth,
    loadDrive,
    loadSheetsList,
    loadDocsList,
    loadPresentationsList,
  ]);

  const loadSelectedSpreadsheetMeta = useCallback(
    async (spreadsheetId: string) => {
      if (!accessToken || !spreadsheetId) return;
      setSheetsLoading(true);
      try {
        const meta = await getSpreadsheetMeta(accessToken, spreadsheetId);
        setSheetMeta(meta);
        const firstTab = meta.sheets[0]?.title || '';
        setSelectedSheetTitle(firstTab);
        if (firstTab) {
          const rows = await readSheetRange(accessToken, spreadsheetId, firstTab);
          setSheetValues(rows);
        } else {
          setSheetValues([]);
        }
      } catch (err) {
        handleWorkspaceError(err, 'No se pudo abrir la hoja de cálculo.');
      } finally {
        setSheetsLoading(false);
      }
    },
    [accessToken, handleWorkspaceError]
  );

  useEffect(() => {
    if (accessToken && selectedSpreadsheetId) {
      loadSelectedSpreadsheetMeta(selectedSpreadsheetId);
    }
  }, [accessToken, selectedSpreadsheetId, loadSelectedSpreadsheetMeta]);

  const loadSelectedDoc = useCallback(
    async (documentId: string) => {
      if (!accessToken || !documentId) return;
      setDocsLoading(true);
      try {
        const docData = await getGoogleDoc(accessToken, documentId);
        setDocMeta(docData);
      } catch (err) {
        handleWorkspaceError(err, 'No se pudo leer el documento de Google Docs.');
      } finally {
        setDocsLoading(false);
      }
    },
    [accessToken, handleWorkspaceError]
  );

  useEffect(() => {
    if (accessToken && selectedDocId) {
      loadSelectedDoc(selectedDocId);
    }
  }, [accessToken, selectedDocId, loadSelectedDoc]);

  const loadSelectedPresentation = useCallback(
    async (presentationId: string) => {
      if (!accessToken || !presentationId) return;
      setSlidesLoading(true);
      try {
        const presData = await getGooglePresentation(accessToken, presentationId);
        setPresentationMeta(presData);
      } catch (err) {
        handleWorkspaceError(
          err,
          'No se pudo abrir la presentación de Google Slides.'
        );
      } finally {
        setSlidesLoading(false);
      }
    },
    [accessToken, handleWorkspaceError]
  );

  useEffect(() => {
    if (accessToken && selectedPresentationId) {
      loadSelectedPresentation(selectedPresentationId);
    }
  }, [accessToken, selectedPresentationId, loadSelectedPresentation]);

  const handleSelectSheetTab = async (tabTitle: string) => {
    if (!accessToken || !sheetMeta) return;
    setSelectedSheetTitle(tabTitle);
    setSheetsLoading(true);
    try {
      const rows = await readSheetRange(accessToken, sheetMeta.spreadsheetId, tabTitle);
      setSheetValues(rows);
    } catch (err) {
      handleWorkspaceError(err, 'No se pudo leer la pestaña seleccionada.');
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveToCloud = async () => {
    if (!user) return;
    setSyncBusy(true);
    try {
      const [res, syncedCount] = await Promise.all([
        saveCloudSnapshot(state),
        syncMissionsToFirestore(
          user,
          state.misiones,
          state.perfil.superAgenteModo
        ),
      ]);
      setCloudUpdatedAt(res.updatedAt);
      onNotify(
        `Estado guardado en la nube y ${syncedCount} misiones sincronizadas en Firestore.`
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'No se pudo guardar en la nube.',
        'warn'
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const handleRequestRestoreFromCloud = async () => {
    if (!user) return;
    setSyncBusy(true);
    try {
      const data = await fetchCloudSnapshot();
      if (!data.state) {
        onNotify('Aún no hay una copia guardada en la nube para esta cuenta.', 'warn');
        return;
      }
      setConfirmAction({
        kind: 'restore_cloud_snapshot',
        updatedAt: data.updatedAt,
        incoming: data.state,
      });
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'No se pudo consultar la nube.',
        'warn'
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const handleUploadNewBackup = async (format: 'json' | 'txt') => {
    if (!accessToken) {
      onTokenExpired();
      return;
    }
    setDriveLoading(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        const content = exportHorizonteJson(state);
        await createDriveTextFile(
          accessToken,
          `horizonte-os-v19.4-backup-${stamp}.json`,
          content,
          'application/json'
        );
      } else {
        const content = exportHorizonteTxt(state);
        await createDriveTextFile(
          accessToken,
          `horizonte_os_backup_v19_4_${stamp}.txt`,
          content,
          'text/plain'
        );
      }
      onNotify(`Backup ${format.toUpperCase()} creado en Google Drive.`);
      await loadDrive();
    } catch (err) {
      handleWorkspaceError(err, 'No se pudo subir el archivo a Google Drive.');
    } finally {
      setDriveLoading(false);
    }
  };

  const handlePrepareImportFromDrive = async (file: DriveFileItem) => {
    if (!accessToken) {
      onTokenExpired();
      return;
    }
    setDriveLoading(true);
    try {
      const text = await downloadDriveFileText(accessToken, file.id, file.mimeType);
      setImportChoice({ file, text });
    } catch (err) {
      handleWorkspaceError(err, 'No se pudo descargar el archivo desde Drive.');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleCreateNewSpreadsheet = async () => {
    if (!accessToken) {
      onTokenExpired();
      return;
    }
    const cleanTitle = newSheetTitle.trim() || 'Horizonte OS — Registro';
    setSheetsLoading(true);
    try {
      const created = await createSpreadsheet(accessToken, cleanTitle, 'Horizonte');
      await loadSheetsList();
      setSelectedSpreadsheetId(created.spreadsheetId);
      setSheetMeta(created);
      setSelectedSheetTitle(created.sheets[0]?.title || 'Horizonte');
      setSheetValues([]);
      onNotify(`Hoja "${created.title}" creada en Google Sheets.`);
    } catch (err) {
      handleWorkspaceError(err, 'No se pudo crear la hoja de cálculo.');
    } finally {
      setSheetsLoading(false);
    }
  };

  const buildHorizonteDocBrief = useMemo(() => {
    const lines: string[] = [
      `HORIZONTE OS — INFORME OPERATIVO (${new Date().toLocaleDateString('es-ES')})`,
      `Entorno: ${state.perfil.nombre} | Modo: ${state.perfil.superAgenteModo}`,
      `Objetivo principal: ${state.perfil.objetivo || 'No definido'}`,
      `GEMA actual: ${state.gema.energia}% (${state.gema.cargaCognitiva})`,
      '',
      `MISIONES ACTIVAS (${state.misiones.length})`,
      ...state.misiones.map(
        (m, i) =>
          `${i + 1}. [${m.estado} · ${m.prioridad}] ${m.titulo}\n   Objetivo: ${m.objetivo || '-'}\n   Siguiente acción: ${m.siguiente || '-'}`
      ),
      '',
      `MEMORIA RECIENTE (${Math.min(10, state.memoria.length)} registros)`,
      ...state.memoria
        .slice(0, 10)
        .map((mem, i) => `${i + 1}. [${mem.tipo}] ${mem.titulo}: ${mem.contenido}`),
    ];
    return lines.join('\n');
  }, [state]);

  const handleCreateNewDoc = async () => {
    if (!accessToken) {
      onTokenExpired();
      return;
    }
    const cleanTitle = newDocTitle.trim() || 'Horizonte OS — Informe';
    setDocsLoading(true);
    try {
      const created = await createGoogleDoc(
        accessToken,
        cleanTitle,
        buildHorizonteDocBrief
      );
      await loadDocsList();
      setSelectedDocId(created.documentId);
      setDocMeta(created);
      onNotify(`Documento "${created.title}" creado en Google Docs.`);
    } catch (err) {
      handleWorkspaceError(err, 'No se pudo crear el documento de Google Docs.');
    } finally {
      setDocsLoading(false);
    }
  };

  const handleCreateNewPresentation = async () => {
    if (!accessToken) {
      onTokenExpired();
      return;
    }
    const cleanTitle =
      newPresentationTitle.trim() || 'Horizonte OS — Presentación';
    setSlidesLoading(true);
    try {
      const created = await createGooglePresentation(accessToken, cleanTitle);
      await loadPresentationsList();
      setSelectedPresentationId(created.presentationId);
      setPresentationMeta(created);
      onNotify(`Presentación "${created.title}" creada en Google Slides.`);
    } catch (err) {
      handleWorkspaceError(
        err,
        'No se pudo crear la presentación de Google Slides.'
      );
    } finally {
      setSlidesLoading(false);
    }
  };

  const handleToggleBookmark = async (
    kind: 'drive_file' | 'sheet',
    firestoreKind: 'drive_file' | 'sheet' | 'doc' | 'slides',
    item: { id: string; name: string; mimeType?: string; webViewLink?: string }
  ) => {
    if (!user) return;
    const existing = bookmarks.find(
      (b) => b.kind === kind && b.externalId === item.id
    );
    try {
      if (existing) {
        await removeWorkspaceBookmark(existing.id);
        await removeFirestoreWorkspaceItem(user, firestoreKind, item.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
        onNotify('Elemento quitado de fijados.');
      } else {
        const saved = await addWorkspaceBookmark({
          kind,
          externalId: item.id,
          name: item.name,
          mimeType: item.mimeType || null,
          webViewLink: item.webViewLink || null,
        });
        await upsertFirestoreWorkspaceItem(user, {
          kind: firestoreKind,
          externalId: item.id,
          name: item.name,
          webViewLink: item.webViewLink,
        });
        setBookmarks((prev) => [saved, ...prev.filter((b) => b.id !== saved.id)]);
        onNotify('Elemento fijado en tu espacio de trabajo.');
      }
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'No se pudo actualizar fijados.',
        'warn'
      );
    }
  };

  const buildExportRows = useMemo(() => {
    const header: (string | number | boolean)[] = [
      'Tipo',
      'Título',
      'Categoría / Cuadrante',
      'Estado',
      'Prioridad / Energía',
      'Siguiente acción / Detalle',
      'Fecha',
    ];
    const missionRows = state.misiones.map((m) => [
      'Misión',
      m.titulo,
      m.categoria || 'General',
      m.estado,
      m.prioridad,
      m.siguiente || m.objetivo,
      m.actualizada.slice(0, 10),
    ]);
    const taskRows = state.tareas.map((t) => [
      'Tarea',
      t.titulo,
      t.quadrant,
      t.done ? 'Completada' : 'Pendiente',
      `Energía ${t.energyCost}`,
      '',
      t.createdAt.slice(0, 10),
    ]);
    return [header, ...missionRows, ...taskRows];
  }, [state.misiones, state.tareas]);

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    setMutating(true);
    try {
      if (confirmAction.kind === 'restore_cloud_snapshot') {
        onApplyCloudState(confirmAction.incoming);
        onNotify('Estado restaurado desde la nube.');
        setConfirmAction(null);
        return;
      }

      if (!accessToken) {
        onTokenExpired();
        setConfirmAction(null);
        return;
      }

      if (confirmAction.kind === 'delete_drive_file') {
        await deleteDriveFile(accessToken, confirmAction.file.id);
        onNotify(`Archivo "${confirmAction.file.name}" eliminado de Google Drive.`);
        setConfirmAction(null);
        await Promise.all([
          loadDrive(),
          loadSheetsList(),
          loadDocsList(),
          loadPresentationsList(),
        ]);
      } else if (confirmAction.kind === 'overwrite_drive_file') {
        const content =
          confirmAction.format === 'json'
            ? exportHorizonteJson(state)
            : exportHorizonteTxt(state);
        const mime =
          confirmAction.format === 'json' ? 'application/json' : 'text/plain';
        await updateDriveTextFile(
          accessToken,
          confirmAction.file.id,
          content,
          mime
        );
        onNotify(`Archivo "${confirmAction.file.name}" actualizado en Google Drive.`);
        setConfirmAction(null);
        await loadDrive();
      } else if (confirmAction.kind === 'export_sheet_overwrite') {
        await updateSheetValues(
          accessToken,
          confirmAction.spreadsheet.spreadsheetId,
          confirmAction.sheetTitle,
          'A1',
          confirmAction.rows
        );
        onNotify(
          `${confirmAction.rows.length} filas exportadas a "${confirmAction.sheetTitle}".`
        );
        const updatedRows = await readSheetRange(
          accessToken,
          confirmAction.spreadsheet.spreadsheetId,
          confirmAction.sheetTitle
        );
        setSheetValues(updatedRows);
        setConfirmAction(null);
      } else if (confirmAction.kind === 'append_sheet_row') {
        await appendSheetRows(
          accessToken,
          confirmAction.spreadsheet.spreadsheetId,
          confirmAction.sheetTitle,
          'A:Z',
          [confirmAction.row]
        );
        setRowTitle('');
        setRowNote('');
        onNotify(`Fila añadida en "${confirmAction.sheetTitle}".`);
        const updatedRows = await readSheetRange(
          accessToken,
          confirmAction.spreadsheet.spreadsheetId,
          confirmAction.sheetTitle
        );
        setSheetValues(updatedRows);
        setConfirmAction(null);
      } else if (confirmAction.kind === 'append_doc_text') {
        await appendGoogleDocText(
          accessToken,
          confirmAction.doc.documentId,
          confirmAction.text,
          confirmAction.doc.endIndex
        );
        setDocAppendText('');
        onNotify(`Texto añadido a "${confirmAction.doc.title}".`);
        await loadSelectedDoc(confirmAction.doc.documentId);
        setConfirmAction(null);
      } else if (confirmAction.kind === 'replace_doc_brief') {
        await replaceGoogleDocText(
          accessToken,
          confirmAction.doc.documentId,
          confirmAction.newText,
          confirmAction.doc.endIndex
        );
        onNotify(`Documento "${confirmAction.doc.title}" actualizado.`);
        await loadSelectedDoc(confirmAction.doc.documentId);
        setConfirmAction(null);
      } else if (confirmAction.kind === 'add_slide_to_presentation') {
        await addSlideWithText(
          accessToken,
          confirmAction.presentation.presentationId,
          confirmAction.slideTitle,
          confirmAction.bodyText
        );
        setSlideTitleInput('');
        setSlideBodyInput('');
        setSlideSourceMissionId('');
        onNotify(
          `Diapositiva añadida a "${confirmAction.presentation.title}".`
        );
        await loadSelectedPresentation(
          confirmAction.presentation.presentationId
        );
        setConfirmAction(null);
      }
    } catch (err) {
      handleWorkspaceError(err, 'No se pudo completar la operación.');
    } finally {
      setMutating(false);
    }
  };

  const bookmarkedIds = useMemo(
    () => new Set(bookmarks.map((b) => b.externalId)),
    [bookmarks]
  );

  return (
    <div className="space-y-6">
      {/* Account & Cloud Sync Header */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Google Workspace y Sincronización
            </h1>
          </div>
          {user ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Conectado como{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-200">
                {user.displayName || user.email}
              </span>
              {user.displayName && user.email ? ` (${user.email})` : ''}
              {cloudUpdatedAt
                ? ` · Última copia en la nube: ${new Date(cloudUpdatedAt).toLocaleString('es-ES')}`
                : ' · Listo para sincronizar'}
              {firestoreMissionCount !== null
                ? ` · ${firestoreMissionCount} misiones en tiempo real`
                : ''}
            </p>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Inicia sesión con tu cuenta de Google para trabajar con Drive, Docs, Sheets y Slides y mantener tus misiones sincronizadas.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {user && (
            <>
              <button
                type="button"
                disabled={syncBusy}
                onClick={handleSaveToCloud}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-3.5 py-2 min-h-[40px] text-xs font-semibold transition-colors"
              >
                <CloudUpload className="w-4 h-4" aria-hidden="true" />
                <span>Guardar en la nube</span>
              </button>
              <button
                type="button"
                disabled={syncBusy}
                onClick={handleRequestRestoreFromCloud}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors"
              >
                <CloudDownload className="w-4 h-4" aria-hidden="true" />
                <span>Restaurar de la nube</span>
              </button>
            </>
          )}

          {(!user || needsAuth) && (
            <GoogleSignInButton
              onClick={onSignIn}
              disabled={isSigningIn}
              label="Sign in with Google"
            />
          )}

          {user && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 min-h-[40px] text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Salir</span>
            </button>
          )}
        </div>
      </section>

      {/* Pinned Bookmarks */}
      {user && bookmarks.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Accesos rápidos fijados
            </h2>
            <span className="text-xs text-slate-400 tabular-nums">{bookmarks.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {bookmarks.map((bm) => {
              const isSheet =
                bm.kind === 'sheet' ||
                bm.mimeType === 'application/vnd.google-apps.spreadsheet';
              const isDoc =
                bm.mimeType === 'application/vnd.google-apps.document';
              const isSlide =
                bm.mimeType === 'application/vnd.google-apps.presentation';

              return (
                <div
                  key={bm.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isSheet) {
                        setSubTab('sheets');
                        setSelectedSpreadsheetId(bm.externalId);
                      } else if (isDoc) {
                        setSubTab('docs');
                        setSelectedDocId(bm.externalId);
                      } else if (isSlide) {
                        setSubTab('slides');
                        setSelectedPresentationId(bm.externalId);
                      } else {
                        setSubTab('drive');
                        setDriveQuery(bm.name);
                      }
                    }}
                    className="flex items-center gap-2 min-w-0 text-left flex-1"
                  >
                    {isSheet ? (
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : isSlide ? (
                      <Presentation className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                    )}
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {bm.name}
                    </span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {bm.webViewLink && (
                      <a
                        href={bm.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir ${bm.name}`}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleBookmark(
                          bm.kind,
                          isSheet
                            ? 'sheet'
                            : isDoc
                              ? 'doc'
                              : isSlide
                                ? 'slides'
                                : 'drive_file',
                          {
                            id: bm.externalId,
                            name: bm.name,
                            mimeType: bm.mimeType || undefined,
                          }
                        )
                      }
                      aria-label={`Quitar ${bm.name} de fijados`}
                      className="p-1.5 text-amber-500 hover:text-slate-500"
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Workspace Auth Gate */}
      {!user || needsAuth || !accessToken ? (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
          <div className="mx-auto w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <FolderOpen className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {user
                ? 'Autoriza acceso temporal a Google Workspace'
                : 'Conecta Drive, Docs, Sheets y Slides'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {user
                ? 'Por seguridad, el token de acceso a Google Workspace se mantiene únicamente en memoria durante esta sesión. Pulsa el botón para reanudar la conexión.'
                : 'Explora archivos en Drive, lee y edita documentos de Google Docs, gestiona hojas de Google Sheets y genera diapositivas en Google Slides.'}
            </p>
          </div>
          <div className="flex justify-center pt-1">
            <GoogleSignInButton
              onClick={onSignIn}
              disabled={isSigningIn}
              label="Sign in with Google"
            />
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {/* Sub-Tab Selector + Primary Creation Action */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 gap-1">
              <button
                type="button"
                onClick={() => setSubTab('drive')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                  subTab === 'drive'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <FolderOpen className="w-4 h-4" aria-hidden="true" />
                <span>Drive</span>
              </button>
              <button
                type="button"
                onClick={() => setSubTab('docs')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                  subTab === 'docs'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>Docs</span>
              </button>
              <button
                type="button"
                onClick={() => setSubTab('sheets')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                  subTab === 'sheets'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Table2 className="w-4 h-4" aria-hidden="true" />
                <span>Sheets</span>
              </button>
              <button
                type="button"
                onClick={() => setSubTab('slides')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                  subTab === 'slides'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Presentation className="w-4 h-4" aria-hidden="true" />
                <span>Slides</span>
              </button>
            </div>

            {subTab === 'drive' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={driveLoading}
                  onClick={() => handleUploadNewBackup('json')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3.5 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Subir copia JSON</span>
                </button>
                <button
                  type="button"
                  disabled={driveLoading}
                  onClick={() => handleUploadNewBackup('txt')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-60"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Subir backup TXT-1</span>
                </button>
              </div>
            )}

            {subTab === 'sheets' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  placeholder="Nombre de la nueva hoja..."
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs w-56"
                />
                <button
                  type="button"
                  disabled={sheetsLoading}
                  onClick={handleCreateNewSpreadsheet}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Crear hoja</span>
                </button>
              </div>
            )}

            {subTab === 'docs' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Nombre del nuevo documento..."
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs w-56"
                />
                <button
                  type="button"
                  disabled={docsLoading}
                  onClick={handleCreateNewDoc}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Crear Google Doc</span>
                </button>
              </div>
            )}

            {subTab === 'slides' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newPresentationTitle}
                  onChange={(e) => setNewPresentationTitle(e.target.value)}
                  placeholder="Título de la nueva presentación..."
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs w-56"
                />
                <button
                  type="button"
                  disabled={slidesLoading}
                  onClick={handleCreateNewPresentation}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Crear Presentación</span>
                </button>
              </div>
            )}
          </div>

          {/* GOOGLE DRIVE PANEL */}
          {subTab === 'drive' && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadDrive();
                  }}
                  className="flex-1 flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Search
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={driveQuery}
                      onChange={(e) => setDriveQuery(e.target.value)}
                      placeholder="Buscar archivos en Google Drive por nombre..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={driveLoading}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Buscar
                  </button>
                </form>

                <div className="flex items-center gap-2">
                  <select
                    value={driveFilter}
                    onChange={(e) =>
                      setDriveFilter(
                        e.target.value as
                          | 'all'
                          | 'backups'
                          | 'sheets'
                          | 'docs'
                          | 'slides'
                      )
                    }
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="all">Todos los archivos</option>
                    <option value="backups">Backups (.json / .txt)</option>
                    <option value="docs">Google Docs</option>
                    <option value="sheets">Google Sheets</option>
                    <option value="slides">Google Slides</option>
                  </select>

                  <button
                    type="button"
                    onClick={loadDrive}
                    disabled={driveLoading}
                    aria-label="Actualizar lista de Drive"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <RefreshCw
                      className={`w-4 h-4 text-slate-600 dark:text-slate-300 ${
                        driveLoading ? 'animate-spin' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {driveFiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  {driveLoading
                    ? 'Cargando archivos de Google Drive...'
                    : 'No se encontraron archivos con el filtro actual.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 pr-4 font-semibold">Archivo</th>
                        <th className="py-2.5 px-3 font-semibold">Tipo</th>
                        <th className="py-2.5 px-3 font-semibold">Tamaño</th>
                        <th className="py-2.5 px-3 font-semibold">Modificado</th>
                        <th className="py-2.5 pl-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {driveFiles.map((file) => {
                        const isSheet =
                          file.mimeType ===
                          'application/vnd.google-apps.spreadsheet';
                        const isDoc =
                          file.mimeType === 'application/vnd.google-apps.document';
                        const isSlide =
                          file.mimeType ===
                          'application/vnd.google-apps.presentation';
                        const isTextOrJson =
                          file.mimeType === 'application/json' ||
                          file.mimeType === 'text/plain' ||
                          file.name.endsWith('.json') ||
                          file.name.endsWith('.txt');
                        const isPinned = bookmarkedIds.has(file.id);

                        return (
                          <tr
                            key={file.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                          >
                            <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-slate-100 max-w-[260px] truncate">
                              {file.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {formatMimeLabel(file.mimeType)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                              {file.modifiedTime
                                ? new Date(file.modifiedTime).toLocaleDateString(
                                    'es-ES'
                                  )
                                : '—'}
                            </td>
                            <td className="py-2.5 pl-3">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {isDoc && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubTab('docs');
                                      setSelectedDocId(file.id);
                                    }}
                                    className="rounded border border-sky-200 dark:border-sky-900/60 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                                  >
                                    Abrir en Docs
                                  </button>
                                )}
                                {isSheet && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubTab('sheets');
                                      setSelectedSpreadsheetId(file.id);
                                    }}
                                    className="rounded border border-emerald-200 dark:border-emerald-900/60 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  >
                                    Abrir en Sheets
                                  </button>
                                )}
                                {isSlide && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubTab('slides');
                                      setSelectedPresentationId(file.id);
                                    }}
                                    className="rounded border border-amber-200 dark:border-amber-900/60 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  >
                                    Abrir en Slides
                                  </button>
                                )}
                                {isTextOrJson && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handlePrepareImportFromDrive(file)
                                      }
                                      className="rounded border border-sky-200 dark:border-sky-900/60 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                                    >
                                      Importar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmAction({
                                          kind: 'overwrite_drive_file',
                                          file,
                                          format: file.name
                                            .toLowerCase()
                                            .endsWith('.txt')
                                            ? 'txt'
                                            : 'json',
                                        })
                                      }
                                      className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                      Sobrescribir
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleBookmark(
                                      isSheet ? 'sheet' : 'drive_file',
                                      isSheet
                                        ? 'sheet'
                                        : isDoc
                                          ? 'doc'
                                          : isSlide
                                            ? 'slides'
                                            : 'drive_file',
                                      file
                                    )
                                  }
                                  aria-label={
                                    isPinned ? 'Quitar fijado' : 'Fijar archivo'
                                  }
                                  className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                    isPinned
                                      ? 'text-amber-500'
                                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                  }`}
                                >
                                  {isPinned ? (
                                    <BookmarkCheck className="w-3.5 h-3.5" />
                                  ) : (
                                    <Bookmark className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                {file.webViewLink && (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Ver ${file.name} en Drive`}
                                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmAction({
                                      kind: 'delete_drive_file',
                                      file,
                                    })
                                  }
                                  aria-label={`Eliminar ${file.name}`}
                                  className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* GOOGLE DOCS PANEL */}
          {subTab === 'docs' && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                    Documento:
                  </label>
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs min-w-[220px] max-w-md"
                  >
                    {docsList.length === 0 && (
                      <option value="">Sin documentos disponibles</option>
                    )}
                    {docsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      loadDocsList();
                      if (selectedDocId) loadSelectedDoc(selectedDocId);
                    }}
                    disabled={docsLoading}
                    aria-label="Actualizar documentos"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <RefreshCw
                      className={`w-4 h-4 text-slate-600 dark:text-slate-300 ${
                        docsLoading ? 'animate-spin' : ''
                      }`}
                    />
                  </button>

                  {docMeta?.webViewLink && (
                    <a
                      href={docMeta.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir en Google Docs</span>
                    </a>
                  )}
                </div>

                {docMeta && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          kind: 'replace_doc_brief',
                          doc: docMeta,
                          newText: buildHorizonteDocBrief,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-semibold"
                    >
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Actualizar con informe Horizonte</span>
                    </button>
                    {docMeta.plainText && (
                      <button
                        type="button"
                        onClick={() => {
                          onAddMemoryFromDoc(docMeta.title, docMeta.plainText);
                          onNotify(
                            `Contenido de "${docMeta.title}" guardado en Memoria.`
                          );
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span>Guardar en Memoria</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!docMeta ? (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  {docsLoading
                    ? 'Cargando documento de Google Docs...'
                    : 'Selecciona un Google Doc existente o crea uno nuevo con el botón superior.'}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 max-h-80 overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                      {docMeta.plainText ||
                        'Este documento está actualmente vacío.'}
                    </pre>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!docAppendText.trim()) {
                        onNotify('Escribe el texto que quieres añadir al documento.', 'warn');
                        return;
                      }
                      setConfirmAction({
                        kind: 'append_doc_text',
                        doc: docMeta,
                        text: docAppendText.trim(),
                      });
                    }}
                    className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800"
                  >
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Añadir nota o sección al final del documento
                    </label>
                    <textarea
                      rows={3}
                      value={docAppendText}
                      onChange={(e) => setDocAppendText(e.target.value)}
                      placeholder="Escribe una actualización, decisión o resumen para añadir al documento..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-xs font-semibold hover:opacity-90"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Añadir al documento</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          )}

          {/* GOOGLE SHEETS PANEL */}
          {subTab === 'sheets' && (
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      Hoja de cálculo:
                    </label>
                    <select
                      value={selectedSpreadsheetId}
                      onChange={(e) => setSelectedSpreadsheetId(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs min-w-[220px] max-w-md"
                    >
                      {spreadsheets.length === 0 && (
                        <option value="">Sin hojas disponibles</option>
                      )}
                      {spreadsheets.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        loadSheetsList();
                        if (selectedSpreadsheetId) {
                          loadSelectedSpreadsheetMeta(selectedSpreadsheetId);
                        }
                      }}
                      disabled={sheetsLoading}
                      aria-label="Actualizar hoja"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <RefreshCw
                        className={`w-4 h-4 text-slate-600 dark:text-slate-300 ${
                          sheetsLoading ? 'animate-spin' : ''
                        }`}
                      />
                    </button>

                    {sheetMeta?.spreadsheetUrl && (
                      <a
                        href={sheetMeta.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir en Google</span>
                      </a>
                    )}
                  </div>

                  {sheetMeta && selectedSheetTitle && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmAction({
                            kind: 'export_sheet_overwrite',
                            spreadsheet: sheetMeta,
                            sheetTitle: selectedSheetTitle,
                            rows: buildExportRows,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-semibold"
                      >
                        <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Exportar Misiones y Tareas</span>
                      </button>

                      {sheetValues.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const tasksToImport: Omit<
                              TaskItem,
                              'id' | 'createdAt'
                            >[] = [];
                            for (const row of sheetValues.slice(1)) {
                              const title = (row[1] || row[0] || '').trim();
                              if (!title) continue;
                              const statusStr = (row[3] || '').toLowerCase();
                              tasksToImport.push({
                                titulo: title,
                                quadrant: 'hacer',
                                done:
                                  statusStr.includes('complet') ||
                                  statusStr === 'done' ||
                                  statusStr === 'hecha',
                                energyCost: 'medio',
                              });
                            }
                            if (tasksToImport.length === 0) {
                              onNotify(
                                'No se encontraron filas válidas para importar.',
                                'warn'
                              );
                              return;
                            }
                            onAddTasksFromSheet(tasksToImport);
                            onNotify(
                              `${tasksToImport.length} elementos importados como tareas.`
                            );
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <span>Importar filas como Tareas</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sheet Tabs */}
                {sheetMeta && sheetMeta.sheets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                      Pestañas:
                    </span>
                    {sheetMeta.sheets.map((tab) => (
                      <button
                        key={tab.sheetId}
                        type="button"
                        onClick={() => handleSelectSheetTab(tab.title)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedSheetTitle === tab.title
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {tab.title}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sheet Preview Grid */}
                {!sheetMeta ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    {sheetsLoading
                      ? 'Cargando hoja de Google Sheets...'
                      : 'Selecciona o crea una hoja de cálculo para ver y editar sus datos.'}
                  </div>
                ) : sheetValues.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    La pestaña &ldquo;{selectedSheetTitle}&rdquo; está vacía. Puedes exportar tus Misiones y Tareas o añadir una fila nueva abajo.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs tabular-nums">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-3 text-slate-400 font-mono w-10">#</th>
                          {sheetValues[0].map((cell, idx) => (
                            <th
                              key={idx}
                              className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                            >
                              {cell || `Col ${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sheetValues.slice(1).map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                          >
                            <td className="py-2 px-3 text-slate-400 font-mono">
                              {rIdx + 2}
                            </td>
                            {sheetValues[0].map((_, cIdx) => (
                              <td
                                key={cIdx}
                                className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-[240px] truncate"
                              >
                                {row[cIdx] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Append Row Form */}
                {sheetMeta && selectedSheetTitle && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!rowTitle.trim()) {
                        onNotify(
                          'Escribe un título antes de añadir la fila.',
                          'warn'
                        );
                        return;
                      }
                      setConfirmAction({
                        kind: 'append_sheet_row',
                        spreadsheet: sheetMeta,
                        sheetTitle: selectedSheetTitle,
                        row: [
                          rowCategory,
                          rowTitle.trim(),
                          'Horizonte OS',
                          rowStatus,
                          'Normal',
                          rowNote.trim(),
                          new Date().toISOString().slice(0, 10),
                        ],
                      });
                    }}
                    className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                  >
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Tipo
                      </label>
                      <select
                        value={rowCategory}
                        onChange={(e) => setRowCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
                      >
                        <option value="Misión">Misión</option>
                        <option value="Tarea">Tarea</option>
                        <option value="Registro">Registro</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Título / Concepto
                      </label>
                      <input
                        type="text"
                        value={rowTitle}
                        onChange={(e) => setRowTitle(e.target.value)}
                        placeholder="Nueva entrada para Google Sheets..."
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Estado
                      </label>
                      <input
                        type="text"
                        value={rowStatus}
                        onChange={(e) => setRowStatus(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Nota
                      </label>
                      <input
                        type="text"
                        value={rowNote}
                        onChange={(e) => setRowNote(e.target.value)}
                        placeholder="Opcional..."
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-2 text-xs font-semibold hover:opacity-90"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Añadir fila</span>
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          )}

          {/* GOOGLE SLIDES PANEL */}
          {subTab === 'slides' && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                    Presentación:
                  </label>
                  <select
                    value={selectedPresentationId}
                    onChange={(e) => setSelectedPresentationId(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs min-w-[220px] max-w-md"
                  >
                    {presentationsList.length === 0 && (
                      <option value="">Sin presentaciones disponibles</option>
                    )}
                    {presentationsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      loadPresentationsList();
                      if (selectedPresentationId) {
                        loadSelectedPresentation(selectedPresentationId);
                      }
                    }}
                    disabled={slidesLoading}
                    aria-label="Actualizar presentaciones"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <RefreshCw
                      className={`w-4 h-4 text-slate-600 dark:text-slate-300 ${
                        slidesLoading ? 'animate-spin' : ''
                      }`}
                    />
                  </button>

                  {presentationMeta?.webViewLink && (
                    <a
                      href={presentationMeta.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir en Google Slides</span>
                    </a>
                  )}
                </div>

                {presentationMeta && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {presentationMeta.slides.length} diapositivas
                  </span>
                )}
              </div>

              {!presentationMeta ? (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  {slidesLoading
                    ? 'Cargando presentación de Google Slides...'
                    : 'Selecciona una presentación existente o crea una nueva con el botón superior.'}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {presentationMeta.slides.map((slide) => (
                      <div
                        key={slide.objectId}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2 flex flex-col justify-between min-h-[120px]"
                      >
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 tabular-nums">
                          <span>Diapositiva {slide.slideNumber}</span>
                        </div>
                        {slide.texts.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            Diapositiva sin texto visible
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                              {slide.texts[0]}
                            </div>
                            {slide.texts.slice(1).map((t, i) => (
                              <p
                                key={i}
                                className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-line line-clamp-4"
                              >
                                {t}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Slide Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!slideTitleInput.trim()) {
                        onNotify(
                          'Indica un título para la nueva diapositiva.',
                          'warn'
                        );
                        return;
                      }
                      setConfirmAction({
                        kind: 'add_slide_to_presentation',
                        presentation: presentationMeta,
                        slideTitle: slideTitleInput.trim(),
                        bodyText: slideBodyInput.trim(),
                      });
                    }}
                    className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Añadir nueva diapositiva a &ldquo;{presentationMeta.title}&rdquo;
                      </h3>
                      <select
                        value={slideSourceMissionId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSlideSourceMissionId(id);
                          const mission = state.misiones.find((m) => m.id === id);
                          if (mission) {
                            setSlideTitleInput(mission.titulo);
                            setSlideBodyInput(
                              [
                                `Estado: ${mission.estado} · Prioridad: ${mission.prioridad}`,
                                mission.objetivo ? `Objetivo: ${mission.objetivo}` : '',
                                mission.planA ? `Plan A: ${mission.planA}` : '',
                                mission.siguiente
                                  ? `Siguiente acción: ${mission.siguiente}`
                                  : '',
                              ]
                                .filter(Boolean)
                                .join('\n')
                            );
                          }
                        }}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                      >
                        <option value="">Rellenar desde una Misión...</option>
                        {state.misiones.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.titulo}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      <input
                        type="text"
                        value={slideTitleInput}
                        onChange={(e) => setSlideTitleInput(e.target.value)}
                        placeholder="Título de la diapositiva..."
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <textarea
                        rows={3}
                        value={slideBodyInput}
                        onChange={(e) => setSlideBodyInput(e.target.value)}
                        placeholder="Contenido o puntos clave de la diapositiva..."
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-xs font-semibold hover:opacity-90"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Insertar diapositiva</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Import Choice Modal from Drive */}
      <Modal
        open={Boolean(importChoice)}
        title={`Importar "${importChoice?.file.name || ''}"`}
        onClose={() => setImportChoice(null)}
        maxWidthClass="max-w-md"
      >
        {importChoice && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Elige cómo aplicar este archivo descargado de Google Drive a tu espacio actual de Horizonte OS:
            </p>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] font-mono text-slate-600 dark:text-slate-400 max-h-36 overflow-y-auto">
              {importChoice.text.slice(0, 400)}
              {importChoice.text.length > 400 ? '...' : ''}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportChoice(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onImportData(importChoice.text, importChoice.file.name, 'merge');
                  setImportChoice(null);
                }}
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-semibold"
              >
                Fusionar con datos actuales
              </button>
              <button
                type="button"
                onClick={() => {
                  onImportData(importChoice.text, importChoice.file.name, 'replace');
                  setImportChoice(null);
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-semibold"
              >
                Reemplazar estado
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Mandatory Explicit Confirmation Modal for Every Mutating/Destructive Action */}
      <Modal
        open={Boolean(confirmAction)}
        title="Confirmar operación"
        onClose={() => {
          if (!mutating) setConfirmAction(null);
        }}
        maxWidthClass="max-w-md"
      >
        {confirmAction && (
          <div className="space-y-4">
            {confirmAction.kind === 'delete_drive_file' && (
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-red-600 dark:text-red-400">
                  ¿Eliminar este archivo de tu Google Drive?
                </p>
                <p>
                  Se eliminará permanentemente el archivo{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.file.name}
                  </span>
                  . Esta acción modificará tu cuenta de Google Drive.
                </p>
              </div>
            )}

            {confirmAction.kind === 'overwrite_drive_file' && (
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  ¿Sobrescribir el contenido de este archivo en Google Drive?
                </p>
                <p>
                  El archivo{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.file.name}
                  </span>{' '}
                  se actualizará con la copia {confirmAction.format.toUpperCase()} actual de Horizonte OS.
                </p>
              </div>
            )}

            {confirmAction.kind === 'export_sheet_overwrite' && (
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  ¿Escribir {confirmAction.rows.length} filas en Google Sheets?
                </p>
                <p>
                  Se sobrescribirán las celdas desde <span className="font-mono">A1</span> en la pestaña{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.sheetTitle}
                  </span>{' '}
                  del documento{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.spreadsheet.title}
                  </span>
                  .
                </p>
              </div>
            )}

            {confirmAction.kind === 'append_sheet_row' && (
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  ¿Añadir una fila a Google Sheets?
                </p>
                <p>
                  Se insertará al final de la pestaña{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.sheetTitle}
                  </span>{' '}
                  en{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.spreadsheet.title}
                  </span>
                  :
                </p>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono text-[11px] break-all">
                  {confirmAction.row.filter(Boolean).join(' · ')}
                </div>
              </div>
            )}

            {confirmAction.kind === 'append_doc_text' && (
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  ¿Añadir texto al documento de Google Docs?
                </p>
                <p>
                  Se insertará al final de{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.doc.title}
                  </span>
                  :
                </p>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-[11px] max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {confirmAction.text}
                </div>
              </div>
            )}

            {confirmAction.kind === 'replace_doc_brief' && (
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  ¿Reemplazar el contenido de Google Docs?
                </p>
                <p>
                  Se reemplazará el cuerpo actual de{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.doc.title}
                  </span>{' '}
                  con el informe completo actual de Misiones y Memoria de Horizonte OS.
                </p>
              </div>
            )}

            {confirmAction.kind === 'add_slide_to_presentation' && (
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  ¿Insertar una nueva diapositiva en Google Slides?
                </p>
                <p>
                  Se creará una diapositiva en{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.presentation.title}
                  </span>{' '}
                  con el título{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmAction.slideTitle}
                  </span>
                  .
                </p>
              </div>
            )}

            {confirmAction.kind === 'restore_cloud_snapshot' && (
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  ¿Restaurar el estado guardado en la nube?
                </p>
                <p>
                  Esto reemplazará tus misiones, tareas, memoria y biblioteca locales actuales con la última copia sincronizada
                  {confirmAction.updatedAt
                    ? ` (${new Date(confirmAction.updatedAt).toLocaleString('es-ES')})`
                    : ''}
                  .
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={mutating}
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={mutating}
                onClick={executeConfirmedAction}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
                  confirmAction.kind === 'delete_drive_file'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {mutating ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
