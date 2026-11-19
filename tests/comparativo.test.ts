import { describe, expect, it } from 'vitest';
import { USE_CASES, WEIGHT_PRESETS } from '../src/shared/catalog.js';
import {
  clampNormalizedScore,
  extractEffortLevel,
  normalizeModel,
  normalizeProvider,
} from '../src/shared/normalizer.js';
import {
  buildPerBenchmarkRankings,
  calculateOverallRanking,
  evaluateBenchmarkFrontierCoverage,
  getFrontierQualifiedBenchmarkIds,
  isFrontierModel,
  limitTopModelsPerProvider,
} from '../src/shared/ranking.js';
import { RankedModelEntry } from '../src/shared/types.js';
import { BenchmarkDatabase } from '../src/server/db.js';
import {
  parseArtificialAnalysisHtmlOrJson,
  parseArtifactsBenchJs,
  parseLMArenaWebDevHtml,
  parseManualImportPayload,
  parseOmegaUseOfficeValHtml,
  parseScaleSweBenchProHtml,
  parseSpreadsheetBenchJson,
  parseSteelLeaderboardJson,
  parseTau2SubmissionJson,
  parseTbenchHtml,
  parseValsBenchmarkHtml,
} from '../src/server/parsers.js';
import { DeterministicScheduler } from '../src/server/scheduler.js';

describe('1. Normalização Determinística de Modelos, Provedores e Nível de Esforço', () => {
  it('agrupa o mesmo modelo publicado com nomes diferentes entre leaderboards', () => {
    const fromTbench = normalizeModel('Opus 5.5 ( max )');
    const fromAA = normalizeModel(
      'Claude Opus 5.5 (Max, Default Fallback)',
      'Anthropic',
      'Max, Default Fallback'
    );
    const fromVals = normalizeModel('Claude Opus 5.5');

    expect(fromTbench.canonicalId).toBe('claude-opus-5-5');
    expect(fromAA.canonicalId).toBe('claude-opus-5-5');
    expect(fromVals.canonicalId).toBe('claude-opus-5-5');
    expect(fromTbench.provider).toBe('Anthropic');
    expect(fromTbench.effort).toBe('max');
    expect(fromAA.effort).toBe('max');
    expect(fromVals.effort).toBe('default');
  });

  it('extrai corretamente todos os níveis de esforço (low, medium, high, xhigh, max, thinking, non-thinking, default)', () => {
    expect(extractEffortLevel('Gemini 4 Carbon ( high )')).toBe('high');
    expect(extractEffortLevel('Fable 5.1 ( xhigh )')).toBe('xhigh');
    expect(extractEffortLevel('GPT-6 Luna (low)')).toBe('low');
    expect(extractEffortLevel('Nova 2.0 Omni (Medium)', 'Medium')).toBe('medium');
    expect(extractEffortLevel('claude-opus-4-6 (thinking)*')).toBe('thinking');
    expect(extractEffortLevel('gpt-5-2-none')).toBe('non-thinking');
    expect(extractEffortLevel('DeepSeek V4 Pro')).toBe('default');
  });

  it('normaliza pontuações para a escala 0-100 respeitando limites', () => {
    expect(clampNormalizedScore(1550, 800, 1800, true)).toBe(75);
    expect(clampNormalizedScore(2000, 800, 1800, true)).toBe(100);
    expect(clampNormalizedScore(500, 800, 1800, true)).toBe(0);
  });
});

