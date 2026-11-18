import { BENCHMARK_MAP, USE_CASES } from './catalog.js';
import {
  BenchmarkScoreRecord,
  EffortLevel,
  ModelUseCaseScore,
  RankedModelEntry,
  ResolvedBenchmarkCell,
} from './types.js';

export interface RankingOptions {
  weights: Record<string, number>; // useCaseId -> weight (0..100)
  includeSubstitutes: boolean;
  preferredEffort?: EffortLevel | 'best' | 'any';
  modelEffortOverrides?: Record<string, EffortLevel>; // modelCanonicalId -> specific EffortLevel
  providerFilter?: string[];
  selectedModelIds?: string[];
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

  // Pick the record with highest normalizedScore (preferring 'manual' override if tied or newer, then 'live')
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
  } = options;

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

    let entry = byModel.get(score.modelCanonicalId);
    if (!entry) {
      entry = {
        displayName: score.modelDisplayName,
        provider: score.provider,
        efforts: new Set<EffortLevel>(),
        byBenchmark: new Map<string, BenchmarkScoreRecord[]>(),
        telemetry: {},
      };
      byModel.set(score.modelCanonicalId, entry);
    }

    entry.efforts.add(score.effort);
    const list = entry.byBenchmark.get(score.benchmarkId) ?? [];
    list.push(score);
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
        entry.telemetry!.outputSpeedTokensPerSec = score.metadata.outputSpeedTokensPerSec;
      }
      if (score.metadata.ttftSeconds != null) {
        entry.telemetry!.ttftSeconds = score.metadata.ttftSeconds;
      }
    }
    if (score.benchmarkId === 'aa-intelligence-index') {
      entry.telemetry!.aaIntelligenceIndex = score.rawScore;
    }
  }

  const totalPrimaryBenchmarks = USE_CASES.reduce(
    (acc, uc) => acc + uc.primaryBenchmarkIds.length,
    0
  );

  const results: RankedModelEntry[] = [];

  for (const [modelId, modelData] of byModel.entries()) {
    if (
      providerFilter &&
      providerFilter.length > 0 &&
      !providerFilter.includes(modelData.provider)
    ) {
      continue;
    }
    if (
      selectedModelIds &&
      selectedModelIds.length > 0 &&
      !selectedModelIds.includes(modelId)
    ) {
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

    for (const uc of USE_CASES) {
      const cells: ResolvedBenchmarkCell[] = [];
      let ucPrimaryAvailable = 0;
      let ucSubstituteUsed = 0;

      for (const primaryId of uc.primaryBenchmarkIds) {
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
          // Find first available substitute for this use case that can substitute for primaryId
          let chosenSub: {
            record: BenchmarkScoreRecord;
            subDefName: string;
            subDefId: string;
            explanation: string;
          } | null = null;

          for (const subId of uc.substituteBenchmarkIds) {
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
        primaryTotalCount: uc.primaryBenchmarkIds.length,
        usedSubstituteCount: ucSubstituteUsed,
        cells,
      };
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
      useCaseScores,
      telemetry: modelData.telemetry,
    });
  }

  return results.sort((a, b) => {
    if (b.overallScore !== a.overallScore) {
      return b.overallScore - a.overallScore;
    }
    if (b.primaryBenchmarksCovered !== a.primaryBenchmarksCovered) {
      return b.primaryBenchmarksCovered - a.primaryBenchmarksCovered;
    }
    return b.useCasesCovered - a.useCasesCovered;
  });
}