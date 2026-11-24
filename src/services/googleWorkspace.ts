export class WorkspaceAuthError extends Error {
  constructor(message = 'Sesión de Google Workspace expirada o no autorizada.') {
    super(message);
    this.name = 'WorkspaceAuthError';
  }
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export interface SheetTabMeta {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabMeta[];
}

export interface GoogleDocSummary {
  documentId: string;
  title: string;
  plainText: string;
  endIndex: number;
  webViewLink: string;
}

export interface GoogleSlidePage {
  objectId: string;
  slideNumber: number;
  texts: string[];
}

export interface GooglePresentationSummary {
  presentationId: string;
  title: string;
  slides: GoogleSlidePage[];
  webViewLink: string;
}

async function workspaceFetch(
  url: string,
  accessToken: string | null,
  init: RequestInit = {}
): Promise<Response> {
  if (!accessToken) {
    throw new WorkspaceAuthError('Conecta tu cuenta de Google para continuar.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    throw new WorkspaceAuthError('El token de Google Workspace ha caducado. Vuelve a iniciar sesión.');
  }

  if (!response.ok) {
    let detail = `Error HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as {
        error?: { message?: string };
      };
      if (errBody?.error?.message) {
        detail = errBody.error.message;
      }
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(detail);
  }

  return response;
}

function escapeDriveQueryValue(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function listDriveFiles(
  accessToken: string | null,
  options: {
    query?: string;
    filter?: 'all' | 'backups' | 'sheets' | 'docs' | 'slides';
    pageSize?: number;
  } = {}
): Promise<DriveFileItem[]> {
  const clauses: string[] = ['trashed = false'];
  if (options.filter === 'sheets') {
    clauses.push("mimeType = 'application/vnd.google-apps.spreadsheet'");
  } else if (options.filter === 'docs') {
    clauses.push("mimeType = 'application/vnd.google-apps.document'");
  } else if (options.filter === 'slides') {
    clauses.push("mimeType = 'application/vnd.google-apps.presentation'");
  } else if (options.filter === 'backups') {
    clauses.push(
      "(mimeType = 'application/json' or mimeType = 'text/plain' or name contains 'horizonte')"
    );
  }

  const trimmed = options.query?.trim();
  if (trimmed) {
    clauses.push(`name contains '${escapeDriveQueryValue(trimmed)}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    pageSize: String(options.pageSize ?? 30),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
  });

  const res = await workspaceFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as { files?: DriveFileItem[] };
  return data.files || [];
}

export async function downloadDriveFileText(
  accessToken: string | null,
  fileId: string,
  mimeType?: string
): Promise<string> {
  const isGoogleDoc = mimeType === 'application/vnd.google-apps.document';
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;

  const res = await workspaceFetch(url, accessToken);
  return res.text();
}

export async function createDriveTextFile(
  accessToken: string | null,
  name: string,
  content: string,
  mimeType = 'application/json'
): Promise<DriveFileItem> {
  const boundary = `horizonte_${crypto.randomUUID().replace(/-/g, '')}`;
  const metadata = JSON.stringify({ name, mimeType });
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}; charset=UTF-8`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await workspaceFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  return (await res.json()) as DriveFileItem;
}

export async function updateDriveTextFile(
  accessToken: string | null,
  fileId: string,
  content: string,
  mimeType = 'application/json'
): Promise<DriveFileItem> {
  const res = await workspaceFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,mimeType,modifiedTime,size,webViewLink`,
    accessToken,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': `${mimeType}; charset=UTF-8`,
      },
      body: content,
    }
  );
  return (await res.json()) as DriveFileItem;
}

export async function deleteDriveFile(
  accessToken: string | null,
  fileId: string
): Promise<void> {
  await workspaceFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}

// ---------- GOOGLE SHEETS ----------

export async function listSpreadsheets(
  accessToken: string | null,
  query?: string
): Promise<DriveFileItem[]> {
  return listDriveFiles(accessToken, {
    query,
    filter: 'sheets',
    pageSize: 30,
  });
}

