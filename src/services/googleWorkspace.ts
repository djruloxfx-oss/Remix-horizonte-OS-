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
    filter?: 'all' | 'backups' | 'sheets';
    pageSize?: number;
  } = {}
): Promise<DriveFileItem[]> {
  const clauses: string[] = ['trashed = false'];
  if (options.filter === 'sheets') {
    clauses.push("mimeType = 'application/vnd.google-apps.spreadsheet'");
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
