import { BENCHMARK_MAP, BENCHMARKS, USE_CASE_MAP, USE_CASES } from './catalog.js';
import { normalizeProvider } from './normalizer.js';
import {
  BenchmarkFrontierDiagnostic,
  BenchmarkRankingRow,
  BenchmarkRankingTable,
  BenchmarkScoreRecord,
  EffortLevel,
  ModelUseCaseScore,
  RankedModelEntry,
  ResolvedBenchmarkCell,
} from './types.js';

export const MAJOR_FRONTIER_PROVIDERS = new Set<string>([
  'Anthropic',
  'OpenAI',
  'Google',
  'Meta',
]);

const FRONTIER_MODEL_PATTERNS: RegExp[] = [
  // Anthropic 2026 frontier: Claude Fable 5.x, Opus 5.x, Sonnet 5.x, Haiku 5.x, Mythos 5.x
  /\b(?:claude[-\s]*)?(?:fable|mythos|opus|sonnet|haiku)[-\s]*5(?:[.\s-]*\d+)?\b/i,
  // OpenAI 2026 frontier: GPT-6.x, GPT-5.6, GPT-5.5, GPT-5.4, GPT-5.3 Codex
  /\bgpt[-\s]*(?:6(?:[.\s-]*\d+)?|5[.\s-]*6|5[.\s-]*5|5[.\s-]*4|5[.\s-]*3[-\s]*codex)\b/i,
  // Google 2026 frontier: Gemini 4.x, 3.8, 3.7, 3.1 Pro
  /\bgemini[-\s]*(?:4(?:[.\s-]*\d+)?|3[.\s-]*8|3[.\s-]*7|3[.\s-]*1[-\s]*pro)\b/i,
  // Meta 2026 frontier: Muse Wonder, Muse Spark 1.x, Muse Ember
  /\bmuse[-\s]*(?:wonder|spark[-\s]*1(?:[.\s-]*\d+)?|ember)\b/i,
  // DeepSeek 2026 frontier: DeepSeek V4.x
  /\bdeepseek[-\s]*v4(?:[.\s-]*\d+)?\b/i,
  // Moonshot AI 2026 frontier: Kimi K3.x, K2.6
  /\bkimi[-\s]*(?:k?3(?:[.\s-]*\d+)?|k?2[.\s-]*6)\b/i,
  // Alibaba / Qwen 2026 frontier: Qwen 4, Qwen 3.8
  /\bqwen[-\s]*(?:4(?:[.\s-]*\d+)?|3[.\s-]*8)\b/i,
  // Z.AI (Zhipu) 2026 frontier: GLM-5.x
  /\bglm[-\s]*5(?:[.\s-]*\d+)?\b/i,
  // xAI 2026 frontier: Grok 4.x
  /\bgrok[-\s]*4(?:[.\s-]*\d+)?\b/i,
  // Xiaomi 2026 frontier: MiMo-V2.6
  /\bmimo[-\s]*v?2[.\s-]*6\b/i,
  // MiniMax 2026 frontier: MiniMax-M3.x
  /\bminimax[-\s]*m3(?:[.\s-]*\d+|p\d+)?\b/i,
];

export const FRONTIER_MIN_MODELS = 4;
export const FRONTIER_MIN_PROVIDERS = 3;
export const FRONTIER_MIN_MAJOR_LABS = 3;

export function resolveScoreProvider(score: Pick<BenchmarkScoreRecord, 'provider' | 'modelDisplayName' | 'rawModelName'>): string {
  return normalizeProvider(
    score.provider === 'Outros / Independente' ? null : score.provider,
    score.modelDisplayName || score.rawModelName
  );
}

export function isFrontierModel(
  modelCanonicalId: string,
  displayName?: string
): boolean {
  const combined = `${displayName ?? ''} ${modelCanonicalId}`.trim();
  return FRONTIER_MODEL_PATTERNS.some((pattern) => pattern.test(combined));
}

