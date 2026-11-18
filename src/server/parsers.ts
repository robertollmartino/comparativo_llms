import { BENCHMARK_MAP } from '../shared/catalog.js';
import { clampNormalizedScore, normalizeModel } from '../shared/normalizer.js';
import { BenchmarkScoreRecord } from '../shared/types.js';

function makeScoreRecord(params: {
  benchmarkId: string;
  rawModelName: string;
  rawProvider?: string | null;
  explicitEffort?: string | null;
  isReasoning?: boolean | null;
  rawScore: number;
  displayScore?: string;
  sourceId: string;
  sourceUrl: string;
  originType?: 'live' | 'manual';
  reportedAt?: string;
  nowIso: string;
  metadata?: BenchmarkScoreRecord['metadata'];
}): BenchmarkScoreRecord | null {
  const bench = BENCHMARK_MAP.get(params.benchmarkId);
  if (!bench || !Number.isFinite(params.rawScore)) return null;

  const norm = normalizeModel(
    params.rawModelName,
    params.rawProvider,
    params.explicitEffort,
    params.isReasoning
  );
  if (norm.canonicalId === 'human') return null;

  const normalizedScore = clampNormalizedScore(
    params.rawScore,
    bench.minScore,
    bench.maxScore,
    bench.higherIsBetter
  );

  const displayScore =
    params.displayScore ??
    (bench.unit === '%'
      ? `${params.rawScore.toFixed(1)}%`
      : `${params.rawScore.toFixed(1)}`);

  const id = `${params.benchmarkId}::${norm.canonicalId}::${norm.effort}`;

  return {
    id,
    benchmarkId: params.benchmarkId,
    modelCanonicalId: norm.canonicalId,
    modelDisplayName: norm.displayName,
    provider: norm.provider,
    effort: norm.effort,
    effortLabel: norm.effortLabel,
    rawModelName: params.rawModelName,
    rawScore: Math.round(params.rawScore * 100) / 100,
    normalizedScore,
    displayScore,
    sourceId: params.sourceId,
    sourceUrl: params.sourceUrl,
    originType: params.originType ?? 'live',
    reportedAt: params.reportedAt,
    updatedAt: params.nowIso,
    metadata: params.metadata,
  };
}

/**
 * 1. Artificial Analysis HTML (`self.__next_f` -> `initialModels`) or Data API v2 JSON
 */
