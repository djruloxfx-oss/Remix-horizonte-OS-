import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { horizonteProfiles, users, workspaceBookmarks } from './schema.ts';
import { getOrCreateUser } from './users.ts';

export interface BookmarkInput {
  kind: 'drive_file' | 'sheet';
  externalId: string;
  name: string;
  mimeType?: string | null;
  webViewLink?: string | null;
}

export async function getUserHorizonteSnapshot(uid: string) {
  try {
    const rows = await db
      .select({
        id: horizonteProfiles.id,
        version: horizonteProfiles.version,
        missionsCount: horizonteProfiles.missionsCount,
        tasksCount: horizonteProfiles.tasksCount,
        snapshotJson: horizonteProfiles.snapshotJson,
        updatedAt: horizonteProfiles.updatedAt,
      })
      .from(horizonteProfiles)
      .innerJoin(users, eq(horizonteProfiles.userId, users.id))
      .where(eq(users.uid, uid))
      .limit(1);

    return rows[0] || null;
  } catch (error) {
    console.error('Failed to fetch Horizonte snapshot:', error);
    throw new Error('Unable to load cloud state.', { cause: error });
  }
}

export async function upsertUserHorizonteSnapshot(
  uid: string,
  email: string,
  displayName: string | null | undefined,
  snapshot: Record<string, unknown>
) {
  try {
    const user = await getOrCreateUser(uid, email, displayName);
    const version =
      typeof snapshot.version === 'string' && snapshot.version
        ? snapshot.version
        : '19.4';
    const missionsCount = Array.isArray(snapshot.misiones)
      ? snapshot.misiones.length
      : 0;
    const tasksCount = Array.isArray(snapshot.tareas)
      ? snapshot.tareas.length
      : 0;
    const now = new Date();

    const result = await db
      .insert(horizonteProfiles)
      .values({
        userId: user.id,
        version,
        missionsCount,
        tasksCount,
        snapshotJson: snapshot,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: horizonteProfiles.userId,
        set: {
          version,
          missionsCount,
          tasksCount,
          snapshotJson: snapshot,
          updatedAt: now,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to save Horizonte snapshot:', error);
    throw new Error('Unable to save cloud state.', { cause: error });
  }
}

export async function listWorkspaceBookmarks(uid: string) {
  try {
    return await db
      .select({
        id: workspaceBookmarks.id,
        kind: workspaceBookmarks.kind,
        externalId: workspaceBookmarks.externalId,
        name: workspaceBookmarks.name,
        mimeType: workspaceBookmarks.mimeType,
        webViewLink: workspaceBookmarks.webViewLink,
        lastSyncedAt: workspaceBookmarks.lastSyncedAt,
      })
      .from(workspaceBookmarks)
      .innerJoin(users, eq(workspaceBookmarks.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(workspaceBookmarks.lastSyncedAt));
  } catch (error) {
    console.error('Failed to list workspace bookmarks:', error);
    throw new Error('Unable to load pinned items.', { cause: error });
  }
}

export async function upsertWorkspaceBookmark(
  uid: string,
  email: string,
  displayName: string | null | undefined,
  input: BookmarkInput
) {
  try {
    const user = await getOrCreateUser(uid, email, displayName);
    const now = new Date();

    const rows = await db
      .insert(workspaceBookmarks)
      .values({
        userId: user.id,
        kind: input.kind,
        externalId: input.externalId,
        name: input.name,
        mimeType: input.mimeType || null,
        webViewLink: input.webViewLink || null,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          workspaceBookmarks.userId,
          workspaceBookmarks.kind,
          workspaceBookmarks.externalId,
        ],
        set: {
          name: input.name,
          mimeType: input.mimeType || null,
          webViewLink: input.webViewLink || null,
          lastSyncedAt: now,
        },
      })
      .returning();

    return rows[0];
  } catch (error) {
    console.error('Failed to save workspace bookmark:', error);
    throw new Error('Unable to save pinned item.', { cause: error });
  }
}

export async function deleteWorkspaceBookmark(uid: string, bookmarkId: number) {
  try {
    const userRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    const user = userRows[0];
    if (!user) return false;

    const deleted = await db
      .delete(workspaceBookmarks)
      .where(
        and(
          eq(workspaceBookmarks.id, bookmarkId),
          eq(workspaceBookmarks.userId, user.id)
        )
      )
      .returning({ id: workspaceBookmarks.id });

    return deleted.length > 0;
  } catch (error) {
    console.error('Failed to delete workspace bookmark:', error);
    throw new Error('Unable to remove pinned item.', { cause: error });
  }
}