export async function getSpreadsheetMeta(
  accessToken: string | null,
  spreadsheetId: string
): Promise<SpreadsheetMeta> {
  const params = new URLSearchParams({
    fields:
      'spreadsheetId,spreadsheetUrl,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))',
  });
  const res = await workspaceFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: {
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }[];
  };

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Sin título',
    spreadsheetUrl: data.spreadsheetUrl,
    sheets: (data.sheets || []).map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || `Hoja ${idx + 1}`,
      rowCount: s.properties?.gridProperties?.rowCount,
      columnCount: s.properties?.gridProperties?.columnCount,
    })),
  };
}

export async function readSheetRange(
  accessToken: string | null,
  spreadsheetId: string,
  sheetTitle: string,
  cellRange = 'A1:Z40'
): Promise<string[][]> {
  const fullRange = `${escapeSheetTitle(sheetTitle)}!${cellRange}`;
  const res = await workspaceFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(fullRange)}`,
    accessToken
  );
  const data = (await res.json()) as { values?: string[][] };
  return data.values || [];
}

export async function createSpreadsheet(
  accessToken: string | null,
  title: string,
  initialTabTitle = 'Horizonte'
): Promise<SpreadsheetMeta> {
  const res = await workspaceFetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: initialTabTitle } }],
      }),
    }
  );
  const created = (await res.json()) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: {
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }[];
  };

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title || title,
    spreadsheetUrl: created.spreadsheetUrl,
    sheets: (created.sheets || []).map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || initialTabTitle,
      rowCount: s.properties?.gridProperties?.rowCount,
      columnCount: s.properties?.gridProperties?.columnCount,
    })),
  };
}

export async function updateSheetValues(
  accessToken: string | null,
  spreadsheetId: string,
  sheetTitle: string,
  startCell: string,
  values: (string | number | boolean)[][]
): Promise<{ updatedRows?: number; updatedCells?: number }> {
  const fullRange = `${escapeSheetTitle(sheetTitle)}!${startCell}`;
  const res = await workspaceFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(fullRange)}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: fullRange,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );
  return (await res.json()) as { updatedRows?: number; updatedCells?: number };
}

export async function appendSheetRows(
  accessToken: string | null,
  spreadsheetId: string,
  sheetTitle: string,
  range = 'A:Z',
  values: (string | number | boolean)[][]
): Promise<void> {
  const fullRange = `${escapeSheetTitle(sheetTitle)}!${range}`;
  await workspaceFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(fullRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values,
      }),
    }
  );
}

// ---------- GOOGLE DOCS ----------

export async function listGoogleDocs(
  accessToken: string | null,
  query?: string
): Promise<DriveFileItem[]> {
  return listDriveFiles(accessToken, {
    query,
    filter: 'docs',
    pageSize: 30,
  });
}

interface DocsStructuralElement {
  endIndex?: number;
  paragraph?: {
    elements?: {
      textRun?: { content?: string };
    }[];
  };
  table?: {
    tableRows?: {
      tableCells?: {
        content?: DocsStructuralElement[];
      }[];
    }[];
  };
}

function extractTextFromDocsElements(elements: DocsStructuralElement[] = []): string {
  const chunks: string[] = [];
  for (const el of elements) {
    if (el.paragraph?.elements) {
      const line = el.paragraph.elements
        .map((pe) => pe.textRun?.content || '')
        .join('');
      if (line) chunks.push(line);
    } else if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        const cellTexts = (row.tableCells || []).map((cell) =>
          extractTextFromDocsElements(cell.content || []).trim()
        );
        if (cellTexts.some(Boolean)) {
          chunks.push(`${cellTexts.join(' | ')}\n`);
        }
      }
    }
  }
  return chunks.join('');
}

export async function getGoogleDoc(
  accessToken: string | null,
  documentId: string
): Promise<GoogleDocSummary> {
  const res = await workspaceFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
    accessToken
  );
  const data = (await res.json()) as {
    documentId: string;
    title?: string;
    body?: { content?: DocsStructuralElement[] };
  };
  const content = data.body?.content || [];
  const lastEl = content[content.length - 1];
  const endIndex = lastEl?.endIndex ?? 1;
  return {
    documentId: data.documentId,
    title: data.title || 'Documento sin título',
    plainText: extractTextFromDocsElements(content).trim(),
    endIndex,
    webViewLink: `https://docs.google.com/document/d/${encodeURIComponent(data.documentId)}/edit`,
  };
}

