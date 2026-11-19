export type EffortLevel =
  | 'default'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'thinking'
  | 'non-thinking';

export type SourceStatus = 'live' | 'partial' | 'unavailable' | 'manual';

export interface UseCaseDefinition {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  description: string;
  practicalContext: string;
  brazilianCaveat?: string;
  primaryBenchmarkIds: string[];
  substituteBenchmarkIds: string[];
}

export interface BenchmarkDefinition {
  id: string;
  name: string;
  shortName: string;
  useCaseIds: string[];
  isSubstitute: boolean;
  substituteForIds?: string[];
  substituteEquivalenceExplanation?: string;
  officialUrl: string;
  adapterSourceId: string;
  unit: string;
  minScore: number;
  maxScore: number;
  higherIsBetter: boolean;
  whatItTests: string;
  practicalExplanation: string;
  jurisdictionNote?: string;
  isBrazilianSpecific?: boolean;
}

export interface AdapterSourceDefinition {
  id: string;
  name: string;
  officialUrl: string;
  endpointUrl: string;
  description: string;
  benchmarkIds: string[];
  supportsManualImport: boolean;
}

export interface NormalizedModelInfo {
  canonicalId: string;
  displayName: string;
  provider: string;
  effort: EffortLevel;
  effortLabel: string;
  rawModelName: string;
  rawProvider?: string;
  isOpenWeights?: boolean;
  releaseDate?: string;
}

export interface BenchmarkScoreRecord {
  id: string;
  benchmarkId: string;
  modelCanonicalId: string;
  modelDisplayName: string;
  provider: string;
  effort: EffortLevel;
  effortLabel: string;
  rawModelName: string;
  rawScore: number;
  normalizedScore: number; // 0 to 100
  displayScore: string;
  sourceId: string;
  sourceUrl: string;
  originType: 'live' | 'manual';
  reportedAt?: string;
  updatedAt: string;
  metadata?: {
    costUsd?: number | null;
    priceInput1M?: number | null;
    priceOutput1M?: number | null;
    outputSpeedTokensPerSec?: number | null;
    ttftSeconds?: number | null;
    agentScaffold?: string | null;
    confidenceInterval?: string | null;
    subscores?: Record<string, number> | null;
    notes?: string | null;
  };
}

export interface SourceStatusRecord {
  sourceId: string;
  name: string;
  officialUrl: string;
  endpointUrl: string;
  status: SourceStatus;
  recordsCount: number;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  durationMs: number;
  technicalReason: string;
  httpStatus?: number | null;
}

export interface SyncRunLog {
  id: number;
  startedAt: string;
  completedAt: string;
  trigger: 'scheduler' | 'manual' | 'startup' | 'import';
  totalSources: number;
  liveSources: number;
  partialSources: number;
  unavailableSources: number;
  manualSources: number;
  totalScoresUpserted: number;
  modelsDiscovered: number;
  providersDiscovered: number;
  summaryMessage: string;
}

export interface WeightPreset {
  id: string;
  name: string;
  description: string;
  weights: Record<string, number>; // useCaseId -> weight (0..100)
}

export interface ResolvedBenchmarkCell {
  benchmarkId: string;
  benchmarkName: string;
  rawScore: number;
  normalizedScore: number;
  displayScore: string;
  effort: EffortLevel;
  effortLabel: string;
  isSubstitute: boolean;
  substitutedBenchmarkId?: string;
  substitutedBenchmarkName?: string;
  substituteExplanation?: string;
  sourceUrl: string;
  originType: 'live' | 'manual';
  updatedAt: string;
  metadata?: BenchmarkScoreRecord['metadata'];
}

export interface ModelUseCaseScore {
  useCaseId: string;
  useCaseNumber: number;
  useCaseTitle: string;
  score: number | null; // 0..100
  primaryAvailableCount: number;
  primaryTotalCount: number;
  usedSubstituteCount: number;
  cells: ResolvedBenchmarkCell[];
}

export interface RankedModelEntry {
  modelCanonicalId: string;
  displayName: string;
  provider: string;
  selectedEffort: EffortLevel;
  availableEfforts: EffortLevel[];
  overallScore: number; // 0..100
  useCasesCovered: number; // X of 7
  totalUseCases: number; // 7
  primaryBenchmarksCovered: number; // Y
  totalPrimaryBenchmarks: number; // Z
  substituteBenchmarksUsed: number;
  isFrontier?: boolean;
  useCaseScores: Record<string, ModelUseCaseScore>;
  telemetry?: {
    priceInput1M?: number | null;
    priceOutput1M?: number | null;
    outputSpeedTokensPerSec?: number | null;
    ttftSeconds?: number | null;
    aaIntelligenceIndex?: number | null;
  };
}

export interface BenchmarkRankingRow {
  rank: number;
  modelCanonicalId: string;
  displayName: string;
  provider: string;
  effort: EffortLevel;
  effortLabel: string;
  rawScore: number;
  normalizedScore: number;
  displayScore: string;
  originType: 'live' | 'manual';
  sourceUrl: string;
  updatedAt: string;
  isFrontier: boolean;
}

export interface BenchmarkRankingTable {
  benchmarkId: string;
  benchmarkName: string;
  shortName: string;
  useCaseIds: string[];
  useCaseNumbers: number[];
  useCaseLabels: string[];
  isSubstitute: boolean;
  substituteForIds?: string[];
  officialUrl: string;
  whatItTests: string;
  practicalExplanation: string;
  higherIsBetter: boolean;
  isBrazilianSpecific?: boolean;
  rows: BenchmarkRankingRow[];
}

export interface BenchmarkFrontierDiagnostic {
  benchmarkId: string;
  benchmarkName: string;
  shortName: string;
  isSubstitute: boolean;
  qualified: boolean;
  totalDistinctModels: number;
  frontierModelsCount: number;
  frontierProvidersCount: number;
  majorFrontierLabsCount: number;
  majorFrontierLabs: string[];
  reason: string;
}
