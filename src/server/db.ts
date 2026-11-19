import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ADAPTER_SOURCES } from '../shared/catalog.js';
import { normalizeModel } from '../shared/normalizer.js';
import {
  BenchmarkScoreRecord,
  SourceStatusRecord,
  SyncRunLog,
} from '../shared/types.js';

export class BenchmarkDatabase {
  private db: DatabaseSync;
  private snapshotPath: string;

  constructor(dbPath?: string, snapshotPath?: string) {
    const resolvedDbPath =
      dbPath || process.env.SQLITE_DB_PATH || './data/comparativo_llms.db';
    this.snapshotPath =
      snapshotPath ||
      process.env.JSON_SNAPSHOT_PATH ||
      './data/latest-snapshot.json';

    if (resolvedDbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });
    }
    fs.mkdirSync(path.dirname(this.snapshotPath), { recursive: true });

    this.db = new DatabaseSync(resolvedDbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS benchmark_scores (
        id TEXT PRIMARY KEY,
        benchmark_id TEXT NOT NULL,
        model_canonical_id TEXT NOT NULL,
        model_display_name TEXT NOT NULL,
        provider TEXT NOT NULL,
        effort TEXT NOT NULL,
        effort_label TEXT NOT NULL,
        raw_model_name TEXT NOT NULL,
        raw_score REAL NOT NULL,
        normalized_score REAL NOT NULL,
        display_score TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        origin_type TEXT NOT NULL,
        reported_at TEXT,
        updated_at TEXT NOT NULL,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_scores_benchmark ON benchmark_scores(benchmark_id);
      CREATE INDEX IF NOT EXISTS idx_scores_model ON benchmark_scores(model_canonical_id);
      CREATE INDEX IF NOT EXISTS idx_scores_provider ON benchmark_scores(provider);

      CREATE TABLE IF NOT EXISTS source_statuses (
        source_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        official_url TEXT NOT NULL,
        endpoint_url TEXT NOT NULL,
        status TEXT NOT NULL,
        records_count INTEGER NOT NULL,
        last_sync_at TEXT,
        last_success_at TEXT,
        duration_ms INTEGER NOT NULL,
        technical_reason TEXT NOT NULL,
        http_status INTEGER
      );

      CREATE TABLE IF NOT EXISTS sync_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        total_sources INTEGER NOT NULL,
        live_sources INTEGER NOT NULL,
        partial_sources INTEGER NOT NULL,
        unavailable_sources INTEGER NOT NULL,
        manual_sources INTEGER NOT NULL,
        total_scores_upserted INTEGER NOT NULL,
        models_discovered INTEGER NOT NULL,
        providers_discovered INTEGER NOT NULL,
        summary_message TEXT NOT NULL
      );
    `);

    // Seed initial source statuses if empty
    const countRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM source_statuses')
      .get() as { cnt: number };
    if (countRow.cnt === 0) {
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO source_statuses (
          source_id, name, official_url, endpoint_url, status, records_count,
          last_sync_at, last_success_at, duration_ms, technical_reason, http_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const src of ADAPTER_SOURCES) {
        insertStmt.run(
          src.id,
          src.name,
          src.officialUrl,
          src.endpointUrl,
          'unavailable',
          0,
          null,
          null,
          0,
          'Aguardando primeira execução do agendador determinístico.',
          null
        );
      }
    }
  }

  public upsertScores(scores: BenchmarkScoreRecord[]): number {
    if (scores.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT INTO benchmark_scores (
        id, benchmark_id, model_canonical_id, model_display_name, provider,
        effort, effort_label, raw_model_name, raw_score, normalized_score,
        display_score, source_id, source_url, origin_type, reported_at,
        updated_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        model_display_name = excluded.model_display_name,
        provider = excluded.provider,
        effort_label = excluded.effort_label,
        raw_model_name = excluded.raw_model_name,
        raw_score = CASE
          WHEN benchmark_scores.origin_type = 'manual' AND excluded.origin_type = 'live'
          THEN benchmark_scores.raw_score
          ELSE excluded.raw_score
        END,
        normalized_score = CASE
          WHEN benchmark_scores.origin_type = 'manual' AND excluded.origin_type = 'live'
          THEN benchmark_scores.normalized_score
          ELSE excluded.normalized_score
        END,
        display_score = CASE
          WHEN benchmark_scores.origin_type = 'manual' AND excluded.origin_type = 'live'
          THEN benchmark_scores.display_score
          ELSE excluded.display_score
        END,
        source_id = CASE
          WHEN benchmark_scores.origin_type = 'manual' AND excluded.origin_type = 'live'
          THEN benchmark_scores.source_id
          ELSE excluded.source_id
        END,
        source_url = CASE
          WHEN benchmark_scores.origin_type = 'manual' AND excluded.origin_type = 'live'
          THEN benchmark_scores.source_url
          ELSE excluded.source_url
        END,
        origin_type = CASE
          WHEN benchmark_scores.origin_type = 'manual' AND excluded.origin_type = 'live'
          THEN 'manual'
          ELSE excluded.origin_type
        END,
        reported_at = COALESCE(excluded.reported_at, benchmark_scores.reported_at),
        updated_at = excluded.updated_at,
        metadata_json = COALESCE(excluded.metadata_json, benchmark_scores.metadata_json)
    `);

    this.db.exec('BEGIN');
    try {
      for (const s of scores) {
        stmt.run(
          s.id,
          s.benchmarkId,
          s.modelCanonicalId,
          s.modelDisplayName,
          s.provider,
          s.effort,
          s.effortLabel,
          s.rawModelName,
          s.rawScore,
          s.normalizedScore,
          s.displayScore,
          s.sourceId,
          s.sourceUrl,
          s.originType,
          s.reportedAt ?? null,
          s.updatedAt,
          s.metadata ? JSON.stringify(s.metadata) : null
        );
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return scores.length;
  }

  public upsertSourceStatus(status: SourceStatusRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO source_statuses (
        source_id, name, official_url, endpoint_url, status, records_count,
        last_sync_at, last_success_at, duration_ms, technical_reason, http_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id) DO UPDATE SET
        name = excluded.name,
        official_url = excluded.official_url,
        endpoint_url = excluded.endpoint_url,
        status = excluded.status,
        records_count = excluded.records_count,
        last_sync_at = excluded.last_sync_at,
        last_success_at = COALESCE(excluded.last_success_at, source_statuses.last_success_at),
        duration_ms = excluded.duration_ms,
        technical_reason = excluded.technical_reason,
        http_status = excluded.http_status
    `);

    stmt.run(
      status.sourceId,
      status.name,
      status.officialUrl,
      status.endpointUrl,
      status.status,
      status.recordsCount,
      status.lastSyncAt,
      status.lastSuccessAt,
      status.durationMs,
      status.technicalReason,
      status.httpStatus ?? null
    );
  }

  public insertSyncRun(run: Omit<SyncRunLog, 'id'>): SyncRunLog {
    const stmt = this.db.prepare(`
      INSERT INTO sync_runs (
        started_at, completed_at, trigger_type, total_sources,
        live_sources, partial_sources, unavailable_sources, manual_sources,
        total_scores_upserted, models_discovered, providers_discovered, summary_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      run.startedAt,
      run.completedAt,
      run.trigger,
      run.totalSources,
      run.liveSources,
      run.partialSources,
      run.unavailableSources,
      run.manualSources,
      run.totalScoresUpserted,
      run.modelsDiscovered,
      run.providersDiscovered,
      run.summaryMessage
    );

    return {
      id: Number(info.lastInsertRowid),
      ...run,
    };
  }

  public getAllScores(): BenchmarkScoreRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM benchmark_scores ORDER BY normalized_score DESC')
      .all() as any[];

    return rows.map((r) => {
      const normalized = normalizeModel(
        r.raw_model_name || r.model_display_name,
        r.provider === 'Outros / Independente' ? null : r.provider,
        r.effort
      );
      const useCanonical =
        r.provider === 'Outros / Independente' ||
        normalized.provider !== r.provider;

      return {
        id: r.id,
        benchmarkId: r.benchmark_id,
        modelCanonicalId: useCanonical
          ? normalized.canonicalId
          : r.model_canonical_id,
        modelDisplayName: useCanonical
          ? normalized.displayName
          : r.model_display_name,
        provider: normalized.provider,
        effort: r.effort,
        effortLabel: r.effort_label,
        rawModelName: r.raw_model_name,
        rawScore: r.raw_score,
        normalizedScore: r.normalized_score,
        displayScore: r.display_score,
        sourceId: r.source_id,
        sourceUrl: r.source_url,
        originType: r.origin_type,
        reportedAt: r.reported_at ?? undefined,
        updatedAt: r.updated_at,
        metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
      };
    });
  }

  public getManualCountsBySource(): Map<string, number> {
    const rows = this.db
      .prepare(
        "SELECT source_id, COUNT(*) as cnt FROM benchmark_scores WHERE origin_type = 'manual' GROUP BY source_id"
      )
      .all() as Array<{ source_id: string; cnt: number }>;
    return new Map(rows.map((r) => [r.source_id, Number(r.cnt)]));
  }

  public getSourceStatuses(): SourceStatusRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM source_statuses ORDER BY source_id ASC')
      .all() as any[];

    return rows.map((r) => ({
      sourceId: r.source_id,
      name: r.name,
      officialUrl: r.official_url,
      endpointUrl: r.endpoint_url,
      status: r.status,
      recordsCount: r.records_count,
      lastSyncAt: r.last_sync_at,
      lastSuccessAt: r.last_success_at,
      durationMs: r.duration_ms,
      technicalReason: r.technical_reason,
      httpStatus: r.http_status,
    }));
  }

  public getRecentSyncRuns(limit = 20): SyncRunLog[] {
    const rows = this.db
      .prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?')
      .all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      trigger: r.trigger_type,
      totalSources: r.total_sources,
      liveSources: r.live_sources,
      partialSources: r.partial_sources,
      unavailableSources: r.unavailable_sources,
      manualSources: r.manual_sources,
      totalScoresUpserted: r.total_scores_upserted,
      modelsDiscovered: r.models_discovered,
      providersDiscovered: r.providers_discovered,
      summaryMessage: r.summary_message,
    }));
  }

  public deleteManualScores(benchmarkId?: string): number {
    if (benchmarkId) {
      const res = this.db
        .prepare(
          "DELETE FROM benchmark_scores WHERE origin_type = 'manual' AND benchmark_id = ?"
        )
        .run(benchmarkId);
      return Number(res.changes);
    }
    const res = this.db
      .prepare("DELETE FROM benchmark_scores WHERE origin_type = 'manual'")
      .run();
    return Number(res.changes);
  }

  public exportJsonSnapshot(): void {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        sources: this.getSourceStatuses(),
        recentRuns: this.getRecentSyncRuns(10),
        scoresCount: this.getAllScores().length,
      };
      fs.writeFileSync(
        this.snapshotPath,
        JSON.stringify(payload, null, 2),
        'utf-8'
      );
    } catch {
      // Non-fatal in read-only or memory environments
    }
  }

  public close(): void {
    this.db.close();
  }
}
