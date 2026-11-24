import { getIdToken } from '../lib/firebase';
import type { HorizonteState, WorkspaceBookmark } from '../types/horizonte';

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Debes iniciar sesión con Google para sincronizar.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }
  return res;
}

export async function syncAuthProfile(): Promise<{
  uid: string;
  email: string;
  displayName: string | null;
}> {
  const res = await apiFetch('/api/me');
  return res.json();
}

export async function fetchCloudSnapshot(): Promise<{
  state: Partial<HorizonteState> | null;
  updatedAt: string | null;
  bookmarks: WorkspaceBookmark[];
}> {
  const res = await apiFetch('/api/sync');
  return res.json();
}

export async function saveCloudSnapshot(state: HorizonteState): Promise<{
  ok: boolean;
  updatedAt: string;
}> {
  const res = await apiFetch('/api/sync', {
    method: 'PUT',
    body: JSON.stringify({ state }),
  });
  return res.json();
}

export async function addWorkspaceBookmark(bookmark: {
  kind: 'drive_file' | 'sheet';
  externalId: string;
  name: string;
  mimeType?: string | null;
  webViewLink?: string | null;
}): Promise<WorkspaceBookmark> {
  const res = await apiFetch('/api/workspace/bookmarks', {
    method: 'POST',
    body: JSON.stringify(bookmark),
  });
  const data = (await res.json()) as { bookmark: WorkspaceBookmark };
  return data.bookmark;
}

export async function removeWorkspaceBookmark(id: number): Promise<void> {
  await apiFetch(`/api/workspace/bookmarks/${id}`, {
    method: 'DELETE',
  });
}
