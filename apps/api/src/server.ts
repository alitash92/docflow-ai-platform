import express from 'express';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { IncomingDoc } from './types.js';
import { mockDeps, realDeps, realModeEnabled, runPipeline } from './pipeline/graph.js';
import { mockChannels } from './ingest/channels.js';
import { computeKpis } from './metrics/kpi.service.js';
import { AUTO_ROUTE_THRESHOLD } from './pipeline/router.js';
import { detectFormat } from './ingest/format-detector.js';

const PORT = Number(process.env.PORT ?? 4810);
const WEB_DIST = new URL('../../web/dist', import.meta.url).pathname;
const REAL_MODE = realModeEnabled();
const MAX_UPLOAD_MB = 50;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 } });

/** Wrap multer so size/parse errors return a clean JSON 4xx instead of a 500. */
const uploadSingle = (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      const tooBig = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooBig ? 413 : 400).json({
        error: tooBig
          ? `File too large — maximum ${MAX_UPLOAD_MB} MB. Please upload a smaller PDF or image.`
          : `Upload failed: ${(err as Error).message}`,
        mode: REAL_MODE ? 'real' : 'mock',
      });
    }
    next();
  });
};

const postDocSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  source: z.enum(['email', 'sms', 'upload']),
  sender: z.string().default('api'),
  pages: z.number().int().positive().default(1),
  bytesHex: z.string().regex(/^[0-9a-fA-F]*$/).default('25504446'),
  extractText: z.string().min(1),
  patient: z.string().default('Synthetic patient (no real PHI)'),
});

async function main() {
  const deps = await mockDeps();

  // Boot: drain the mock inbound channels and run every fixture document
  // through the full pipeline. The dashboard renders these results.
  for (const channel of mockChannels()) {
    for (const doc of await channel.fetch()) {
      await runPipeline(doc, deps);
    }
  }

  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mode: REAL_MODE ? 'real' : 'mock', threshold: AUTO_ROUTE_THRESHOLD });
  });

  app.get('/api/kpis', (_req, res) => {
    res.json(computeKpis());
  });

  app.get('/api/documents', async (_req, res) => {
    res.json(await deps.store.listRuns());
  });

  app.get('/api/documents/:id', async (req, res) => {
    const run = await deps.store.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'unknown document' });
    res.json(run);
  });

  // Raw per-engine OCR candidates for a fixture document — lets the /demo page
  // show the dual-engine merge honestly (layout engine vs vision engine, side by
  // side, before the field-level reconcile). Mock engines replay committed fixtures.
  app.get('/api/documents/:id/engines', async (req, res) => {
    const [{ MockLayoutEngine, MockVisionEngine }, { loadSeedFixtures }] = await Promise.all([
      import('./ocr/mock-ocr.engine.js'),
      import('./ingest/channels.js'),
    ]);
    const seed = loadSeedFixtures().find((f) => f.id === req.params.id);
    if (!seed) return res.status(404).json({ error: 'unknown document' });
    const [layout, vision] = await Promise.all([
      new MockLayoutEngine().extract(seed),
      new MockVisionEngine().extract(seed),
    ]);
    res.json({ docId: seed.id, layoutEngine: layout, visionEngine: vision });
  });

  app.get('/api/documents/:id/checkpoints', async (req, res) => {
    res.json(
      (await deps.store.checkpointsFor(req.params.id)).map(({ docId, stage, at }) => ({
        docId,
        stage,
        at,
      })),
    );
  });

  app.get('/api/review', async (_req, res) => {
    res.json(await deps.store.reviewQueue());
  });

  // Ingest a new document through the live pipeline (mock engines).
  app.post('/api/documents', async (req, res) => {
    const parsed = postDocSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const doc: IncomingDoc = { receivedAgoMin: 0, ...parsed.data };
    const state = await runPipeline(doc, deps);
    res.status(201).json(state);
  });

  // Real-mode upload: a real file is run through the live pipeline (frontier
  // vision LLM for ingest + classify/judge/repair). Only available when a real
  // key is configured; otherwise returns a clear 501 explaining mock mode.
  app.post('/api/documents/upload', uploadSingle, async (req, res) => {
    if (!REAL_MODE) {
      return res.status(501).json({
        error:
          'Real-mode upload requires OPENAI_API_KEY and MOCK_MODE=false. This instance is ' +
          'running the key-free mock demo — uploads are processed from committed fixtures only.',
        mode: 'mock',
      });
    }
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded. Send multipart/form-data field "file".' });
    }
    try {
      const { ingestWithVision } = await import('./ocr/openai-vision.ingest.js');
      const ingest = await ingestWithVision({
        buffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
      const deps = await realDeps(ingest.fields);
      const bytesHex = file.buffer.subarray(0, 8).toString('hex');
      const doc: IncomingDoc = {
        id: `upload-${randomUUID().slice(0, 8)}`,
        fileName: file.originalname,
        source: 'upload',
        sender: 'portal upload',
        pages: ingest.pages,
        receivedAgoMin: 0,
        bytesHex,
        extractText: ingest.text || file.originalname,
        patient: 'Uploaded document (synthetic test data)',
      };
      // Sanity: format detector still drives the ingest stage display.
      void detectFormat(bytesHex, file.originalname);
      const state = await runPipeline(doc, deps);
      res.status(201).json(state);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'real-mode extraction failed';
      // Never echo any key fragment the upstream provider may include in errors.
      const message = raw.replace(/sk-[A-Za-z0-9*_-]+/g, 'sk-***');
      res.status(502).json({ error: message, mode: 'real' });
    }
  });

  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
    app.get('*', (_req, res) => res.sendFile(`${WEB_DIST}/index.html`));
  } else {
    app.get('/', (_req, res) =>
      res
        .type('text/plain')
        .send('DocFlow AI API is up. Run `npm run build` to serve the dashboard, or use /api/*.'),
    );
  }

  app.listen(PORT, () => {
    console.log(`DocFlow AI · ${REAL_MODE ? 'REAL mode (live vision LLM)' : 'mock mode'} · http://localhost:${PORT}`);
    console.log(`  dashboard: http://localhost:${PORT}/  (after npm run build)`);
    console.log(`  api:       http://localhost:${PORT}/api/kpis`);
    if (REAL_MODE) console.log(`  upload:    POST http://localhost:${PORT}/api/documents/upload  (multipart field "file")`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