describe('2. Cálculo da Classificação Geral (Overall Ranking) com Pesos e Substitutos', () => {
  const sampleScores = parseManualImportPayload(
    'json',
    JSON.stringify([
      // Modelo A tem primários nos Casos 1 e 4, e substituto no Caso 2
      {
        benchmarkId: 'browsecomp',
        model: 'Claude Fable 5.2 (Max)',
        provider: 'Anthropic',
        effort: 'max',
        score: 90,
      },
      {
        benchmarkId: 'terminal-bench-2-1',
        model: 'Claude Fable 5.2 (Max)',
        provider: 'Anthropic',
        effort: 'max',
        score: 70,
      },
      {
        benchmarkId: 'aa-intelligence-index',
        model: 'Claude Fable 5.2 (Max)',
        provider: 'Anthropic',
        effort: 'max',
        score: 65,
      },
      // Modelo B tem variante high e low
      {
        benchmarkId: 'browsecomp',
        model: 'Gemini 4 Carbon (High)',
        provider: 'Google',
        effort: 'high',
        score: 88,
      },
      {
        benchmarkId: 'browsecomp',
        model: 'Gemini 4 Carbon (Low)',
        provider: 'Google',
        effort: 'low',
        score: 72,
      },
    ])
  );

  it('calcula cobertura e aciona benchmarks substitutos quando includeSubstitutes=true', () => {
    const withSub = calculateOverallRanking(sampleScores, {
      weights: WEIGHT_PRESETS[0].weights,
      includeSubstitutes: true,
    });
    const withoutSub = calculateOverallRanking(sampleScores, {
      weights: WEIGHT_PRESETS[0].weights,
      includeSubstitutes: false,
    });

    const fableWithSub = withSub.find(
      (m) => m.modelCanonicalId === 'claude-fable-5-2'
    )!;
    const fableWithoutSub = withoutSub.find(
      (m) => m.modelCanonicalId === 'claude-fable-5-2'
    )!;

    expect(fableWithSub.primaryBenchmarksCovered).toBe(2);
    expect(fableWithSub.substituteBenchmarksUsed).toBeGreaterThan(0);
    // Com substituto AA Intelligence Index, o Caso 2 também fica coberto
    expect(fableWithSub.useCasesCovered).toBeGreaterThan(
      fableWithoutSub.useCasesCovered
    );
    expect(fableWithoutSub.substituteBenchmarksUsed).toBe(0);
  });

  it('permite selecionar exatamente a variante de esforço (high vs low) por modelo', () => {
    const highRank = calculateOverallRanking(sampleScores, {
      weights: WEIGHT_PRESETS[0].weights,
      includeSubstitutes: false,
      modelEffortOverrides: { 'gemini-4-carbon': 'high' },
    });
    const lowRank = calculateOverallRanking(sampleScores, {
      weights: WEIGHT_PRESETS[0].weights,
      includeSubstitutes: false,
      modelEffortOverrides: { 'gemini-4-carbon': 'low' },
    });

    const geminiHigh = highRank.find(
      (m) => m.modelCanonicalId === 'gemini-4-carbon'
    )!;
    const geminiLow = lowRank.find(
      (m) => m.modelCanonicalId === 'gemini-4-carbon'
    )!;

    expect(geminiHigh.overallScore).toBe(88);
    expect(geminiLow.overallScore).toBe(72);
  });
});

