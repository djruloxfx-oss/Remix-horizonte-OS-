import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Mission, SuperAgentMode } from '../types/horizonte';

export interface FirestoreWorkspaceItem {
  id: string;
  ownerId: string;
  kind: 'drive_file' | 'sheet' | 'doc' | 'slides';
  externalId: string;
  name: string;
  webViewLink: string;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || 'item_1';
}

function clampString(val: string | undefined | null, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

export async function ensureFirestoreUserProfile(
  user: User,
  superAgenteModo: SuperAgentMode = 'modo2'
): Promise<void> {
  if (!user.emailVerified) return;
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        email: clampString(user.email || `${uid}@users.local`, 256),
        displayName: clampString(user.displayName || 'Horizonte User', 160),
        superAgenteModo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        email: clampString(user.email || `${uid}@users.local`, 256),
        displayName: clampString(user.displayName || 'Horizonte User', 160),
        superAgenteModo,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncMissionsToFirestore(
  user: User,
  missions: Mission[],
  superAgenteModo: SuperAgentMode = 'modo2'
): Promise<number> {
  if (!user.emailVerified) return 0;
  await ensureFirestoreUserProfile(user, superAgenteModo);
  const uid = sanitizeId(user.uid);
  let synced = 0;

  for (const m of missions.slice(0, 25)) {
    const missionId = sanitizeId(m.id);
    const path = `users/${uid}/missions/${missionId}`;
    const ref = doc(db, 'users', uid, 'missions', missionId);
    try {
      const existing = await getDoc(ref);
      const payload = {
        titulo: clampString(m.titulo, 200) || 'Misión',
        categoria: clampString(m.categoria || 'General', 80),
        objetivo: clampString(m.objetivo, 2000),
        prioridad: m.prioridad,
        estado: m.estado,
        siguiente: clampString(m.siguiente, 500),
        updatedAt: serverTimestamp(),
      };
      if (!existing.exists()) {
        await setDoc(ref, {
          id: missionId,
          ownerId: uid,
          ...payload,
          createdAt: serverTimestamp(),
        });
      } else if (existing.data()?.estado !== 'Cancelada') {
        await updateDoc(ref, payload);
      }
      synced += 1;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  return synced;
}

export function subscribeFirestoreMissions(
  user: User,
  onData: (count: number) => void
): () => void {
  if (!user.emailVerified) return () => {};
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}/missions`;
  const q = query(
    collection(db, 'users', uid, 'missions'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.size);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function upsertFirestoreWorkspaceItem(
  user: User,
  item: {
    kind: 'drive_file' | 'sheet' | 'doc' | 'slides';
    externalId: string;
    name: string;
    webViewLink?: string;
  }
): Promise<void> {
  if (!user.emailVerified) return;
  await ensureFirestoreUserProfile(user);
  const uid = sanitizeId(user.uid);
  const extId = sanitizeId(item.externalId);
  const itemId = sanitizeId(`${item.kind}_${extId}`);
  const path = `users/${uid}/workspaceItems/${itemId}`;
  const ref = doc(db, 'users', uid, 'workspaceItems', itemId);

  try {
    const existing = await getDoc(ref);
    const safeLink =
      item.webViewLink && item.webViewLink.startsWith('https://')
        ? clampString(item.webViewLink, 512)
        : '';
    if (!existing.exists()) {
      await setDoc(ref, {
        id: itemId,
        ownerId: uid,
        kind: item.kind,
        externalId: extId,
        name: clampString(item.name, 256) || 'Archivo',
        webViewLink: safeLink,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: clampString(item.name, 256) || 'Archivo',
        webViewLink: safeLink,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeFirestoreWorkspaceItem(
  user: User,
  kind: 'drive_file' | 'sheet' | 'doc' | 'slides',
  externalId: string
): Promise<void> {
  if (!user.emailVerified) return;
  const uid = sanitizeId(user.uid);
  const extId = sanitizeId(externalId);
  const itemId = sanitizeId(`${kind}_${extId}`);
  const path = `users/${uid}/workspaceItems/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'workspaceItems', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