export async function createGoogleDoc(
  accessToken: string | null,
  title: string,
  initialBodyText?: string
): Promise<GoogleDocSummary> {
  const res = await workspaceFetch(
    'https://docs.googleapis.com/v1/documents',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    }
  );
  const created = (await res.json()) as {
    documentId: string;
    title?: string;
  };

  if (initialBodyText && initialBodyText.trim()) {
    await workspaceFetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(created.documentId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: initialBodyText.trim() + '\n',
              },
            },
          ],
        }),
      }
    );
  }

  return getGoogleDoc(accessToken, created.documentId);
}

export async function appendGoogleDocText(
  accessToken: string | null,
  documentId: string,
  textToAppend: string,
  endIndex: number
): Promise<void> {
  const insertAt = Math.max(1, endIndex - 1);
  const normalized = textToAppend.endsWith('\n')
    ? `\n${textToAppend}`
    : `\n${textToAppend}\n`;

  await workspaceFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: insertAt },
              text: normalized,
            },
          },
        ],
      }),
    }
  );
}

export async function replaceGoogleDocText(
  accessToken: string | null,
  documentId: string,
  newText: string,
  currentEndIndex: number
): Promise<void> {
  const requests: Record<string, unknown>[] = [];
  if (currentEndIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: currentEndIndex - 1,
        },
      },
    });
  }
  requests.push({
    insertText: {
      location: { index: 1 },
      text: newText.trimEnd() + '\n',
    },
  });

  await workspaceFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  );
}

// ---------- GOOGLE SLIDES ----------

export async function listGooglePresentations(
  accessToken: string | null,
  query?: string
): Promise<DriveFileItem[]> {
  return listDriveFiles(accessToken, {
    query,
    filter: 'slides',
    pageSize: 30,
  });
}

interface SlidesPageElement {
  shape?: {
    text?: {
      textElements?: {
        textRun?: { content?: string };
      }[];
    };
  };
}

export async function getGooglePresentation(
  accessToken: string | null,
  presentationId: string
): Promise<GooglePresentationSummary> {
  const res = await workspaceFetch(
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`,
    accessToken
  );
  const data = (await res.json()) as {
    presentationId: string;
    title?: string;
    slides?: {
      objectId: string;
      pageElements?: SlidesPageElement[];
    }[];
  };

  const slides: GoogleSlidePage[] = (data.slides || []).map((slide, idx) => {
    const texts: string[] = [];
    for (const pe of slide.pageElements || []) {
      const content = (pe.shape?.text?.textElements || [])
        .map((te) => te.textRun?.content || '')
        .join('')
        .trim();
      if (content) texts.push(content);
    }
    return {
      objectId: slide.objectId,
      slideNumber: idx + 1,
      texts,
    };
  });

  return {
    presentationId: data.presentationId,
    title: data.title || 'Presentación sin título',
    slides,
    webViewLink: `https://docs.google.com/presentation/d/${encodeURIComponent(data.presentationId)}/edit`,
  };
}

export async function createGooglePresentation(
  accessToken: string | null,
  title: string
): Promise<GooglePresentationSummary> {
  const res = await workspaceFetch(
    'https://slides.googleapis.com/v1/presentations',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }
  );
  const created = (await res.json()) as {
    presentationId: string;
  };
  return getGooglePresentation(accessToken, created.presentationId);
}

