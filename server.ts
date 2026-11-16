import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleExtractDocumentRequest,
  handleLoginRequest,
  verifySessionToken,
} from './server/core.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/login', (req, res) => {
    const { password } = (req.body || {}) as { password?: string };
    const result = handleLoginRequest(password);
    res.status(result.status).json(result.body);
  });

  app.get('/api/auth/verify', (req, res) => {
    const sessionHeader = req.headers['x-session-token'];
    const token = typeof sessionHeader === 'string' ? sessionHeader : undefined;
    if (!verifySessionToken(token)) {
      res.status(401).json({ ok: false });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/extract-document', async (req, res) => {
    const sessionHeader = req.headers['x-session-token'];
    const result = await handleExtractDocumentRequest({
      sessionToken: typeof sessionHeader === 'string' ? sessionHeader : undefined,
      authHeader: req.headers.authorization,
      body: (req.body || {}) as {
        fileBase64?: string;
        mimeType?: string;
        fileName?: string;
        hintTipoDocumento?: string;
      },
    });
    res.status(result.status).json(result.body);
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`El Nathan Transportes server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
