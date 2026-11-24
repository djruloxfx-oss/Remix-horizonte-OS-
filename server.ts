import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  deleteWorkspaceBookmark,
  getUserHorizonteSnapshot,
  listWorkspaceBookmarks,
  upsertUserHorizonteSnapshot,
  upsertWorkspaceBookmark,
} from './src/db/horizonteRepo.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const email = req.user?.email || '';
      const displayName =
        typeof req.user?.name === 'string' ? req.user.name : null;

      const user = await getOrCreateUser(uid, email, displayName);
      res.json({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to load profile.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const [snapshot, bookmarks] = await Promise.all([
        getUserHorizonteSnapshot(uid),
        listWorkspaceBookmarks(uid),
      ]);
      res.json({
        state: snapshot ? snapshot.snapshotJson : null,
        updatedAt: snapshot ? snapshot.updatedAt : null,
        bookmarks,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to fetch cloud state.';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const body = req.body as { state?: unknown };
      if (!body || typeof body.state !== 'object' || body.state === null || Array.isArray(body.state)) {
        res.status(400).json({ error: 'Invalid state payload.' });
        return;
      }

      const email = req.user?.email || '';
      const displayName =
        typeof req.user?.name === 'string' ? req.user.name : null;

      const saved = await upsertUserHorizonteSnapshot(
        uid,
        email,
        displayName,
        body.state as Record<string, unknown>
      );

      res.json({
        ok: true,
        updatedAt: saved.updatedAt,
        missionsCount: saved.missionsCount,
        tasksCount: saved.tasksCount,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to save cloud state.';
      res.status(500).json({ error: message });
    }
  });

  app.get(
    '/api/workspace/bookmarks',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const uid = req.user?.uid;
        if (!uid) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        const bookmarks = await listWorkspaceBookmarks(uid);
        res.json({ bookmarks });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unable to load bookmarks.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.post(
    '/api/workspace/bookmarks',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const uid = req.user?.uid;
        if (!uid) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        const { kind, externalId, name, mimeType, webViewLink } = (req.body ||
          {}) as Record<string, unknown>;

        if (
          (kind !== 'drive_file' && kind !== 'sheet') ||
          typeof externalId !== 'string' ||
          !externalId.trim() ||
          typeof name !== 'string' ||
          !name.trim()
        ) {
          res.status(400).json({ error: 'Invalid bookmark payload.' });
          return;
        }

        const email = req.user?.email || '';
        const displayName =
          typeof req.user?.name === 'string' ? req.user.name : null;

        const saved = await upsertWorkspaceBookmark(uid, email, displayName, {
          kind,
          externalId: externalId.trim().slice(0, 256),
          name: name.trim().slice(0, 256),
          mimeType: typeof mimeType === 'string' ? mimeType.slice(0, 128) : null,
          webViewLink:
            typeof webViewLink === 'string' &&
            webViewLink.startsWith('https://')
              ? webViewLink.slice(0, 512)
              : null,
        });

        res.status(201).json({ bookmark: saved });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unable to save bookmark.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.delete(
    '/api/workspace/bookmarks/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const uid = req.user?.uid;
        if (!uid) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isFinite(id) || id <= 0) {
          res.status(400).json({ error: 'Invalid bookmark ID.' });
          return;
        }
        const removed = await deleteWorkspaceBookmark(uid, id);
        if (!removed) {
          res.status(404).json({ error: 'Bookmark not found.' });
          return;
        }
        res.json({ ok: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unable to delete bookmark.';
        res.status(500).json({ error: message });
      }
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: { server: httpServer },
        ws: { server: httpServer },
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Horizonte OS server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
