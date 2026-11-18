import { SyncRunLog } from '../shared/types.js';
import {
  AdapterExecutionResult,
  runAllDeterministicAdapters,
} from './adapters.js';
import { BenchmarkDatabase } from './db.js';

export type SyncEventListener = (run: SyncRunLog) => void;

export class DeterministicScheduler {
  private db: BenchmarkDatabase;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private nextRunAt: string | null = null;
  private listeners = new Set<SyncEventListener>();
  private adapterRunner: (
    manualCounts: Map<string, number>
  ) => Promise<AdapterExecutionResult[]>;

  constructor(
    db: BenchmarkDatabase,
    intervalMs = 300000,
    customAdapterRunner?: (
      manualCounts: Map<string, number>
    ) => Promise<AdapterExecutionResult[]>
  ) {
    this.db = db;
    // Enforce default 5 minutes (300000 ms)
    this.intervalMs = intervalMs > 0 ? intervalMs : 300000;
    this.adapterRunner = customAdapterRunner ?? runAllDeterministicAdapters;
  }

  public getIntervalMs(): number {
    return this.intervalMs;
  }

  public getNextRunAt(): string | null {
    return this.nextRunAt;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public onSyncCompleted(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public start(runImmediately = true): void {
    if (this.timer) return;

    this.scheduleNextTimestamp();
    this.timer = setInterval(() => {
      this.scheduleNextTimestamp();
      void this.executeSync('scheduler');
    }, this.intervalMs);

    if (runImmediately) {
      void this.executeSync('startup');
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.nextRunAt = null;
    }
  }

  private scheduleNextTimestamp(): void {
    this.nextRunAt = new Date(Date.now() + this.intervalMs).toISOString();
  }

  public async executeSync(
    trigger: 'scheduler' | 'manual' | 'startup' | 'import' = 'manual'
  ): Promise<SyncRunLog> {
    if (this.isSyncing) {
      const recent = this.db.getRecentSyncRuns(1);
      if (recent.length > 0) return recent[0];
    }

    this.isSyncing = true;
    const startedAt = new Date().toISOString();

    try {
      const manualCounts = this.db.getManualCountsBySource();
      const adapterResults = await this.adapterRunner(manualCounts);

      let totalUpserted = 0;
      let liveSources = 0;
      let partialSources = 0;
      let unavailableSources = 0;
      let manualSources = 0;

      for (const res of adapterResults) {
        if (res.scores.length > 0) {
          totalUpserted += this.db.upsertScores(res.scores);
        }
        this.db.upsertSourceStatus(res.statusRecord);

        if (res.statusRecord.status === 'live') liveSources++;
        else if (res.statusRecord.status === 'partial') partialSources++;
        else if (res.statusRecord.status === 'manual') manualSources++;
        else unavailableSources++;
      }

      const allScores = this.db.getAllScores();
      const uniqueModels = new Set(allScores.map((s) => s.modelCanonicalId));
      const uniqueProviders = new Set(allScores.map((s) => s.provider));

      const completedAt = new Date().toISOString();
      const runLog = this.db.insertSyncRun({
        startedAt,
        completedAt,
        trigger,
        totalSources: adapterResults.length,
        liveSources,
        partialSources,
        unavailableSources,
        manualSources,
        totalScoresUpserted: totalUpserted,
        modelsDiscovered: uniqueModels.size,
        providersDiscovered: uniqueProviders.size,
        summaryMessage: `Sincronização (${trigger}) concluída: ${liveSources} fontes live, ${partialSources} parciais, ${manualSources} manuais, ${unavailableSources} sem feed público. ${uniqueModels.size} modelos e ${uniqueProviders.size} provedores descobertos (${allScores.length} pontuações totais).`,
      });

      this.db.exportJsonSnapshot();

      for (const listener of this.listeners) {
        try {
          listener(runLog);
        } catch {
          // ignore listener error
        }
      }

      return runLog;
    } finally {
      this.isSyncing = false;
    }
  }
}