describe('3. Parsers Determinísticos dos Adaptadores (Fixtures Reais)', () => {
  it('parseia fixture real do Artificial Analysis (initialModels JSON)', () => {
    const fixture = JSON.stringify({
      initialModels: [
        {
          id: '0c9b4e05',
          name: 'Claude Fable 5.2 (Max, Default Fallback)',
          suffix: 'Max, Default Fallback',
          isReasoning: true,
          modelCreatorName: 'Anthropic',
          intelligenceIndex: 65.0,
          price1mInputTokens: 8,
          price1mOutputTokens: 40,
          outputSpeed: 113.0,
          timeToFirstAnswerToken: 9.87,
          scores: {
            'gdpval-aa-normalized': 1591.13,
            'artificial-analysis-long-context-reasoning': 0.8,
            'tau2-bench': 0.91,
            'gpqa-diamond': 0.85,
            scicode: 0.6,
          },
        },
      ],
    });

    const records = parseArtificialAnalysisHtmlOrJson(fixture);
    expect(records.length).toBeGreaterThanOrEqual(6);
    const gdp = records.find((r) => r.benchmarkId === 'gdpval-aa')!;
    expect(gdp).toBeDefined();
    expect(gdp.modelCanonicalId).toBe('claude-fable-5-2');
    expect(gdp.effort).toBe('max');
    expect(gdp.rawScore).toBe(1591.13);
    expect(gdp.metadata?.priceInput1M).toBe(8);
  });

  it('parseia fixture HTML real do Vals Legal Research Bench e Terminal-Bench 2.1', () => {
    const valsHtml = `
      <table>
        <tr><th>Rank</th><th>Model</th><th>All-Pass</th><th>Cost / Test</th></tr>
        <tr><td>1</td><th>Gemini 4 Carbon</th><td>55.77%</td><td>$8.74</td></tr>
        <tr><td>2</td><th>Claude Opus 5</th><td>55.29%</td><td>$6.76</td></tr>
      </table>
    `;
    const valsRecords = parseValsBenchmarkHtml(
      valsHtml,
      'vals-legal-research',
      'vals-legal-research',
      'https://www.vals.ai/benchmarks/legal_research'
    );
    expect(valsRecords).toHaveLength(2);
    expect(valsRecords[0].modelCanonicalId).toBe('gemini-4-carbon');
    expect(valsRecords[0].rawScore).toBe(55.77);

    const tbenchHtml = `
      <table>
        <tr><td>1</td><td>Opus 5.5 ( max )</td><td>Claude Code</td><td>65.8% ± 3.1%</td><td>Sep 22, 2026</td></tr>
      </table>
    `;
    const tbRecords = parseTbenchHtml(tbenchHtml);
    expect(tbRecords).toHaveLength(1);
    expect(tbRecords[0].modelCanonicalId).toBe('claude-opus-5-5');
    expect(tbRecords[0].effort).toBe('max');
    expect(tbRecords[0].rawScore).toBe(65.8);
  });

  it('parseia fixtures reais de tau2-bench, Steel, SpreadsheetBench V2, Scale SWE-bench Pro V2, LMArena WebDev, ArtifactsBench e OmegaUse-OfficeVal', () => {
    const tauRec = parseTau2SubmissionJson({
      model_name: 'Claude Opus 4.5',
      model_organization: 'Anthropic',
      reasoning_effort: 'high',
      submission_date: '2026-02-26',
      results: {
        airline: { pass_1: 84.0, cost: 0.4 },
        retail: { pass_1: 80.0, cost: 0.4 },
        telecom: { pass_1: 91.0, cost: 0.7 },
      },
    });
    expect(tauRec).not.toBeNull();
    expect(tauRec!.rawScore).toBe(85);
    expect(tauRec!.effort).toBe('high');

    const steelRecs = parseSteelLeaderboardJson(
      {
        browsecomp: [
          {
            rank: 1,
            systemName: 'GPT-6 Astra',
            organization: 'OpenAI',
            scoreDisplay: '91.5%',
            scoreValue: 91.5,
          },
        ],
      },
      'browsecomp',
      'steel-leaderboard',
      'https://github.com/steel-dev/leaderboard'
    );
    expect(steelRecs).toHaveLength(1);
    expect(steelRecs[0].modelCanonicalId).toBe('gpt-6-astra');

    const ssbRecs = parseSpreadsheetBenchJson(
      [
        {
          model: 'Claude Opus 4.6',
          organization: 'Anthropic',
          score: 34.89,
          subscores: { Template: 52.58, 'Fin.Model': 34, Debug: 12, Visualization: 62.5 },
        },
      ],
      'spreadsheetbench-2'
    );
    expect(ssbRecs).toHaveLength(1);
    expect(ssbRecs[0].rawScore).toBe(34.89);

    const scaleRecs = parseScaleSweBenchProHtml(
      `{"leaderboardTitle":"SWE-Bench Pro V2","variants":[{"entries":[{"model":"Opus 5 (Claude Code) xhigh","score":99.4,"company":"anthropic"}]}]}`
    );
    expect(scaleRecs).toHaveLength(1);
    expect(scaleRecs[0].effort).toBe('xhigh');
    expect(scaleRecs[0].rawScore).toBe(99.4);

    const lmaRecs = parseLMArenaWebDevHtml(
      `{"initialModels":[{"id":"1","organization":"anthropic","publicName":"claude-sonnet-5-5-high","displayName":"claude-sonnet-5-5-high","rankByModality":{"chat":5,"webdev":9}}]}`
    );
    expect(lmaRecs).toHaveLength(1);
    expect(lmaRecs[0].modelCanonicalId).toBe('claude-sonnet-5-5');
    expect(lmaRecs[0].effort).toBe('high');

    const artRecs = parseArtifactsBenchJs(
      `_g=JSON.parse('{"performances":[{"AVG":72.55,"model":"GPT-5","WEB":71.31}]}')`
    );
    expect(artRecs).toHaveLength(1);
    expect(artRecs[0].rawScore).toBe(72.55);

    const omegaRecs = parseOmegaUseOfficeValHtml(`
      const leaderboardData = [
        { model: "Human", type: "human", score: 27.79, timeWeighted: 54.45, priceWeighted: 144.61, cost: 6.85 },
        { model: "GLM-5.2", type: "model", score: 17.91, timeWeighted: 30.13, priceWeighted: 93.51, cost: 1.48 }
      ];
    `);
    expect(omegaRecs).toHaveLength(1);
    expect(omegaRecs[0].modelCanonicalId).toBe('glm-5-2');
  });

  it('parseia importação manual determinística em CSV e JSON', () => {
    const csv = `benchmarkId,model,provider,effort,score,sourceUrl,notes
bluefin,Claude Fable 5.2 (Max),Anthropic,max,88.5,https://example.com,Teste CSV`;
    const recs = parseManualImportPayload('csv', csv);
    expect(recs).toHaveLength(1);
    expect(recs[0].originType).toBe('manual');
    expect(recs[0].benchmarkId).toBe('bluefin');
    expect(recs[0].rawScore).toBe(88.5);
  });
});

