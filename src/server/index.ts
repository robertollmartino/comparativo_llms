import cors from 'cors';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADAPTER_SOURCES,
  BENCHMARKS,
  EFFORT_LABELS,
  USE_CASES,
  WEIGHT_PRESETS,
} from '../shared/catalog.js';
import { BenchmarkDatabase } from './db.js';
import { parseManualImportPayload } from './parsers.js';
import { DeterministicScheduler } from './scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(
  customDb?: BenchmarkDatabase,
  customScheduler?: DeterministicScheduler
) {
  const db = customDb ?? new BenchmarkDatabase();
  const intervalMs = Number(process.env.SYNC_INTERVAL_MS || 300000);
  const scheduler =
    customScheduler ?? new DeterministicScheduler(db, intervalMs);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  const sseClients = new Set<Response>();

  scheduler.onSyncCompleted((runLog) => {
    const payload = JSON.stringify({ type: 'sync_completed', runLog });
    for (const client of sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      nodeVersion: process.version,
      intervalMs: scheduler.getIntervalMs(),
      isSyncing: scheduler.getIsSyncing(),
      nextRunAt: scheduler.getNextRunAt(),
    });
  });

  app.get('/api/state', (_req: Request, res: Response) => {
    const scores = db.getAllScores();
    const sources = db.getSourceStatuses();
    const syncRuns = db.getRecentSyncRuns(25);

    const providersSet = new Set<string>();
    const modelsMap = new Map<
      string,
      {
        canonicalId: string;
        displayName: string;
        provider: string;
        efforts: string[];
        benchmarksCount: number;
      }
    >();

    for (const s of scores) {
      if (s.modelCanonicalId === 'human') continue;
      providersSet.add(s.provider);
      let m = modelsMap.get(s.modelCanonicalId);
      if (!m) {
        m = {
          canonicalId: s.modelCanonicalId,
          displayName: s.modelDisplayName,
          provider: s.provider,
          efforts: [],
          benchmarksCount: 0,
        };
        modelsMap.set(s.modelCanonicalId, m);
      }
      if (!m.efforts.includes(s.effort)) {
        m.efforts.push(s.effort);
      }
      m.benchmarksCount++;
    }

    res.json({
      useCases: USE_CASES,
      benchmarks: BENCHMARKS,
      adapterSources: ADAPTER_SOURCES,
      weightPresets: WEIGHT_PRESETS,
      effortLabels: EFFORT_LABELS,
      scores,
      sources,
      syncRuns,
      discoveredProviders: Array.from(providersSet).sort(),
      discoveredModels: Array.from(modelsMap.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
      scheduler: {
        intervalMs: scheduler.getIntervalMs(),
        nextRunAt: scheduler.getNextRunAt(),
        isSyncing: scheduler.getIsSyncing(),
      },
    });
  });

  app.post('/api/sync', async (_req: Request, res: Response) => {
    try {
      const runLog = await scheduler.executeSync('manual');
      res.json({ ok: true, runLog });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'Erro durante sincronização determinística',
      });
    }
  });

  app.post('/api/import', (req: Request, res: Response) => {
    try {
      const { format, content, defaultBenchmarkId } = req.body || {};
      if (
        (format !== 'json' && format !== 'csv') ||
        typeof content !== 'string' ||
        !content.trim()
      ) {
        res.status(400).json({
          ok: false,
          error:
            'Informe format ("json" ou "csv") e o conteúdo não vazio para importação determinística.',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const parsedScores = parseManualImportPayload(
        format,
        content,
        defaultBenchmarkId,
        nowIso
      );

      if (parsedScores.length === 0) {
        res.status(400).json({
          ok: false,
          error:
            'Nenhum registro válido encontrado. Verifique se benchmarkId, model e score estão preenchidos e se o benchmarkId existe no catálogo.',
        });
        return;
      }

      const upserted = db.upsertScores(parsedScores);
      const manualCounts = db.getManualCountsBySource();
      const existingStatuses = db.getSourceStatuses();

      for (const st of existingStatuses) {
        const mCount = manualCounts.get(st.sourceId) ?? 0;
        if (mCount > 0 && st.status === 'unavailable') {
          db.upsertSourceStatus({
            ...st,
            status: 'manual',
            recordsCount: mCount,
            lastSyncAt: nowIso,
            lastSuccessAt: nowIso,
            technicalReason: `Importação manual determinística ativa (${mCount} pontuações importadas via ${format.toUpperCase()}).`,
          });
        } else if (mCount > 0) {
          db.upsertSourceStatus({
            ...st,
            recordsCount: Math.max(st.recordsCount, mCount),
            lastSyncAt: nowIso,
          });
        }
      }

      const allScores = db.getAllScores();
      const uniqueModels = new Set(allScores.map((s) => s.modelCanonicalId));
      const uniqueProviders = new Set(allScores.map((s) => s.provider));
      const updatedStatuses = db.getSourceStatuses();

      const runLog = db.insertSyncRun({
        startedAt: nowIso,
        completedAt: new Date().toISOString(),
        trigger: 'import',
        totalSources: updatedStatuses.length,
        liveSources: updatedStatuses.filter((s) => s.status === 'live').length,
        partialSources: updatedStatuses.filter((s) => s.status === 'partial').length,
        unavailableSources: updatedStatuses.filter((s) => s.status === 'unavailable')
          .length,
        manualSources: updatedStatuses.filter((s) => s.status === 'manual').length,
        totalScoresUpserted: upserted,
        modelsDiscovered: uniqueModels.size,
        providersDiscovered: uniqueProviders.size,
        summaryMessage: `Importação manual (${format.toUpperCase()}) concluída: ${upserted} pontuações registradas sem uso de IA.`,
      });

      db.exportJsonSnapshot();

      const payload = JSON.stringify({ type: 'sync_completed', runLog });
      for (const client of sseClients) {
        try {
          client.write(`data: ${payload}\n\n`);
        } catch {
          sseClients.delete(client);
        }
      }

      res.json({
        ok: true,
        importedCount: upserted,
        scores: parsedScores,
        runLog,
      });
    } catch (err: any) {
      res.status(400).json({
        ok: false,
        error: `Falha ao processar arquivo de importação: ${
          err?.message || String(err)
        }`,
      });
    }
  });

  app.delete('/api/import', (req: Request, res: Response) => {
    const benchmarkId =
      typeof req.query.benchmarkId === 'string'
        ? req.query.benchmarkId
        : undefined;
    const deleted = db.deleteManualScores(benchmarkId);
    db.exportJsonSnapshot();
    res.json({ ok: true, deletedCount: deleted });
  });

  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        intervalMs: scheduler.getIntervalMs(),
        nextRunAt: scheduler.getNextRunAt(),
      })}\n\n`
    );

    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Serve static frontend in production / after build
  const candidateDistDirs = [
    path.resolve(process.cwd(), 'dist/client'),
    path.resolve(__dirname, '../../client'),
  ];
  const clientDist = candidateDistDirs.find((d) =>
    fs.existsSync(path.join(d, 'index.html'))
  );

  if (clientDist) {
    app.use(express.static(clientDist));
    app.use((req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Endpoint não encontrado' });
        return;
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return { app, db, scheduler };
}

// Start server if invoked directly
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('server/index.ts') ||
    process.argv[1].endsWith('server/index.js'));

if (isMain) {
  const port = Number(process.env.PORT || 3000);
  const { app, scheduler } = createApp();
  scheduler.start(true);
  app.listen(port, () => {
    console.log(
      `[Comparativo LLMs] Servidor iniciado em http://localhost:${port} (Agendador determinístico a cada ${scheduler.getIntervalMs()} ms)`
    );
  });
}