export function evaluateBenchmarkFrontierCoverage(
  allScores: BenchmarkScoreRecord[]
): BenchmarkFrontierDiagnostic[] {
  const byBenchmark = new Map<
    string,
    Map<string, { displayName: string; provider: string }>
  >();

  for (const score of allScores) {
    if (score.modelCanonicalId === 'human') continue;
    let modelsMap = byBenchmark.get(score.benchmarkId);
    if (!modelsMap) {
      modelsMap = new Map();
      byBenchmark.set(score.benchmarkId, modelsMap);
    }
    if (!modelsMap.has(score.modelCanonicalId)) {
      modelsMap.set(score.modelCanonicalId, {
        displayName: score.modelDisplayName,
        provider: resolveScoreProvider(score),
      });
    }
  }

  return BENCHMARKS.map((bench) => {
    const modelsMap = byBenchmark.get(bench.id);
    const totalDistinctModels = modelsMap?.size ?? 0;
    const frontierModels = new Set<string>();
    const frontierProviders = new Set<string>();
    const majorFrontierLabs = new Set<string>();

    if (modelsMap) {
      for (const [modelId, info] of modelsMap.entries()) {
        if (isFrontierModel(modelId, info.displayName)) {
          frontierModels.add(modelId);
          frontierProviders.add(info.provider);
          if (MAJOR_FRONTIER_PROVIDERS.has(info.provider)) {
            majorFrontierLabs.add(info.provider);
          }
        }
      }
    }

    const qualified =
      totalDistinctModels > 0 &&
      frontierModels.size >= FRONTIER_MIN_MODELS &&
      frontierProviders.size >= FRONTIER_MIN_PROVIDERS &&
      majorFrontierLabs.size >= FRONTIER_MIN_MAJOR_LABS;

    let reason: string;
    if (totalDistinctModels === 0) {
      reason = '0 registros coletados (fonte indisponível ou sem importação manual).';
    } else if (frontierModels.size < FRONTIER_MIN_MODELS) {
      reason = `Apenas ${frontierModels.size} modelo(s) atual(is) de fronteira em ${totalDistinctModels} avaliados (mínimo exigido: ${FRONTIER_MIN_MODELS}).`;
    } else if (frontierProviders.size < FRONTIER_MIN_PROVIDERS) {
      reason = `Apenas ${frontierProviders.size} provedor(es) de fronteira distintos (mínimo exigido: ${FRONTIER_MIN_PROVIDERS}).`;
    } else if (majorFrontierLabs.size < FRONTIER_MIN_MAJOR_LABS) {
      reason = `Cobre apenas ${majorFrontierLabs.size}/4 laboratórios principais de fronteira (Anthropic, OpenAI, Google, Meta; mínimo exigido: ${FRONTIER_MIN_MAJOR_LABS}).`;
    } else {
      reason = `Qualificado: ${frontierModels.size} modelos de fronteira em ${frontierProviders.size} provedores (${majorFrontierLabs.size}/4 laboratórios principais).`;
    }

    return {
      benchmarkId: bench.id,
      benchmarkName: bench.name,
      shortName: bench.shortName,
      isSubstitute: bench.isSubstitute,
      qualified,
      totalDistinctModels,
      frontierModelsCount: frontierModels.size,
      frontierProvidersCount: frontierProviders.size,
      majorFrontierLabsCount: majorFrontierLabs.size,
      majorFrontierLabs: Array.from(majorFrontierLabs).sort(),
      reason,
    };
  });
}

export function getFrontierQualifiedBenchmarkIds(
  allScores: BenchmarkScoreRecord[]
): Set<string> {
  const diagnostics = evaluateBenchmarkFrontierCoverage(allScores);
  return new Set(
    diagnostics.filter((d) => d.qualified).map((d) => d.benchmarkId)
  );
}

export function compareRankedModels(
  a: RankedModelEntry,
  b: RankedModelEntry
): number {
  if (b.overallScore !== a.overallScore) {
    return b.overallScore - a.overallScore;
  }
  if (b.primaryBenchmarksCovered !== a.primaryBenchmarksCovered) {
    return b.primaryBenchmarksCovered - a.primaryBenchmarksCovered;
  }
  const aFrontier =
    a.isFrontier ?? isFrontierModel(a.modelCanonicalId, a.displayName) ? 1 : 0;
  const bFrontier =
    b.isFrontier ?? isFrontierModel(b.modelCanonicalId, b.displayName) ? 1 : 0;
  if (bFrontier !== aFrontier) {
    return bFrontier - aFrontier;
  }
  if (b.useCasesCovered !== a.useCasesCovered) {
    return b.useCasesCovered - a.useCasesCovered;
  }
  return a.modelCanonicalId.localeCompare(b.modelCanonicalId);
}