describe('4. Agendador de 5 Minutos (300000 ms) e Persistência SQLite', () => {
  it('configura o intervalo padrão de 300000 ms (5 minutos) e persiste execuções no SQLite', async () => {
    const db = new BenchmarkDatabase(':memory:', './data/test-snapshot.json');
    const mockRunner = async () => [
      {
        statusRecord: {
          sourceId: 'vals-legal-research',
          name: 'Vals Legal Research',
          officialUrl: 'https://www.vals.ai/benchmarks/legal_research',
          endpointUrl: 'https://www.vals.ai/benchmarks/legal_research',
          status: 'live' as const,
          recordsCount: 1,
          lastSyncAt: new Date().toISOString(),
          lastSuccessAt: new Date().toISOString(),
          durationMs: 120,
          technicalReason: 'OK',
          httpStatus: 200,
        },
        scores: parseValsBenchmarkHtml(
          `<table><tr><td>1</td><th>Gemini 4 Carbon</th><td>55.77%</td></tr></table>`,
          'vals-legal-research',
          'vals-legal-research',
          'https://www.vals.ai/benchmarks/legal_research'
        ),
      },
    ];

    const scheduler = new DeterministicScheduler(db, 300000, mockRunner);
    expect(scheduler.getIntervalMs()).toBe(300000);
    expect(USE_CASES).toHaveLength(7);

    const runLog = await scheduler.executeSync('manual');
    expect(runLog.liveSources).toBe(1);
    expect(runLog.modelsDiscovered).toBe(1);
    expect(db.getAllScores()).toHaveLength(1);

    db.close();
  });
});

describe('5. Normalização Determinística de Provedores por Família de Modelo', () => {
  it('mapeia famílias OpenAI, Google, Anthropic e Meta corretamente mesmo quando rawProvider está vazio', () => {
    // OpenAI
    expect(normalizeModel('GPT-6 Sol').provider).toBe('OpenAI');
    expect(normalizeModel('GPT-5.6 Terra').provider).toBe('OpenAI');
    expect(normalizeModel('GPT-5.6 Luna').provider).toBe('OpenAI');
    expect(normalizeModel('o1-2024-12-17').provider).toBe('OpenAI');
    expect(normalizeModel('o3').provider).toBe('OpenAI');
    expect(normalizeModel('o4-mini').provider).toBe('OpenAI');
    expect(normalizeProvider('', 'gpt-4.1-mini')).toBe('OpenAI');

    // Google
    expect(normalizeModel('Gemini 4 Neon').provider).toBe('Google');
    expect(normalizeModel('Gemini 3.7 Flash').provider).toBe('Google');
    expect(normalizeModel('Gemma 2 (27B)').provider).toBe('Google');
    expect(normalizeModel('Gemma3-12B-it').provider).toBe('Google');

    // Anthropic
    expect(normalizeModel('Claude 4.0-Sonnet').provider).toBe('Anthropic');
    expect(normalizeModel('Claude 4.0-Sonnet').canonicalId).toBe('claude-sonnet-4');
    expect(normalizeModel('Claude Haiku 4.5 (Thinking)').provider).toBe('Anthropic');

    // Meta
    expect(normalizeModel('Llama 4 Maverick').provider).toBe('Meta');
    expect(normalizeModel('Muse Spark 1.3').provider).toBe('Meta');
    expect(normalizeModel('Muse Wonder ( xhigh )').provider).toBe('Meta');
    expect(normalizeModel('Muse Ember').provider).toBe('Meta');

    // MiniMax & NVIDIA derivative preservation
    expect(normalizeModel('Minimax M3p1 Flash', 'OpenAI').provider).toBe('MiniMax');
    expect(normalizeProvider('Nous Research', 'Hermes 4 - Llama-3.1 70B')).toBe(
      'Nous Research'
    );
    expect(normalizeProvider(null, 'Llama 3.3 Nemotron Super')).toBe('NVIDIA');
  });
});

