import { relations } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const horizonteProfiles = pgTable('horizonte_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  version: text('version').notNull().default('19.4'),
  missionsCount: integer('missions_count').notNull().default(0),
  tasksCount: integer('tasks_count').notNull().default(0),
  snapshotJson: jsonb('snapshot_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaceBookmarks = pgTable(
  'workspace_bookmarks',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    kind: text('kind').notNull(), // 'drive_file' | 'sheet'
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    mimeType: text('mime_type'),
    webViewLink: text('web_view_link'),
    lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('workspace_bookmarks_user_ext_idx').on(
      table.userId,
      table.kind,
      table.externalId
    ),
  ]
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(horizonteProfiles, {
    fields: [users.id],
    references: [horizonteProfiles.userId],
  }),
  bookmarks: many(workspaceBookmarks),
}));

export const horizonteProfilesRelations = relations(
  horizonteProfiles,
  ({ one }) => ({
    owner: one(users, {
      fields: [horizonteProfiles.userId],
      references: [users.id],
    }),
  })
);

export const workspaceBookmarksRelations = relations(
  workspaceBookmarks,
  ({ one }) => ({
    owner: one(users, {
      fields: [workspaceBookmarks.userId],
      references: [users.id],
    }),
  })
);
