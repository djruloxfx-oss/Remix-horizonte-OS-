import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to sync user record:', error);
    throw new Error('Unable to synchronize user profile.', { cause: error });
  }
}