describe('6. Limite Determinístico de Top 4 Modelos por Provedor', () => {
  function makeMockEntry(
    id: string,
    displayName: string,
    provider: string,
    overallScore: number,
    primaryBenchmarksCovered: number,
    useCasesCovered = 5
  ): RankedModelEntry {
    return {
      modelCanonicalId: id,
      displayName,
      provider,
      selectedEffort: 'default',
      availableEfforts: ['default'],
      overallScore,
      useCasesCovered,
      totalUseCases: 7,
      primaryBenchmarksCovered,
      totalPrimaryBenchmarks: 9,
      substituteBenchmarksUsed: 0,
      isFrontier: isFrontierModel(id, displayName),
      useCaseScores: {},
    };
  }

  it('mantém estritamente no máximo 4 modelos por provedor ordenados por overallScore com desempate por primaryBenchmarksCovered e fronteira', () => {
    const entries: RankedModelEntry[] = [
      // 6 OpenAI models (including ties on overallScore)
      makeMockEntry('gpt-6-2-astra', 'GPT-6.2 Astra', 'OpenAI', 92, 6),
      makeMockEntry('gpt-6-1-sol', 'GPT-6.1 Sol', 'OpenAI', 89, 5),
      makeMockEntry('gpt-5-6-sol', 'GPT-5.6 Sol', 'OpenAI', 85, 5),
      makeMockEntry('gpt-5-6-terra', 'GPT-5.6 Terra', 'OpenAI', 85, 4), // tie overallScore 85, lower primary than 5.6 Sol, higher than legacy
      makeMockEntry('gpt-4o', 'GPT-4o', 'OpenAI', 85, 4), // tie overallScore 85 & primary 4, loses tie-break to frontier GPT-5.6 Terra
      makeMockEntry('gpt-3-5', 'GPT-3.5', 'OpenAI', 60, 1),
      // 5 Anthropic models
      makeMockEntry('claude-fable-5-2', 'Claude Fable 5.2', 'Anthropic', 94, 7),
      makeMockEntry('claude-opus-5-5', 'Claude Opus 5.5', 'Anthropic', 91, 6),
      makeMockEntry('claude-sonnet-5-5', 'Claude Sonnet 5.5', 'Anthropic', 88, 5),
      makeMockEntry('claude-opus-5', 'Claude Opus 5', 'Anthropic', 86, 5),
      makeMockEntry('claude-3-5-haiku', 'Claude 3.5 Haiku', 'Anthropic', 70, 2),
    ];

    const top4 = limitTopModelsPerProvider(entries, 4);
    const openai = top4.filter((m) => m.provider === 'OpenAI');
    const anthropic = top4.filter((m) => m.provider === 'Anthropic');

    expect(openai).toHaveLength(4);
    expect(anthropic).toHaveLength(4);
    expect(openai.map((m) => m.modelCanonicalId)).toEqual([
      'gpt-6-2-astra',
      'gpt-6-1-sol',
      'gpt-5-6-sol',
      'gpt-5-6-terra',
    ]);
    // Legacy models gpt-4o, gpt-3-5, claude-3-5-haiku eliminated
    expect(top4.some((m) => m.modelCanonicalId === 'gpt-4o')).toBe(false);
    expect(top4.some((m) => m.modelCanonicalId === 'gpt-3-5')).toBe(false);
    expect(top4.some((m) => m.modelCanonicalId === 'claude-3-5-haiku')).toBe(
      false
    );
    // Global ranking remains sorted descending by overallScore
    expect(top4[0].modelCanonicalId).toBe('claude-fable-5-2');
    expect(top4[1].modelCanonicalId).toBe('gpt-6-2-astra');
  });
});