export async function addSlideWithText(
  accessToken: string | null,
  presentationId: string,
  slideTitle: string,
  bodyText: string
): Promise<void> {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const slideId = `horizonte_slide_${suffix}`;
  const titleId = `horizonte_title_${suffix}`;
  const bodyId = `horizonte_body_${suffix}`;

  const requests: Record<string, unknown>[] = [
    {
      createSlide: {
        objectId: slideId,
        slideLayoutReference: {
          predefinedLayout: 'TITLE_AND_BODY',
        },
        placeholderIdMappings: [
          {
            layoutPlaceholder: { type: 'TITLE', index: 0 },
            objectId: titleId,
          },
          {
            layoutPlaceholder: { type: 'BODY', index: 0 },
            objectId: bodyId,
          },
        ],
      },
    },
    {
      insertText: {
        objectId: titleId,
        insertionIndex: 0,
        text: slideTitle.trim(),
      },
    },
  ];

  if (bodyText.trim()) {
    requests.push({
      insertText: {
        objectId: bodyId,
        insertionIndex: 0,
        text: bodyText.trim(),
      },
    });
  }

  await workspaceFetch(
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  );
}

// ---------- GOOGLE CLASSROOM ----------

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  courseState?: string;
  alternateLink?: string;
}

export interface ClassroomDate {
  year?: number;
  month?: number;
  day?: number;
}

export interface ClassroomCourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  state?: string;
  alternateLink?: string;
  topicId?: string;
  maxPoints?: number;
  dueDate?: ClassroomDate;
  workType?: string;
  updateTime?: string;
}

export interface ClassroomMaterialItem {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  alternateLink?: string;
  topicId?: string;
  updateTime?: string;
}

export interface ClassroomTopic {
  topicId: string;
  courseId: string;
  name: string;
  updateTime?: string;
}

export interface ClassroomAnnouncement {
  id: string;
  courseId: string;
  text: string;
  state?: string;
  alternateLink?: string;
  updateTime?: string;
}

export async function listClassroomCourses(
  accessToken: string | null
): Promise<ClassroomCourse[]> {
  const params = new URLSearchParams({ pageSize: '30' });
  const res = await workspaceFetch(
    `https://classroom.googleapis.com/v1/courses?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as { courses?: ClassroomCourse[] };
  return data.courses || [];
}

export async function listClassroomCourseWork(
  accessToken: string | null,
  courseId: string
): Promise<ClassroomCourseWork[]> {
  const params = new URLSearchParams({ pageSize: '30' });
  const res = await workspaceFetch(
    `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWork?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as { courseWork?: ClassroomCourseWork[] };
  return data.courseWork || [];
}

export async function listClassroomMaterials(
  accessToken: string | null,
  courseId: string
): Promise<ClassroomMaterialItem[]> {
  const params = new URLSearchParams({ pageSize: '30' });
  const res = await workspaceFetch(
    `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWorkMaterials?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as {
    courseWorkMaterial?: ClassroomMaterialItem[];
  };
  return data.courseWorkMaterial || [];
}

export async function listClassroomTopics(
  accessToken: string | null,
  courseId: string
): Promise<ClassroomTopic[]> {
  const params = new URLSearchParams({ pageSize: '50' });
  const res = await workspaceFetch(
    `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/topics?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as { topic?: ClassroomTopic[] };
  return data.topic || [];
}

export async function listClassroomAnnouncements(
  accessToken: string | null,
  courseId: string
): Promise<ClassroomAnnouncement[]> {
  const params = new URLSearchParams({ pageSize: '30' });
  const res = await workspaceFetch(
    `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/announcements?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as {
    announcements?: ClassroomAnnouncement[];
  };
  return data.announcements || [];
}

export async function createClassroomAnnouncement(
  accessToken: string | null,
  courseId: string,
  text: string
): Promise<ClassroomAnnouncement> {
  const res = await workspaceFetch(
    `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/announcements`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        state: 'PUBLISHED',
      }),
    }
  );
  return (await res.json()) as ClassroomAnnouncement;
}