export function limitTopModelsPerProvider(
  entries: RankedModelEntry[],
  maxPerProvider = 4
): RankedModelEntry[] {
  if (maxPerProvider <= 0) return [];
  const sorted = [...entries].sort(compareRankedModels);
  const countByProvider = new Map<string, number>();
  const kept: RankedModelEntry[] = [];

  for (const entry of sorted) {
    const current = countByProvider.get(entry.provider) ?? 0;
    if (current < maxPerProvider) {
      kept.push(entry);
      countByProvider.set(entry.provider, current + 1);
    }
  }

  return kept;
}

export interface RankingOptions {
  weights: Record<string, number>; // useCaseId -> weight (0..100)
  includeSubstitutes: boolean;
  preferredEffort?: EffortLevel | 'best' | 'any';
  modelEffortOverrides?: Record<string, EffortLevel>; // modelCanonicalId -> specific EffortLevel
  providerFilter?: string[];
  selectedModelIds?: string[];
  qualifiedBenchmarkIds?: Set<string>;
  onlyFrontierQualified?: boolean;
  maxModelsPerProvider?: number | null;
}

export interface PerBenchmarkRankingOptions {
  includeSubstitutes: boolean;
  preferredEffort?: EffortLevel | 'best' | 'any';
  modelEffortOverrides?: Record<string, EffortLevel>;
  providerFilter?: string[];
  selectedModelIds?: string[];
  allowedModelIds?: Set<string>;
  qualifiedBenchmarkIds?: Set<string>;
  onlyFrontierQualified?: boolean;
  maxModelsPerProvider?: number | null;
  searchQuery?: string;
}