describe('7. Filtro Estrito de Provedores Sem Vazamento e Tabelas Separadas por Benchmark', () => {
  const multiProviderScores = parseManualImportPayload(
    'json',
    JSON.stringify([
      // BrowseComp (6 models across 3 providers, including 5 OpenAI to test Top 4 limit)
      { benchmarkId: 'browsecomp', model: 'Claude Fable 5.2', provider: 'Anthropic', score: 93 },
      { benchmarkId: 'browsecomp', model: 'Gemini 4 Carbon', provider: 'Google', score: 91 },
      { benchmarkId: 'browsecomp', model: 'GPT-6.2 Astra (High)', provider: 'OpenAI', effort: 'high', score: 94 },
      { benchmarkId: 'browsecomp', model: 'GPT-6.2 Astra (Low)', provider: 'OpenAI', effort: 'low', score: 80 },
      { benchmarkId: 'browsecomp', model: 'GPT-6.1 Sol', provider: 'OpenAI', score: 90 },
      { benchmarkId: 'browsecomp', model: 'GPT-6 Sol', score: 88 }, // rawProvider omitted -> must resolve to OpenAI!
      { benchmarkId: 'browsecomp', model: 'GPT-5.6 Terra', score: 86 }, // rawProvider omitted -> OpenAI
      { benchmarkId: 'browsecomp', model: 'GPT-4o', score: 70 }, // 5th OpenAI model -> cut by Top 4
      { benchmarkId: 'browsecomp', model: 'Muse Spark 1.3', provider: 'Meta', score: 85 },
      // Terminal-Bench 2.1
      { benchmarkId: 'terminal-bench-2-1', model: 'Claude Fable 5.2', provider: 'Anthropic', score: 78 },
      { benchmarkId: 'terminal-bench-2-1', model: 'Gemini 4 Carbon', provider: 'Google', score: 82 },
      { benchmarkId: 'terminal-bench-2-1', model: 'GPT-6.2 Astra (High)', provider: 'OpenAI', effort: 'high', score: 84 },
      { benchmarkId: 'terminal-bench-2-1', model: 'Muse Spark 1.3', provider: 'Meta', score: 74 },
    ])
  );

  it('garante zero vazamento de provedores não selecionados no ranking composto e nas tabelas por benchmark', () => {
    const selectedProviders = ['Anthropic', 'Google'];

    const overall = calculateOverallRanking(multiProviderScores, {
      weights: WEIGHT_PRESETS[0].weights,
      includeSubstitutes: true,
      providerFilter: selectedProviders,
      // Even if selectedModelIds contains an OpenAI model ID, providerFilter MUST block it!
      selectedModelIds: ['claude-fable-5-2', 'gemini-4-carbon', 'gpt-6-2-astra'],
      maxModelsPerProvider: 4,
    });
    expect(overall.length).toBeGreaterThan(0);
    expect(overall.every((m) => selectedProviders.includes(m.provider))).toBe(true);
    expect(overall.some((m) => m.provider === 'OpenAI')).toBe(false);
    expect(overall.some((m) => m.provider === 'Meta')).toBe(false);

    const tables = buildPerBenchmarkRankings(multiProviderScores, {
      includeSubstitutes: true,
      providerFilter: selectedProviders,
      selectedModelIds: ['claude-fable-5-2', 'gemini-4-carbon', 'gpt-6-2-astra'],
      maxModelsPerProvider: 4,
    });
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      expect(table.rows.every((r) => selectedProviders.includes(r.provider))).toBe(
        true
      );
      expect(table.rows.some((r) => r.provider === 'OpenAI')).toBe(false);
    }
  });

  it('gera tabelas separadas por benchmark ordenadas do melhor para o pior respeitando esforço e Top 4 por provedor', () => {
    const tables = buildPerBenchmarkRankings(multiProviderScores, {
      includeSubstitutes: true,
      preferredEffort: 'best',
      maxModelsPerProvider: 4,
    });

    expect(tables).toHaveLength(2);
    const browseTable = tables.find((t) => t.benchmarkId === 'browsecomp')!;
    const tbTable = tables.find((t) => t.benchmarkId === 'terminal-bench-2-1')!;

    expect(browseTable).toBeDefined();
    expect(tbTable).toBeDefined();

    // Verify strictly sorted best -> worst in BrowseComp
    for (let i = 1; i < browseTable.rows.length; i++) {
      expect(browseTable.rows[i - 1].rawScore).toBeGreaterThanOrEqual(
        browseTable.rows[i].rawScore
      );
      expect(browseTable.rows[i - 1].rank).toBe(i);
    }
    expect(browseTable.rows[0].modelCanonicalId).toBe('gpt-6-2-astra');
    expect(browseTable.rows[0].rawScore).toBe(94);

    // OpenAI had 5 models in BrowseComp; strictly capped at 4 (gpt-4o dropped)
    const openaiRows = browseTable.rows.filter((r) => r.provider === 'OpenAI');
    expect(openaiRows).toHaveLength(4);
    expect(openaiRows.some((r) => r.modelCanonicalId === 'gpt-4o')).toBe(false);

    // Verify effort override changes ranking position deterministically
    const tablesWithLowOverride = buildPerBenchmarkRankings(multiProviderScores, {
      includeSubstitutes: true,
      preferredEffort: 'best',
      modelEffortOverrides: { 'gpt-6-2-astra': 'low' },
      maxModelsPerProvider: 4,
    });
    const browseLow = tablesWithLowOverride.find(
      (t) => t.benchmarkId === 'browsecomp'
    )!;
    // With GPT-6.2 Astra forced to low (80), Claude Fable 5.2 (93) takes #1
    expect(browseLow.rows[0].modelCanonicalId).toBe('claude-fable-5-2');
    const astraRow = browseLow.rows.find(
      (r) => r.modelCanonicalId === 'gpt-6-2-astra'
    )!;
    expect(astraRow.rawScore).toBe(80);
    expect(astraRow.effort).toBe('low');
  });
});