export function parseArtificialAnalysisHtmlOrJson(
  payload: string,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  let models: any[] = [];

  const trimmed = payload.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      models = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.data)
          ? parsed.data
          : Array.isArray(parsed.models)
            ? parsed.models
            : Array.isArray(parsed.initialModels)
              ? parsed.initialModels
              : [];
    } catch {
      models = [];
    }
  }

  if (models.length === 0) {
    // Extract from Next.js flight chunks self.__next_f.push([1,"..."])
    const chunks = [...payload.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)]
      .map((m) => {
        try {
          return JSON.parse('"' + m[1] + '"');
        } catch {
          return '';
        }
      })
      .join('');

    const searchFrom = chunks.length > 0 ? chunks : payload;
    const startIdx = searchFrom.indexOf('"initialModels":[');
    if (startIdx !== -1) {
      let depth = 0;
      let i = startIdx + '"initialModels":'.length;
      for (; i < searchFrom.length; i++) {
        if (searchFrom[i] === '[') depth++;
        else if (searchFrom[i] === ']') {
          depth--;
          if (depth === 0) break;
        }
      }
      try {
        models = JSON.parse(searchFrom.slice(startIdx + '"initialModels":'.length, i + 1));
      } catch {
        models = [];
      }
    }
  }

  const results: BenchmarkScoreRecord[] = [];
  const sourceUrl = 'https://artificialanalysis.ai/leaderboards/models';

  for (const m of models) {
    const rawName: string = m.name || m.shortName || m.release?.name || '';
    if (!rawName) continue;
    const rawProvider: string = m.modelCreatorName || m.creator?.name || '';
    const suffix: string | null = m.suffix ?? null;
    const isReasoning: boolean | null = m.isReasoning ?? null;

    const baseMetadata: BenchmarkScoreRecord['metadata'] = {
      priceInput1M: typeof m.price1mInputTokens === 'number' ? m.price1mInputTokens : null,
      priceOutput1M: typeof m.price1mOutputTokens === 'number' ? m.price1mOutputTokens : null,
      outputSpeedTokensPerSec:
        typeof m.outputSpeed === 'number' ? Math.round(m.outputSpeed * 10) / 10 : null,
      ttftSeconds:
        typeof m.timeToFirstAnswerToken === 'number'
          ? Math.round(m.timeToFirstAnswerToken * 100) / 100
          : typeof m.timeToFirstToken === 'number'
            ? Math.round(m.timeToFirstToken * 100) / 100
            : null,
      costUsd:
        typeof m.intelligenceIndexCostPerTask === 'number'
          ? Math.round(m.intelligenceIndexCostPerTask * 100) / 100
          : null,
    };

    const scores = m.scores || {};

    // 1. AA Intelligence Index
    if (typeof m.intelligenceIndex === 'number' && m.intelligenceIndex > 0) {
      const rec = makeScoreRecord({
        benchmarkId: 'aa-intelligence-index',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: m.intelligenceIndex,
        displayScore: `${m.intelligenceIndex.toFixed(1)} pts`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 2. GDPval-AA v2.1 (gdpval-aa-normalized ELO ~ 1000..1700)
    if (typeof scores['gdpval-aa-normalized'] === 'number' && scores['gdpval-aa-normalized'] > 0) {
      const elo = scores['gdpval-aa-normalized'];
      const rec = makeScoreRecord({
        benchmarkId: 'gdpval-aa',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: elo,
        displayScore: `${elo.toFixed(0)} ELO`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 3. AA-LCR (artificial-analysis-long-context-reasoning: 0..1)
    if (typeof scores['artificial-analysis-long-context-reasoning'] === 'number') {
      const pct = scores['artificial-analysis-long-context-reasoning'] * 100;
      const rec = makeScoreRecord({
        benchmarkId: 'aa-lcr',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: pct,
        displayScore: `${pct.toFixed(1)}%`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 4. SimpleQA / Omniscience Factuality
    if (typeof scores['omniscience-accuracy'] === 'number') {
      const pct = scores['omniscience-accuracy'] * 100;
      const rec = makeScoreRecord({
        benchmarkId: 'simpleqa',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: pct,
        displayScore: `${pct.toFixed(1)}%`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 5. τ²-bench (tau2-bench: 0..1)
    if (typeof scores['tau2-bench'] === 'number') {
      const pct = scores['tau2-bench'] * 100;
      const rec = makeScoreRecord({
        benchmarkId: 'tau2-bench-sub',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: pct,
        displayScore: `${pct.toFixed(1)}%`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 6. Terminal-Bench Legacy / Hard
    const tbScore =
      typeof scores['terminalbench-2-1'] === 'number'
        ? scores['terminalbench-2-1'] * 100
        : typeof scores['terminalbench-hard'] === 'number'
          ? scores['terminalbench-hard'] * 100
          : null;
    if (tbScore !== null) {
      const rec = makeScoreRecord({
        benchmarkId: 'terminal-bench-legacy',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: tbScore,
        displayScore: `${tbScore.toFixed(1)}%`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 7. BFCL / IFBench (ifbench: 0..1)
    if (typeof scores['ifbench'] === 'number') {
      const pct = scores['ifbench'] * 100;
      const rec = makeScoreRecord({
        benchmarkId: 'bfcl',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: pct,
        displayScore: `${pct.toFixed(1)}%`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 8. HLE (humanitys-last-exam or hle-diamond: 0..1)
    const hleVal =
      typeof scores['hle-diamond'] === 'number'
        ? scores['hle-diamond'] * 100
        : typeof scores['humanitys-last-exam'] === 'number'
          ? scores['humanitys-last-exam'] * 100
          : null;
    if (hleVal !== null) {
      const rec = makeScoreRecord({
        benchmarkId: 'hle',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: hleVal,
        displayScore: `${hleVal.toFixed(1)}%`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 9. GPQA Diamond
    if (typeof scores['gpqa-diamond'] === 'number') {
      const pct = scores['gpqa-diamond'] * 100;
      const rec = makeScoreRecord({
        benchmarkId: 'gpqa-diamond',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: pct,
        displayScore: `${pct.toFixed(1)}%`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 10. SciCode
    if (typeof scores['scicode'] === 'number') {
      const pct = scores['scicode'] * 100;
      const rec = makeScoreRecord({
        benchmarkId: 'scicode',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: pct,
        displayScore: `${pct.toFixed(1)}%`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 11. Deterministic AA Coding Index (from livecodebench, scicode, frontiercode, frontiercode-2-0)
    const codingComponents: number[] = [];
    if (typeof scores['livecodebench'] === 'number')
      codingComponents.push(scores['livecodebench'] * 100);
    if (typeof scores['scicode'] === 'number') codingComponents.push(scores['scicode'] * 100);
    if (typeof scores['frontiercode'] === 'number')
      codingComponents.push(scores['frontiercode'] * 100);
    if (typeof scores['frontiercode-2-0'] === 'number')
      codingComponents.push(scores['frontiercode-2-0'] * 100);
    if (codingComponents.length > 0) {
      const avgCoding =
        codingComponents.reduce((a, b) => a + b, 0) / codingComponents.length;
      const rec = makeScoreRecord({
        benchmarkId: 'aa-coding-index',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: avgCoding,
        displayScore: `${avgCoding.toFixed(1)} pts`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 12. Deterministic AA Math Index (from aime-2025, critpt, critpt-v2-hard, gpqa-diamond)
    const mathComponents: number[] = [];
    if (typeof scores['aime-2025'] === 'number')
      mathComponents.push(scores['aime-2025'] * 100);
    if (typeof scores['critpt-v2-hard'] === 'number')
      mathComponents.push(scores['critpt-v2-hard'] * 100);
    else if (typeof scores['critpt'] === 'number')
      mathComponents.push(scores['critpt'] * 100);
    if (typeof scores['gpqa-diamond'] === 'number')
      mathComponents.push(scores['gpqa-diamond'] * 100);
    if (mathComponents.length > 0) {
      const avgMath = mathComponents.reduce((a, b) => a + b, 0) / mathComponents.length;
      const rec = makeScoreRecord({
        benchmarkId: 'aa-math-index',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: avgMath,
        displayScore: `${avgMath.toFixed(1)} pts`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 13. Deterministic AA Coding + Math Index (Substitute for Caso 3: Excel Spreadsheets)
    if (codingComponents.length > 0 || mathComponents.length > 0) {
      const all = [...codingComponents, ...mathComponents];
      const avgCodingMath = all.reduce((a, b) => a + b, 0) / all.length;
      const rec = makeScoreRecord({
        benchmarkId: 'aa-coding-math-index',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: avgCodingMath,
        displayScore: `${avgCodingMath.toFixed(1)} pts`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 14. Deterministic AA Agentic Index (Substitute for Caso 4: Automations)
    const agenticComponents: number[] = [];
    if (typeof scores['tau2-bench'] === 'number')
      agenticComponents.push(scores['tau2-bench'] * 100);
    if (typeof scores['automationbench-aa'] === 'number')
      agenticComponents.push(scores['automationbench-aa'] * 100);
    if (typeof scores['terminalbench-4-0'] === 'number')
      agenticComponents.push(scores['terminalbench-4-0'] * 100);
    else if (typeof scores['terminalbench-hard'] === 'number')
      agenticComponents.push(scores['terminalbench-hard'] * 100);
    if (typeof scores['ifbench'] === 'number')
      agenticComponents.push(scores['ifbench'] * 100);
    if (agenticComponents.length > 0) {
      const avgAgentic =
        agenticComponents.reduce((a, b) => a + b, 0) / agenticComponents.length;
      const rec = makeScoreRecord({
        benchmarkId: 'aa-agentic-index',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: avgAgentic,
        displayScore: `${avgAgentic.toFixed(1)} pts`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 15. AA Briefcase / Visual Layout (Substitute for Caso 7: Office/Presentations)
    if (typeof scores['aa-briefcase'] === 'number' && scores['aa-briefcase'] > 0) {
      // aa-briefcase is on ELO scale (~800..1800), normalize to 0..100
      const normBriefcase = clampNormalizedScore(scores['aa-briefcase'], 800, 1800, true);
      const rec = makeScoreRecord({
        benchmarkId: 'websight-design2code',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: normBriefcase,
        displayScore: `${normBriefcase.toFixed(1)} pts (${scores['aa-briefcase'].toFixed(0)} ELO)`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }

    // 16. AA Multimodal / Office Index (Substitute for Caso 7)
    const mmComponents: number[] = [];
    if (typeof scores['mmmu-pro'] === 'number')
      mmComponents.push(scores['mmmu-pro'] * 100);
    if (typeof scores['gdp-pdf'] === 'number')
      mmComponents.push(scores['gdp-pdf'] * 100);
    if (typeof scores['aa-briefcase'] === 'number')
      mmComponents.push(clampNormalizedScore(scores['aa-briefcase'], 800, 1800, true));
    if (mmComponents.length > 0) {
      const avgMm = mmComponents.reduce((a, b) => a + b, 0) / mmComponents.length;
      const rec = makeScoreRecord({
        benchmarkId: 'aa-multimodal-index',
        rawModelName: rawName,
        rawProvider,
        explicitEffort: suffix,
        isReasoning,
        rawScore: avgMm,
        displayScore: `${avgMm.toFixed(1)} pts`,
        sourceId: 'artificial-analysis',
        sourceUrl,
        nowIso,
        metadata: baseMetadata,
      });
      if (rec) results.push(rec);
    }
  }

  return results;
}

/**
 * 2. Vals.ai HTML Leaderboard Table Parser (works for legal_research, legal_bench, finance_index, mmmu, lcb, cua_bench, swebench, terminal-bench-2-1, tax_eval_v2)
 */
export function parseValsBenchmarkHtml(
  html: string,
  benchmarkId: string,
  sourceId: string,
  sourceUrl: string,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  const results: BenchmarkScoreRecord[] = [];
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
    if (cells.length < 3) continue;

    // Find percentage cell (e.g. "55.77%")
    const pctIdx = cells.findIndex((c) => /^\d+(?:\.\d+)?%$/.test(c));
    if (pctIdx === -1 || pctIdx < 2) continue;

    const rawModelName = cells[1];
    if (!rawModelName || rawModelName.toLowerCase() === 'model') continue;

    const rawScore = parseFloat(cells[pctIdx].replace('%', ''));
    if (!Number.isFinite(rawScore)) continue;

    // Optional harness if pctIdx === 3
    const agentScaffold = pctIdx === 3 ? cells[2] : null;
    const costMatch = cells[pctIdx + 1]?.match(/\$([\d.]+)/);
    const costUsd = costMatch ? parseFloat(costMatch[1]) : null;

    const rec = makeScoreRecord({
      benchmarkId,
      rawModelName,
      rawScore,
      displayScore: `${rawScore.toFixed(2)}%`,
      sourceId,
      sourceUrl,
      nowIso,
      metadata: {
        agentScaffold,
        costUsd,
      },
    });
    if (rec) results.push(rec);
  }

  return results;
}

/**
 * 3. Terminal-Bench 2.1 (tbench.ai HTML table)
 */
export function parseTbenchHtml(
  html: string,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  const results: BenchmarkScoreRecord[] = [];
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      c[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
    if (cells.length < 4) continue;

    const rawModelName = cells[1];
    const agentScaffold = cells[2];
    const rateCell = cells[3];
    const rateMatch = rateCell.match(/(\d+(?:\.\d+)?)%/);
    if (!rawModelName || !rateMatch) continue;

    const rawScore = parseFloat(rateMatch[1]);
    const ciMatch = rateCell.match(/±\s*(\d+(?:\.\d+)?)%/);

    const rec = makeScoreRecord({
      benchmarkId: 'terminal-bench-2-1',
      rawModelName,
      rawScore,
      displayScore: ciMatch
        ? `${rawScore.toFixed(1)}% ± ${ciMatch[1]}%`
        : `${rawScore.toFixed(1)}%`,
      sourceId: 'terminal-bench-2-1',
      sourceUrl: 'https://www.tbench.ai/',
      reportedAt: cells[4] && /\d{4}/.test(cells[4]) ? cells[4] : undefined,
      nowIso,
      metadata: {
        agentScaffold: agentScaffold || null,
        confidenceInterval: ciMatch ? `±${ciMatch[1]}%` : null,
      },
    });
    if (rec) results.push(rec);
  }

  return results;
}

/**
 * 4. Sierra τ-bench / τ²-bench submission JSON parser
 */
export function parseTau2SubmissionJson(
  submission: any,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord | null {
  if (!submission || !submission.model_name || !submission.results) return null;

  const domains = ['airline', 'retail', 'telecom', 'banking_knowledge'];
  const pass1Values: number[] = [];
  const subscores: Record<string, number> = {};
  let totalCost = 0;
  let costCount = 0;

  for (const dom of domains) {
    const d = submission.results[dom];
    if (d && typeof d.pass_1 === 'number') {
      pass1Values.push(d.pass_1);
      subscores[dom] = d.pass_1;
      if (typeof d.cost === 'number') {
        totalCost += d.cost;
        costCount++;
      }
    }
  }

  if (pass1Values.length === 0) return null;
  // Standard tau2-bench primary comparison uses average of standard domains (airline, retail, telecom) if available, else all available
  const coreDomains = ['airline', 'retail', 'telecom'].filter(
    (k) => typeof subscores[k] === 'number'
  );
  const avgScore =
    coreDomains.length > 0
      ? coreDomains.reduce((acc, k) => acc + subscores[k], 0) / coreDomains.length
      : pass1Values.reduce((a, b) => a + b, 0) / pass1Values.length;

  return makeScoreRecord({
    benchmarkId: 'tau-bench',
    rawModelName: submission.model_name,
    rawProvider: submission.model_organization,
    explicitEffort: submission.reasoning_effort,
    rawScore: avgScore,
    displayScore: `${avgScore.toFixed(1)}% (pass^1)`,
    sourceId: 'tau2-bench',
    sourceUrl: 'https://taubench.com/',
    reportedAt: submission.submission_date,
    nowIso,
    metadata: {
      costUsd: costCount > 0 ? Math.round((totalCost / costCount) * 1000) / 1000 : null,
      subscores,
      notes: submission.methodology?.notes ?? null,
    },
  });
}

/**
 * 5. Steel Leaderboard JSON parser (browsecomp.json, osworld2.json, gaia.json, osworld.json, aiderPolyglot.json, webarena.json, sweBenchVerified.json)
 */
export function parseSteelLeaderboardJson(
  jsonObj: any,
  benchmarkId: string,
  sourceId: string,
  defaultSourceUrl: string,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  const results: BenchmarkScoreRecord[] = [];
  const rootKey = Object.keys(jsonObj || {})[0];
  const entries = Array.isArray(jsonObj)
    ? jsonObj
    : rootKey && Array.isArray(jsonObj[rootKey])
      ? jsonObj[rootKey]
      : [];

  for (const item of entries) {
    const rawModelName = item.systemName || item.model || item.name;
    const rawScore = Number(item.scoreValue ?? item.score);
    if (!rawModelName || !Number.isFinite(rawScore)) continue;

    const rec = makeScoreRecord({
      benchmarkId,
      rawModelName,
      rawProvider: item.organization,
      rawScore,
      displayScore: item.scoreDisplay || `${rawScore.toFixed(1)}%`,
      sourceId,
      sourceUrl: item.sourceUrl || defaultSourceUrl,
      reportedAt: item.reportedAt,
      nowIso,
      metadata: {
        notes: item.notesShort || null,
      },
    });
    if (rec) results.push(rec);
  }

  return results;
}

/**
 * 6. SpreadsheetBench V2 & V1 JSON parser
 */
export function parseSpreadsheetBenchJson(
  entries: any[],
  benchmarkId: 'spreadsheetbench-2' | 'spreadsheetbench-v1',
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  if (!Array.isArray(entries)) return [];
  const results: BenchmarkScoreRecord[] = [];

  for (const item of entries) {
    const rawModelName = item.model;
    const rawScore = Number(item.score);
    if (!rawModelName || !Number.isFinite(rawScore)) continue;

    const rec = makeScoreRecord({
      benchmarkId,
      rawModelName,
      rawProvider: item.organization,
      rawScore,
      displayScore: `${rawScore.toFixed(2)}%`,
      sourceId: 'spreadsheetbench',
      sourceUrl: item.url || 'https://spreadsheetbench.github.io/',
      reportedAt: item.date,
      nowIso,
      metadata: {
        agentScaffold: item.scaffold || null,
        subscores: item.subscores || null,
      },
    });
    if (rec) results.push(rec);
  }

  return results;
}

/**
 * 7. Scale AI SWE-bench Pro V2 HTML/Flight parser
 */
export function parseScaleSweBenchProHtml(
  html: string,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  const results: BenchmarkScoreRecord[] = [];
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)]
    .map((m) => {
      try {
        return JSON.parse('"' + m[1] + '"');
      } catch {
        return '';
      }
    })
    .join('');

  const searchFrom = chunks.length > 0 ? chunks : html;
  const idx = searchFrom.indexOf('"entries":[');
  if (idx === -1) return results;

  let depth = 0;
  let i = idx + '"entries":'.length;
  for (; i < searchFrom.length; i++) {
    if (searchFrom[i] === '[') depth++;
    else if (searchFrom[i] === ']') {
      depth--;
      if (depth === 0) break;
    }
  }

  try {
    const entries = JSON.parse(searchFrom.slice(idx + '"entries":'.length, i + 1));
    for (const item of entries) {
      const rawModelName = item.model;
      const rawScore = Number(item.score);
      if (!rawModelName || !Number.isFinite(rawScore)) continue;

      const rec = makeScoreRecord({
        benchmarkId: 'swe-bench-pro-v2',
        rawModelName,
        rawProvider: item.company,
        rawScore,
        displayScore: item.confidenceInterval_upper
          ? `${rawScore.toFixed(2)}% ± ${item.confidenceInterval_upper}%`
          : `${rawScore.toFixed(2)}%`,
        sourceId: 'scale-swebench-pro',
        sourceUrl: 'https://scale.com/leaderboard/swe_bench_pro_public_v2',
        reportedAt: item.createdAt,
        nowIso,
        metadata: {
          confidenceInterval: item.confidenceInterval_upper
            ? `±${item.confidenceInterval_upper}%`
            : null,
        },
      });
      if (rec) results.push(rec);
    }
  } catch {
    // ignore malformed json
  }

  return results;
}

/**
 * 8. LMArena WebDev Arena HTML/Flight parser
 */
export function parseLMArenaWebDevHtml(
  html: string,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  const results: BenchmarkScoreRecord[] = [];
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)]
    .map((m) => {
      try {
        return JSON.parse('"' + m[1] + '"');
      } catch {
        return '';
      }
    })
    .join('');

  const searchFrom = chunks.length > 0 ? chunks : html;
  const idx = searchFrom.indexOf('"initialModels":[');
  if (idx === -1) return results;

  let depth = 0;
  let i = idx + '"initialModels":'.length;
  for (; i < searchFrom.length; i++) {
    if (searchFrom[i] === '[') depth++;
    else if (searchFrom[i] === ']') {
      depth--;
      if (depth === 0) break;
    }
  }

  try {
    const models = JSON.parse(searchFrom.slice(idx + '"initialModels":'.length, i + 1));
    for (const m of models) {
      const webdevRank = m.rankByModality?.webdev;
      if (typeof webdevRank !== 'number' || webdevRank >= 1000 || webdevRank <= 0) {
        continue;
      }
      const rawModelName = m.displayName || m.publicName;
      if (!rawModelName) continue;

      // Deterministic conversion of official rank (1..60) to 0..100 score (Rank 1 -> 98.5, Rank 10 -> 89.5, etc.)
      const computedScore = Math.max(40, Math.min(99, 100 - webdevRank * 1.05));

      const rec = makeScoreRecord({
        benchmarkId: 'webdev-arena',
        rawModelName,
        rawProvider: m.organization,
        rawScore: computedScore,
        displayScore: `#${webdevRank} Global (${computedScore.toFixed(1)} pts)`,
        sourceId: 'lmarena-webdev',
        sourceUrl: 'https://web.lmarena.ai/leaderboard/webdev',
        nowIso,
        metadata: {
          notes: `Ranking oficial WebDev Arena: #${webdevRank}`,
        },
      });
      if (rec) results.push(rec);
    }
  } catch {
    // ignore
  }

  return results;
}

/**
 * 9. ArtifactsBench JS bundle parser
 */
export function parseArtifactsBenchJs(
  jsContent: string,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  const results: BenchmarkScoreRecord[] = [];
  const startMarker = '{"performances":[{"AVG":';
  const startIdx = jsContent.indexOf(startMarker);
  if (startIdx === -1) return results;

  const endIdx = jsContent.indexOf("}')", startIdx);
  if (endIdx === -1) return results;

  try {
    const jsonStr = jsContent.slice(startIdx, endIdx + 1);
    const parsed = JSON.parse(jsonStr);
    const list = parsed.performances || [];
    for (const item of list) {
      const rawModelName = item.model;
      const rawScore = Number(item.AVG);
      if (!rawModelName || !Number.isFinite(rawScore)) continue;

      const subscores: Record<string, number> = {};
      for (const k of ['WEB', 'SVG', 'GAME', 'SI', 'MMD', 'HD', 'II', 'SV', 'MS']) {
        if (typeof item[k] === 'number') subscores[k] = item[k];
      }

      const rec = makeScoreRecord({
        benchmarkId: 'artifactsbench',
        rawModelName,
        rawScore,
        displayScore: `${rawScore.toFixed(2)} pts`,
        sourceId: 'artifactsbench',
        sourceUrl: 'https://artifactsbenchmark.github.io/leaderboard.html',
        nowIso,
        metadata: {
          subscores: Object.keys(subscores).length > 0 ? subscores : null,
        },
      });
      if (rec) results.push(rec);
    }
  } catch {
    // ignore
  }

  return results;
}

/**
 * 10. OmegaUse-OfficeVal HTML/JS parser
 */
export function parseOmegaUseOfficeValHtml(
  html: string,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  const results: BenchmarkScoreRecord[] = [];
  const match = html.match(/const\s+leaderboardData\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return results;

  try {
    // Convert JS object literal array to valid JSON
    const jsonText = match[1]
      .replace(/(\w+)\s*:/g, '"$1":')
      .replace(/,\s*([}\]])/g, '$1');
    const items = JSON.parse(jsonText);
    for (const item of items) {
      if (item.type === 'human' || item.model === 'Human') continue;
      const rawScore = Number(item.score);
      if (!item.model || !Number.isFinite(rawScore)) continue;

      const rec = makeScoreRecord({
        benchmarkId: 'omegause-officeval',
        rawModelName: item.model,
        rawScore,
        displayScore: `${rawScore.toFixed(2)} / 30 (PriceW: ${item.priceWeighted})`,
        sourceId: 'omegause-officeval',
        sourceUrl: 'https://omegause-officeval.github.io/',
        nowIso,
        metadata: {
          costUsd: typeof item.cost === 'number' ? item.cost : null,
          subscores: {
            Score: rawScore,
            TimeWeighted: Number(item.timeWeighted) || 0,
            PriceWeighted: Number(item.priceWeighted) || 0,
          },
        },
      });
      if (rec) results.push(rec);
    }
  } catch {
    // ignore
  }

  return results;
}

/**
 * 11. Deterministic Manual Import Parser (JSON or CSV)
 */
export function parseManualImportPayload(
  format: 'json' | 'csv',
  content: string,
  defaultBenchmarkId?: string,
  nowIso = new Date().toISOString()
): BenchmarkScoreRecord[] {
  const results: BenchmarkScoreRecord[] = [];

  if (format === 'json') {
    const parsed = JSON.parse(content);
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.scores)
        ? parsed.scores
        : Array.isArray(parsed.entries)
          ? parsed.entries
          : [];

    for (const row of rows) {
      const benchmarkId = row.benchmarkId || row.benchmark || defaultBenchmarkId;
      const rawModelName = row.model || row.modelName || row.systemName;
      const rawScore = Number(row.score ?? row.rawScore ?? row.scoreValue);
      if (!benchmarkId || !rawModelName || !Number.isFinite(rawScore)) continue;

      const rec = makeScoreRecord({
        benchmarkId,
        rawModelName,
        rawProvider: row.provider || row.organization || null,
        explicitEffort: row.effort || row.reasoning_effort || null,
        rawScore,
        displayScore: row.displayScore || undefined,
        sourceId: BENCHMARK_MAP.get(benchmarkId)?.adapterSourceId || 'manual-import',
        sourceUrl:
          row.sourceUrl ||
          BENCHMARK_MAP.get(benchmarkId)?.officialUrl ||
          'manual://import',
        originType: 'manual',
        reportedAt: row.reportedAt || nowIso.slice(0, 10),
        nowIso,
        metadata: {
          notes: row.notes || 'Importado manualmente via JSON determinístico',
          costUsd: typeof row.costUsd === 'number' ? row.costUsd : null,
        },
      });
      if (rec) results.push(rec);
    }
  } else {
    // CSV format: benchmarkId,model,provider,effort,score,sourceUrl,notes
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    if (lines.length < 2) return results;

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = cols[idx] ?? '';
      });

      const benchmarkId =
        rowMap['benchmarkid'] || rowMap['benchmark'] || defaultBenchmarkId;
      const rawModelName = rowMap['model'] || rowMap['modelname'];
      const rawScore = parseFloat(rowMap['score'] || rowMap['rawscore']);
      if (!benchmarkId || !rawModelName || !Number.isFinite(rawScore)) continue;

      const rec = makeScoreRecord({
        benchmarkId,
        rawModelName,
        rawProvider: rowMap['provider'] || rowMap['organization'] || null,
        explicitEffort: rowMap['effort'] || rowMap['reasoning_effort'] || null,
        rawScore,
        sourceId: BENCHMARK_MAP.get(benchmarkId)?.adapterSourceId || 'manual-import',
        sourceUrl:
          rowMap['sourceurl'] ||
          BENCHMARK_MAP.get(benchmarkId)?.officialUrl ||
          'manual://csv-import',
        originType: 'manual',
        nowIso,
        metadata: {
          notes: rowMap['notes'] || 'Importado manualmente via CSV determinístico',
        },
      });
      if (rec) results.push(rec);
    }
  }

  return results;
}