function selectScoreForModelAndBenchmark(
  records: BenchmarkScoreRecord[],
  preferredEffort: EffortLevel | 'best' | 'any'
): BenchmarkScoreRecord | null {
  if (records.length === 0) return null;

  if (preferredEffort !== 'best' && preferredEffort !== 'any') {
    const exact = records.find((r) => r.effort === preferredEffort);
    if (exact) return exact;
    // If benchmark only publishes 'default' effort, fall back to 'default'
    const def = records.find((r) => r.effort === 'default');
    if (def) return def;
  }

  // Pick the record with highest normalizedScore (preferring newer updatedAt on tie)
  return [...records].sort((a, b) => {
    if (b.normalizedScore !== a.normalizedScore) {
      return b.normalizedScore - a.normalizedScore;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0];
}

export function calculateOverallRanking(
  allScores: BenchmarkScoreRecord[],
  options: RankingOptions
): RankedModelEntry[] {
  const {
    weights,
    includeSubstitutes,
    preferredEffort = 'best',
    modelEffortOverrides = {},
    providerFilter,
    selectedModelIds,
    qualifiedBenchmarkIds,
    onlyFrontierQualified = false,
    maxModelsPerProvider = null,
  } = options;

  const activeQualifiedIds =
    qualifiedBenchmarkIds ??
    (onlyFrontierQualified
      ? getFrontierQualifiedBenchmarkIds(allScores)
      : null);

  const normalizedProviderFilter =
    providerFilter && providerFilter.length > 0
      ? new Set(providerFilter.map((p) => p.trim()))
      : null;

  const selectedIdsSet =
    selectedModelIds && selectedModelIds.length > 0
      ? new Set(selectedModelIds)
      : null;

  // Group all scores by modelCanonicalId -> benchmarkId -> BenchmarkScoreRecord[]
  const byModel = new Map<
    string,
    {
      displayName: string;
      provider: string;
      efforts: Set<EffortLevel>;
      byBenchmark: Map<string, BenchmarkScoreRecord[]>;
      telemetry: RankedModelEntry['telemetry'];
    }
  >();

  for (const score of allScores) {
    // Filter out "Human" baseline from LLM rankings
    if (score.modelCanonicalId === 'human') continue;
    if (activeQualifiedIds && !activeQualifiedIds.has(score.benchmarkId)) {
      continue;
    }

    const resolvedProvider = resolveScoreProvider(score);
    let entry = byModel.get(score.modelCanonicalId);
    if (!entry) {
      entry = {
        displayName: score.modelDisplayName,
        provider: resolvedProvider,
        efforts: new Set<EffortLevel>(),
        byBenchmark: new Map<string, BenchmarkScoreRecord[]>(),
        telemetry: {},
      };
      byModel.set(score.modelCanonicalId, entry);
    } else if (
      entry.provider === 'Outros / Independente' &&
      resolvedProvider !== 'Outros / Independente'
    ) {
      entry.provider = resolvedProvider;
    }

    entry.efforts.add(score.effort);
    const list = entry.byBenchmark.get(score.benchmarkId) ?? [];
    list.push({ ...score, provider: resolvedProvider });
    entry.byBenchmark.set(score.benchmarkId, list);

    // Populate telemetry from Artificial Analysis records when available
    if (score.metadata) {
      if (score.metadata.priceInput1M != null) {
        entry.telemetry!.priceInput1M = score.metadata.priceInput1M;
      }
      if (score.metadata.priceOutput1M != null) {
        entry.telemetry!.priceOutput1M = score.metadata.priceOutput1M;
      }
      if (score.metadata.outputSpeedTokensPerSec != null) {
        entry.telemetry!.outputSpeedTokensPerSec =
          score.metadata.outputSpeedTokensPerSec;
      }
      if (score.metadata.ttftSeconds != null) {
        entry.telemetry!.ttftSeconds = score.metadata.ttftSeconds;
      }
    }
    if (score.benchmarkId === 'aa-intelligence-index') {
      entry.telemetry!.aaIntelligenceIndex = score.rawScore;
    }
  }

  // Compute total active primary benchmarks (only qualified ones when frontier filtering is enabled)
  const activeUseCaseBenchmarks = USE_CASES.map((uc) => {
    const activePrimaryIds = activeQualifiedIds
      ? uc.primaryBenchmarkIds.filter((id) => activeQualifiedIds.has(id))
      : uc.primaryBenchmarkIds;
    const activeSubstituteIds = activeQualifiedIds
      ? uc.substituteBenchmarkIds.filter((id) => activeQualifiedIds.has(id))
      : uc.substituteBenchmarkIds;
    return { uc, activePrimaryIds, activeSubstituteIds };
  });

  const totalPrimaryBenchmarks = activeUseCaseBenchmarks.reduce(
    (acc, item) => acc + item.activePrimaryIds.length,
    0
  );

  const results: RankedModelEntry[] = [];

  for (const [modelId, modelData] of byModel.entries()) {
    if (
      normalizedProviderFilter &&
      !normalizedProviderFilter.has(modelData.provider)
    ) {
      continue;
    }
    if (selectedIdsSet && !selectedIdsSet.has(modelId)) {
      continue;
    }

    const effectiveEffortPref = (modelEffortOverrides[modelId] ??
      preferredEffort) as EffortLevel | 'best' | 'any';

    const useCaseScores: Record<string, ModelUseCaseScore> = {};
    let primaryBenchmarksCovered = 0;
    let substituteBenchmarksUsed = 0;
    let useCasesCovered = 0;

    let weightedSum = 0;
    let activeWeightTotal = 0;

    for (const { uc, activePrimaryIds, activeSubstituteIds } of activeUseCaseBenchmarks) {
      const cells: ResolvedBenchmarkCell[] = [];
      let ucPrimaryAvailable = 0;
      let ucSubstituteUsed = 0;

      if (activePrimaryIds.length > 0) {
        for (const primaryId of activePrimaryIds) {
          const primaryDef = BENCHMARK_MAP.get(primaryId);
          if (!primaryDef) continue;

          const primaryRecords = modelData.byBenchmark.get(primaryId) ?? [];
          const chosenPrimary = selectScoreForModelAndBenchmark(
            primaryRecords,
            effectiveEffortPref
          );

          if (chosenPrimary) {
            ucPrimaryAvailable++;
            primaryBenchmarksCovered++;
            cells.push({
              benchmarkId: primaryDef.id,
              benchmarkName: primaryDef.name,
              rawScore: chosenPrimary.rawScore,
              normalizedScore: chosenPrimary.normalizedScore,
              displayScore: chosenPrimary.displayScore,
              effort: chosenPrimary.effort,
              effortLabel: chosenPrimary.effortLabel,
              isSubstitute: false,
              sourceUrl: chosenPrimary.sourceUrl,
              originType: chosenPrimary.originType,
              updatedAt: chosenPrimary.updatedAt,
              metadata: chosenPrimary.metadata,
            });
          } else if (includeSubstitutes) {
            let chosenSub: {
              record: BenchmarkScoreRecord;
              subDefName: string;
              subDefId: string;
              explanation: string;
            } | null = null;

            for (const subId of activeSubstituteIds) {
              const subDef = BENCHMARK_MAP.get(subId);
              if (!subDef) continue;
              if (
                subDef.substituteForIds &&
                !subDef.substituteForIds.includes(primaryId)
              ) {
                continue;
              }
              const subRecords = modelData.byBenchmark.get(subId) ?? [];
              const candidate = selectScoreForModelAndBenchmark(
                subRecords,
                effectiveEffortPref
              );
              if (candidate) {
                chosenSub = {
                  record: candidate,
                  subDefId: subDef.id,
                  subDefName: subDef.name,
                  explanation:
                    subDef.substituteEquivalenceExplanation ??
                    `Substituto equivalente para ${primaryDef.name}`,
                };
                break;
              }
            }

            if (chosenSub) {
              ucSubstituteUsed++;
              substituteBenchmarksUsed++;
              cells.push({
                benchmarkId: primaryDef.id,
                benchmarkName: primaryDef.name,
                rawScore: chosenSub.record.rawScore,
                normalizedScore: chosenSub.record.normalizedScore,
                displayScore: chosenSub.record.displayScore,
                effort: chosenSub.record.effort,
                effortLabel: chosenSub.record.effortLabel,
                isSubstitute: true,
                substitutedBenchmarkId: chosenSub.subDefId,
                substitutedBenchmarkName: chosenSub.subDefName,
                substituteExplanation: chosenSub.explanation,
                sourceUrl: chosenSub.record.sourceUrl,
                originType: chosenSub.record.originType,
                updatedAt: chosenSub.record.updatedAt,
                metadata: chosenSub.record.metadata,
              });
            }
          }
        }
      } else if (includeSubstitutes && activeSubstituteIds.length > 0) {
        // All primary benchmarks for this use case were hidden due to lack of frontier coverage:
        // compute this use case using its active frontier-qualified substitute benchmarks.
        for (const subId of activeSubstituteIds) {
          const subDef = BENCHMARK_MAP.get(subId);
          if (!subDef) continue;
          const subRecords = modelData.byBenchmark.get(subId) ?? [];
          const candidate = selectScoreForModelAndBenchmark(
            subRecords,
            effectiveEffortPref
          );
          if (candidate) {
            ucSubstituteUsed++;
            substituteBenchmarksUsed++;
            cells.push({
              benchmarkId: subDef.id,
              benchmarkName: subDef.name,
              rawScore: candidate.rawScore,
              normalizedScore: candidate.normalizedScore,
              displayScore: candidate.displayScore,
              effort: candidate.effort,
              effortLabel: candidate.effortLabel,
              isSubstitute: true,
              substitutedBenchmarkId: subDef.id,
              substitutedBenchmarkName: subDef.name,
              substituteExplanation:
                subDef.substituteEquivalenceExplanation ??
                `Substituto qualificado de fronteira para ${uc.shortTitle}`,
              sourceUrl: candidate.sourceUrl,
              originType: candidate.originType,
              updatedAt: candidate.updatedAt,
              metadata: candidate.metadata,
            });
          }
        }
      }

      const ucScore =
        cells.length > 0
          ? Math.round(
              (cells.reduce((sum, c) => sum + c.normalizedScore, 0) /
                cells.length) *
                100
            ) / 100
          : null;

      if (ucScore !== null) {
        useCasesCovered++;
        const ucWeight = weights[uc.id] ?? 100;
        if (ucWeight > 0) {
          weightedSum += ucScore * ucWeight;
          activeWeightTotal += ucWeight;
        }
      }

      useCaseScores[uc.id] = {
        useCaseId: uc.id,
        useCaseNumber: uc.number,
        useCaseTitle: uc.title,
        score: ucScore,
        primaryAvailableCount: ucPrimaryAvailable,
        primaryTotalCount: activePrimaryIds.length,
        usedSubstituteCount: ucSubstituteUsed,
        cells,
      };
    }

    // Skip models with zero coverage across all active benchmarks
    if (useCasesCovered === 0) {
      continue;
    }

    const overallScore =
      activeWeightTotal > 0
        ? Math.round((weightedSum / activeWeightTotal) * 100) / 100
        : 0;

    const availableEfforts = Array.from(modelData.efforts);
    const selectedEffort: EffortLevel =
      effectiveEffortPref !== 'best' &&
      effectiveEffortPref !== 'any' &&
      modelData.efforts.has(effectiveEffortPref)
        ? effectiveEffortPref
        : availableEfforts[0] ?? 'default';

    results.push({
      modelCanonicalId: modelId,
      displayName: modelData.displayName,
      provider: modelData.provider,
      selectedEffort,
      availableEfforts,
      overallScore,
      useCasesCovered,
      totalUseCases: USE_CASES.length,
      primaryBenchmarksCovered,
      totalPrimaryBenchmarks,
      substituteBenchmarksUsed,
      isFrontier: isFrontierModel(modelId, modelData.displayName),
      useCaseScores,
      telemetry: modelData.telemetry,
    });
  }

  const sorted = results.sort(compareRankedModels);
  if (maxModelsPerProvider != null) {
    return limitTopModelsPerProvider(sorted, maxModelsPerProvider);
  }
  return sorted;
}

export function buildPerBenchmarkRankings(
  allScores: BenchmarkScoreRecord[],
  options: PerBenchmarkRankingOptions
): BenchmarkRankingTable[] {
  const {
    includeSubstitutes,
    preferredEffort = 'best',
    modelEffortOverrides = {},
    providerFilter,
    selectedModelIds,
    allowedModelIds,
    qualifiedBenchmarkIds,
    onlyFrontierQualified = false,
    maxModelsPerProvider = 4,
    searchQuery,
  } = options;

  const activeQualifiedIds =
    qualifiedBenchmarkIds ??
    (onlyFrontierQualified
      ? getFrontierQualifiedBenchmarkIds(allScores)
      : null);

  const normalizedProviderFilter =
    providerFilter && providerFilter.length > 0
      ? new Set(providerFilter.map((p) => p.trim()))
      : null;

  const selectedIdsSet =
    selectedModelIds && selectedModelIds.length > 0
      ? new Set(selectedModelIds)
      : null;

  const normalizedQuery = (searchQuery ?? '').trim().toLowerCase();

  // Group eligible scores by benchmarkId -> modelCanonicalId -> BenchmarkScoreRecord[]
  const scoresByBenchmark = new Map<
    string,
    Map<string, BenchmarkScoreRecord[]>
  >();

  for (const score of allScores) {
    if (score.modelCanonicalId === 'human') continue;
    if (activeQualifiedIds && !activeQualifiedIds.has(score.benchmarkId)) {
      continue;
    }

    const resolvedProvider = resolveScoreProvider(score);
    if (
      normalizedProviderFilter &&
      !normalizedProviderFilter.has(resolvedProvider)
    ) {
      continue;
    }
    if (allowedModelIds && !allowedModelIds.has(score.modelCanonicalId)) {
      continue;
    }
    if (selectedIdsSet && !selectedIdsSet.has(score.modelCanonicalId)) {
      continue;
    }
    if (normalizedQuery) {
      const matchesQuery =
        score.modelDisplayName.toLowerCase().includes(normalizedQuery) ||
        resolvedProvider.toLowerCase().includes(normalizedQuery) ||
        score.modelCanonicalId.toLowerCase().includes(normalizedQuery);
      if (!matchesQuery) continue;
    }

    let byModel = scoresByBenchmark.get(score.benchmarkId);
    if (!byModel) {
      byModel = new Map();
      scoresByBenchmark.set(score.benchmarkId, byModel);
    }
    const list = byModel.get(score.modelCanonicalId) ?? [];
    list.push({ ...score, provider: resolvedProvider });
    byModel.set(score.modelCanonicalId, list);
  }

  // Order benchmarks deterministically by Use Case (1..7), primaries first then substitutes
  const orderedBenchmarks = [...BENCHMARKS].sort((a, b) => {
    const aUcNum = USE_CASE_MAP.get(a.useCaseIds[0])?.number ?? 99;
    const bUcNum = USE_CASE_MAP.get(b.useCaseIds[0])?.number ?? 99;
    if (aUcNum !== bUcNum) return aUcNum - bUcNum;
    if (a.isSubstitute !== b.isSubstitute) return a.isSubstitute ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const tables: BenchmarkRankingTable[] = [];

  for (const bench of orderedBenchmarks) {
    if (activeQualifiedIds && !activeQualifiedIds.has(bench.id)) continue;
    if (!includeSubstitutes && bench.isSubstitute) continue;

    const byModel = scoresByBenchmark.get(bench.id);
    if (!byModel || byModel.size === 0) continue;

    const rawRows: Omit<BenchmarkRankingRow, 'rank'>[] = [];
    for (const [modelId, records] of byModel.entries()) {
      const effectiveEffortPref = (modelEffortOverrides[modelId] ??
        preferredEffort) as EffortLevel | 'best' | 'any';
      const chosen = selectScoreForModelAndBenchmark(
        records,
        effectiveEffortPref
      );
      if (!chosen) continue;

      rawRows.push({
        modelCanonicalId: modelId,
        displayName: chosen.modelDisplayName,
        provider: chosen.provider,
        effort: chosen.effort,
        effortLabel: chosen.effortLabel,
        rawScore: chosen.rawScore,
        normalizedScore: chosen.normalizedScore,
        displayScore: chosen.displayScore,
        originType: chosen.originType,
        sourceUrl: chosen.sourceUrl,
        updatedAt: chosen.updatedAt,
        isFrontier: isFrontierModel(modelId, chosen.modelDisplayName),
      });
    }

    // Sort best-to-worst respecting higherIsBetter
    rawRows.sort((a, b) => {
      if (b.rawScore !== a.rawScore) {
        return bench.higherIsBetter
          ? b.rawScore - a.rawScore
          : a.rawScore - b.rawScore;
      }
      if (b.normalizedScore !== a.normalizedScore) {
        return b.normalizedScore - a.normalizedScore;
      }
      if (b.isFrontier !== a.isFrontier) {
        return b.isFrontier ? 1 : -1;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    // Enforce Top N per provider (default 4)
    const filteredRows: BenchmarkRankingRow[] = [];
    const providerCounts = new Map<string, number>();
    for (const row of rawRows) {
      if (maxModelsPerProvider != null) {
        if (maxModelsPerProvider <= 0) break;
        const count = providerCounts.get(row.provider) ?? 0;
        if (count >= maxModelsPerProvider) continue;
        providerCounts.set(row.provider, count + 1);
      }
      filteredRows.push({
        ...row,
        rank: filteredRows.length + 1,
      });
    }

    if (filteredRows.length === 0) continue;

    const useCaseNumbers = bench.useCaseIds
      .map((id) => USE_CASE_MAP.get(id)?.number)
      .filter((n): n is number => n != null);
    const useCaseLabels = bench.useCaseIds
      .map((id) => USE_CASE_MAP.get(id)?.shortTitle)
      .filter((t): t is string => Boolean(t));

    tables.push({
      benchmarkId: bench.id,
      benchmarkName: bench.name,
      shortName: bench.shortName,
      useCaseIds: bench.useCaseIds,
      useCaseNumbers,
      useCaseLabels,
      isSubstitute: bench.isSubstitute,
      substituteForIds: bench.substituteForIds,
      officialUrl: bench.officialUrl,
      whatItTests: bench.whatItTests,
      practicalExplanation: bench.practicalExplanation,
      higherIsBetter: bench.higherIsBetter,
      isBrazilianSpecific: bench.isBrazilianSpecific,
      rows: filteredRows,
    });
  }

  return tables;
}