describe('8. Filtro Determinístico de Benchmarks sem Modelos de Fronteira', () => {
  const mixedFrontierAndLegacyScores = parseManualImportPayload(
    'json',
    JSON.stringify([
      // QUALIFIED PRIMARY (UC 1): browsecomp — 4 frontier models across 4 major frontier labs
      { benchmarkId: 'browsecomp', model: 'Claude Fable 5.2', provider: 'Anthropic', score: 92 },
      { benchmarkId: 'browsecomp', model: 'GPT-6.2 Astra', provider: 'OpenAI', score: 91 },
      { benchmarkId: 'browsecomp', model: 'Gemini 4 Carbon', provider: 'Google', score: 89 },
      { benchmarkId: 'browsecomp', model: 'Muse Spark 1.3', provider: 'Meta', score: 86 },

      // LEGACY-ONLY PRIMARY (UC 6): artifactsbench — only old models, 0 frontier models -> MUST BE HIDDEN
      { benchmarkId: 'artifactsbench', model: 'GPT-4o', provider: 'OpenAI', score: 72 },
      { benchmarkId: 'artifactsbench', model: 'Claude 3.5 Sonnet', provider: 'Anthropic', score: 71 },
      { benchmarkId: 'artifactsbench', model: 'Gemini 2.0 Flash', provider: 'Google', score: 69 },
      { benchmarkId: 'artifactsbench', model: 'Llama 3.3 70B', provider: 'Meta', score: 65 },

      // LOW-FRONTIER PRIMARY (UC 3): spreadsheetbench-2 — only 1 frontier model -> MUST BE HIDDEN
      { benchmarkId: 'spreadsheetbench-2', model: 'Gemini 3.1 Pro', provider: 'Google', score: 60 },
      { benchmarkId: 'spreadsheetbench-2', model: 'GPT-5.2', provider: 'OpenAI', score: 58 },
      { benchmarkId: 'spreadsheetbench-2', model: 'Claude Opus 4.6', provider: 'Anthropic', score: 55 },

      // QUALIFIED SUBSTITUTE (UC 3): aa-coding-math-index — 4 frontier models across 3+ major labs -> MUST QUALIFY
      { benchmarkId: 'aa-coding-math-index', model: 'Claude Fable 5.2', provider: 'Anthropic', score: 84 },
      { benchmarkId: 'aa-coding-math-index', model: 'GPT-6.2 Astra', provider: 'OpenAI', score: 86 },
      { benchmarkId: 'aa-coding-math-index', model: 'Gemini 4 Carbon', provider: 'Google', score: 82 },
      { benchmarkId: 'aa-coding-math-index', model: 'Muse Wonder 1.0', provider: 'Meta', score: 80 },

      // INSUFFICIENT MAJOR LAB COVERAGE (UC 7): omegause-officeval — 4 non-Big4 models, 0/4 major labs -> MUST BE HIDDEN
      { benchmarkId: 'omegause-officeval', model: 'GLM-5.2', provider: 'Z.AI (Zhipu)', score: 20 },
      { benchmarkId: 'omegause-officeval', model: 'Kimi K2.6', provider: 'Moonshot AI', score: 19 },
      { benchmarkId: 'omegause-officeval', model: 'DeepSeek V4 Pro', provider: 'DeepSeek', score: 18 },
      { benchmarkId: 'omegause-officeval', model: 'MiniMax-M3', provider: 'MiniMax', score: 17 },
    ])
  );

  it('oculta benchmarks com 0 registros, apenas modelos antigos ou cobertura insuficiente de laboratórios de fronteira', () => {
    const qualified = getFrontierQualifiedBenchmarkIds(
      mixedFrontierAndLegacyScores
    );
    const diagnostics = evaluateBenchmarkFrontierCoverage(
      mixedFrontierAndLegacyScores
    );

    expect(qualified.has('browsecomp')).toBe(true);
    expect(qualified.has('aa-coding-math-index')).toBe(true);

    // Hidden legacy / low-frontier / 0-record benchmarks
    expect(qualified.has('artifactsbench')).toBe(false);
    expect(qualified.has('spreadsheetbench-2')).toBe(false);
    expect(qualified.has('omegause-officeval')).toBe(false);
    expect(qualified.has('bluefin')).toBe(false); // 0 records
    expect(qualified.has('gaia')).toBe(false); // 0 records

    const artifactsDiag = diagnostics.find(
      (d) => d.benchmarkId === 'artifactsbench'
    )!;
    expect(artifactsDiag.qualified).toBe(false);
    expect(artifactsDiag.frontierModelsCount).toBe(0);

    // Per-benchmark tables must NEVER include hidden benchmarks
    const tables = buildPerBenchmarkRankings(mixedFrontierAndLegacyScores, {
      includeSubstitutes: true,
      onlyFrontierQualified: true,
      maxModelsPerProvider: 4,
    });
    const tableIds = tables.map((t) => t.benchmarkId);
    expect(tableIds).toContain('browsecomp');
    expect(tableIds).toContain('aa-coding-math-index');
    expect(tableIds).not.toContain('artifactsbench');
    expect(tableIds).not.toContain('spreadsheetbench-2');
    expect(tableIds).not.toContain('omegause-officeval');
  });

  it('calcula o ranking composto de um Caso de Uso usando apenas substitutos qualificados quando os primários foram ocultados', () => {
    const ranked = calculateOverallRanking(mixedFrontierAndLegacyScores, {
      weights: WEIGHT_PRESETS[0].weights,
      includeSubstitutes: true,
      onlyFrontierQualified: true,
      maxModelsPerProvider: 4,
    });

    // Legacy-only models from hidden artifactsbench should NOT appear at all
    expect(ranked.some((m) => m.modelCanonicalId === 'gpt-4o')).toBe(false);
    expect(ranked.some((m) => m.modelCanonicalId === 'glm-5-2')).toBe(false);

    const fable = ranked.find((m) => m.modelCanonicalId === 'claude-fable-5-2')!;
    expect(fable).toBeDefined();
    // UC 1 scored via qualified primary browsecomp (92)
    expect(fable.useCaseScores['uc-1-legal-tax-search'].score).toBe(92);
    // UC 3 had all primaries hidden (bluefin 0 records, spreadsheetbench-2 hidden),
    // so UC 3 is scored via qualified substitute aa-coding-math-index (84)
    expect(fable.useCaseScores['uc-3-excel-spreadsheets'].score).toBe(84);
    expect(
      fable.useCaseScores['uc-3-excel-spreadsheets'].usedSubstituteCount
    ).toBe(1);
    // Overall composite average of UC 1 (92) and UC 3 (84) = 88
    expect(fable.overallScore).toBe(88);
  });
});
