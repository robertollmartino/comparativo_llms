import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  EyeOff,
  Filter,
  GitCompare,
  Layers,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  Sliders,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  EFFORT_LABELS,
  USE_CASES,
  WEIGHT_PRESETS,
} from '../shared/catalog.js';
import {
  buildPerBenchmarkRankings,
  calculateOverallRanking,
  evaluateBenchmarkFrontierCoverage,
  resolveScoreProvider,
} from '../shared/ranking.js';
import {
  AdapterSourceDefinition,
  BenchmarkDefinition,
  BenchmarkRankingTable,
  BenchmarkScoreRecord,
  EffortLevel,
  SourceStatusRecord,
  SyncRunLog,
  UseCaseDefinition,
  WeightPreset,
} from '../shared/types.js';

interface DiscoveredModelSummary {
  canonicalId: string;
  displayName: string;
  provider: string;
  efforts: EffortLevel[];
  benchmarksCount: number;
}

interface ApiStateResponse {
  useCases: UseCaseDefinition[];
  benchmarks: BenchmarkDefinition[];
  adapterSources: AdapterSourceDefinition[];
  weightPresets: WeightPreset[];
  effortLabels: Record<EffortLevel, string>;
  scores: BenchmarkScoreRecord[];
  sources: SourceStatusRecord[];
  syncRuns: SyncRunLog[];
  discoveredProviders: string[];
  discoveredModels: DiscoveredModelSummary[];
  scheduler: {
    intervalMs: number;
    nextRunAt: string | null;
    isSyncing: boolean;
  };
}

type ActiveTab =
  | 'overall'
  | 'compare'
  | 'use-cases'
  | 'substitutes'
  | 'sources';

type TableModelScope = 'all' | 'compared';

const MAX_MODELS_PER_PROVIDER = 4;

const FEATURED_FRONTIER_PROVIDERS: string[] = [
  'Anthropic',
  'OpenAI',
  'Google',
  'Meta',
  'DeepSeek',
  'Alibaba / Qwen',
  'Moonshot AI',
  'Z.AI (Zhipu)',
  'xAI',
  'Mistral AI',
  'MiniMax',
  'Xiaomi',
  'NVIDIA',
  'Amazon',
  'Microsoft / GitHub',
  'Cohere',
];

const SAMPLE_MANUAL_JSON = JSON.stringify(
  [
    {
      benchmarkId: 'llm-accountants-lawyers-br',
      model: 'Claude Fable 5.2 (Max)',
      provider: 'Anthropic',
      effort: 'max',
      score: 91.4,
      sourceUrl: 'https://www.vals.ai/benchmarks/tax_eval_v2',
      notes:
        'Caderno Contábil/Tributário BR (SPED ECD/ECF, Simples Nacional LC 123/06, Reforma Tributária EC 132/2023 e LC 214/2025 IBS/CBS — zero alucinação de norma revogada)',
    },
    {
      benchmarkId: 'llm-accountants-lawyers-br',
      model: 'Gemini 4 Carbon (High)',
      provider: 'Google',
      effort: 'high',
      score: 89.8,
      sourceUrl: 'https://www.vals.ai/benchmarks/tax_eval_v2',
      notes:
        'Caderno Contábil/Tributário BR (SPED, Simples Nacional e Reforma Tributária IBS/CBS)',
    },
    {
      benchmarkId: 'bluefin',
      model: 'Claude Opus 5.5 (Max)',
      provider: 'Anthropic',
      effort: 'max',
      score: 84.5,
      notes:
        'Avaliação manual determinística em modelagem Excel 3-Statement + DCF',
    },
  ],
  null,
  2
);

const SAMPLE_MANUAL_CSV = `benchmarkId,model,provider,effort,score,sourceUrl,notes
finsheet-bench,Claude Fable 5.2 (Max),Anthropic,max,88.2,https://www.vals.ai/benchmarks/corp_fin_v2,Auditoria determinística DRE/Balanço/DFC
finsheet-bench,GPT-6.2 Astra (Max),OpenAI,max,86.7,https://www.vals.ai/benchmarks/corp_fin_v2,Auditoria determinística DRE/Balanço/DFC
ui-cube,Claude Opus 5.5 (Max),Anthropic,max,79.4,https://github.com/UiPath/uipath_enterprise_benchmark,Execução local DeterministicBenchmark UiPath`;

interface BenchmarkTableCardProps {
  table: BenchmarkRankingTable;
  comparedModelIds: string[];
  onToggleCompare: (canonicalId: string) => void;
  defaultRowLimit?: number;
}

function BenchmarkTableCard({
  table,
  comparedModelIds,
  onToggleCompare,
  defaultRowLimit = 20,
}: BenchmarkTableCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded
    ? table.rows
    : table.rows.slice(0, defaultRowLimit);
  const hasMore = table.rows.length > defaultRowLimit;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Benchmark Card Header */}
      <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm sm:text-base font-bold text-white">
              {table.benchmarkName}
            </h4>
            {table.isSubstitute ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Substituto
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Primário
              </span>
            )}
            {table.isBrazilianSpecific && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-200 border border-amber-400/40">
                BR / EUA
              </span>
            )}
            {table.useCaseLabels.map((label) => (
              <span
                key={label}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
              >
                {label}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {table.whatItTests}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
            {table.rows.length} modelo{table.rows.length === 1 ? '' : 's'} •
            Melhor → Pior
          </span>
          <a
            href={table.officialUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition"
          >
            Link Oficial
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Individual Benchmark Ranked Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3 w-14 text-center">Posição (#)</th>
              <th className="py-2.5 px-3 min-w-[230px]">Modelo</th>
              <th className="py-2.5 px-3 min-w-[140px]">Provedor</th>
              <th className="py-2.5 px-3 min-w-[140px]">Esforço</th>
              <th className="py-2.5 px-3 text-right min-w-[125px]">
                Pontuação Real
              </th>
              <th className="py-2.5 px-3 text-center min-w-[145px]">
                Nota Normalizada (0–100)
              </th>
              <th className="py-2.5 px-3 text-center min-w-[115px]">Origem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {visibleRows.map((row) => {
              const isCompared = comparedModelIds.includes(
                row.modelCanonicalId
              );
              return (
                <tr
                  key={`${table.benchmarkId}-${row.modelCanonicalId}`}
                  className={`hover:bg-slate-800/40 transition ${
                    isCompared ? 'bg-indigo-950/25' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-mono font-bold">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${
                        row.rank === 1
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                          : row.rank === 2
                            ? 'bg-slate-400/20 text-slate-200 border border-slate-500/40'
                            : row.rank === 3
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                              : 'text-slate-400'
                      }`}
                    >
                      {row.rank}
                    </span>
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">
                        {row.displayName}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleCompare(row.modelCanonicalId)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer shrink-0 ${
                          isCompared
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        {isCompared ? 'Selecionado' : '+ Comparar'}
                      </button>
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] font-medium">
                      {row.provider}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                    {row.effort === 'default'
                      ? 'Padrão do benchmark'
                      : EFFORT_LABELS[row.effort] ?? row.effort}
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-100">
                    {row.displayScore}
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono font-bold text-emerald-400 w-10 text-right">
                        {row.normalizedScore.toFixed(1)}
                      </span>
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, row.normalizedScore))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                        row.originType === 'manual'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                      }`}
                      title="Abrir fonte do registro"
                    >
                      {row.originType === 'manual' ? 'Manual' : 'Ao vivo'}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer"
          >
            {expanded
              ? `Recolher para Top ${defaultRowLimit}`
              : `Ver todos os ${table.rows.length} modelos neste benchmark (+${table.rows.length - defaultRowLimit})`}
          </button>
        </div>
      )}
    </div>
  );
}

export function App() {
  const [state, setState] = useState<ApiStateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingNow, setSyncingNow] = useState<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overall');

  // Filter & Ranking Controls
  const [selectedPresetId, setSelectedPresetId] = useState<string>('balanced');
  const [weights, setWeights] = useState<Record<string, number>>(
    WEIGHT_PRESETS[0].weights
  );
  const [includeSubstitutes, setIncludeSubstitutes] = useState<boolean>(true);
  const [globalEffort, setGlobalEffort] = useState<EffortLevel | 'best'>(
    'best'
  );
  const [modelEffortOverrides, setModelEffortOverrides] = useState<
    Record<string, EffortLevel>
  >({});
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showAllProviders, setShowAllProviders] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [comparedModelIds, setComparedModelIds] = useState<string[]>([]);
  const [showWeightsPanel, setShowWeightsPanel] = useState<boolean>(false);
  const [homeTableScope, setHomeTableScope] = useState<TableModelScope>('all');
  const [compareTableScope, setCompareTableScope] =
    useState<TableModelScope>('compared');
  const [selectedUseCaseFilter, setSelectedUseCaseFilter] =
    useState<string>('all');

  // Manual Import state
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importContent, setImportContent] =
    useState<string>(SAMPLE_MANUAL_JSON);
  const [importStatusMsg, setImportStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [countdownSec, setCountdownSec] = useState<number>(300);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data: ApiStateResponse = await res.json();
        setState(data);
        setSyncingNow(data.scheduler.isSyncing);
      }
    } catch (err) {
      console.error('Erro ao buscar estado da API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchState();

    const ev = new EventSource('/api/events');
    ev.onopen = () => setSseConnected(true);
    ev.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'sync_completed') {
          void fetchState();
        }
      } catch {
        // ignore
      }
    };
    ev.onerror = () => setSseConnected(false);

    const poll = setInterval(() => {
      void fetchState();
    }, 30000);

    return () => {
      ev.close();
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (state?.scheduler?.nextRunAt) {
        const diff = Math.max(
          0,
          Math.floor(
            (new Date(state.scheduler.nextRunAt).getTime() - Date.now()) / 1000
          )
        );
        setCountdownSec(diff);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [state?.scheduler?.nextRunAt]);

  const handleTriggerSync = async () => {
    setSyncingNow(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        await fetchState();
      }
    } finally {
      setSyncingNow(false);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = WEIGHT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setWeights({ ...preset.weights });
    }
  };

  const handleWeightSlider = (useCaseId: string, val: number) => {
    setSelectedPresetId('custom');
    setWeights((prev) => ({ ...prev, [useCaseId]: val }));
  };

  const toggleProvider = (provider: string) => {
    setSelectedProviders((prev) =>
      prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
    );
  };

  const toggleModelCompare = (canonicalId: string) => {
    setComparedModelIds((prev) =>
      prev.includes(canonicalId)
        ? prev.filter((id) => id !== canonicalId)
        : [...prev, canonicalId]
    );
  };

  // =========================================================================
  // 1. CENTRAL FRONTIER BENCHMARK QUALIFICATION (APPLIED TO ENTIRE APP)
  // =========================================================================
  const frontierDiagnostics = useMemo(() => {
    if (!state) return [];
    return evaluateBenchmarkFrontierCoverage(state.scores);
  }, [state]);

  const qualifiedBenchmarkIds = useMemo(() => {
    return new Set(
      frontierDiagnostics.filter((d) => d.qualified).map((d) => d.benchmarkId)
    );
  }, [frontierDiagnostics]);

  const hiddenFrontierBenchmarks = useMemo(() => {
    return frontierDiagnostics.filter((d) => !d.qualified);
  }, [frontierDiagnostics]);

  // =========================================================================
  // 2. ACTIVE DISCOVERED PROVIDERS (FROM QUALIFIED FRONTIER BENCHMARKS)
  // =========================================================================
  const { featuredActiveProviders, otherActiveProviders, modelProviderMap } =
    useMemo(() => {
      const counts = new Map<string, Set<string>>();
      const provMap = new Map<string, string>();
      if (state) {
        for (const s of state.scores) {
          if (s.modelCanonicalId === 'human') continue;
          if (!qualifiedBenchmarkIds.has(s.benchmarkId)) continue;
          const provider = resolveScoreProvider(s);
          provMap.set(s.modelCanonicalId, provider);
          if (!counts.has(provider)) counts.set(provider, new Set());
          counts.get(provider)!.add(s.modelCanonicalId);
        }
      }
      const featuredSet = new Set(FEATURED_FRONTIER_PROVIDERS);
      const featured = FEATURED_FRONTIER_PROVIDERS.filter(
        (p) => (counts.get(p)?.size ?? 0) > 0
      );
      const others = Array.from(counts.entries())
        .filter(([p, set]) => !featuredSet.has(p) && set.size > 0)
        .sort((a, b) => {
          if (b[1].size !== a[1].size) return b[1].size - a[1].size;
          return a[0].localeCompare(b[0]);
        })
        .map(([p]) => p);

      return {
        featuredActiveProviders: featured,
        otherActiveProviders: others,
        modelProviderMap: provMap,
      };
    }, [state, qualifiedBenchmarkIds]);

  const totalActiveProvidersCount =
    featuredActiveProviders.length + otherActiveProviders.length;

  // =========================================================================
  // 3. COMPOSITE OVERALL RANKING (TOP 4 PER PROVIDER + STRICT PROVIDER FILTER)
  // =========================================================================
  const rankedModels = useMemo(() => {
    if (!state) return [];
    const top4Ranked = calculateOverallRanking(state.scores, {
      weights,
      includeSubstitutes,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      qualifiedBenchmarkIds,
      maxModelsPerProvider: MAX_MODELS_PER_PROVIDER,
    });

    if (!searchQuery.trim()) return top4Ranked;
    const q = searchQuery.toLowerCase().trim();
    return top4Ranked.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.modelCanonicalId.toLowerCase().includes(q)
    );
  }, [
    state,
    weights,
    includeSubstitutes,
    globalEffort,
    modelEffortOverrides,
    selectedProviders,
    qualifiedBenchmarkIds,
    searchQuery,
  ]);

  // Synchronously filter comparedModelIds against selectedProviders to guarantee ZERO leakage
  const validComparedModelIds = useMemo(() => {
    if (selectedProviders.length === 0) return comparedModelIds;
    const allowedSet = new Set(selectedProviders);
    return comparedModelIds.filter((id) => {
      const prov = modelProviderMap.get(id);
      return prov != null && allowedSet.has(prov);
    });
  }, [comparedModelIds, selectedProviders, modelProviderMap]);

  // Automatically prune comparedModelIds state whenever selectedProviders changes
  useEffect(() => {
    if (selectedProviders.length === 0) return;
    const allowedSet = new Set(selectedProviders);
    setComparedModelIds((prev) => {
      const filtered = prev.filter((id) => {
        const prov = modelProviderMap.get(id);
        return prov != null && allowedSet.has(prov);
      });
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [selectedProviders, modelProviderMap]);

  // Pre-select top 5 frontier models with highest coverage on first load only
  const [hasInitializedCompare, setHasInitializedCompare] = useState(false);
  useEffect(() => {
    if (
      !hasInitializedCompare &&
      comparedModelIds.length === 0 &&
      rankedModels.length > 0
    ) {
      const highCoverage = rankedModels
        .filter((m) => m.useCasesCovered >= 4)
        .slice(0, 5);
      const initial =
        highCoverage.length >= 3 ? highCoverage : rankedModels.slice(0, 5);
      setComparedModelIds(initial.map((m) => m.modelCanonicalId));
      setHasInitializedCompare(true);
    }
  }, [rankedModels, comparedModelIds.length, hasInitializedCompare]);

  // Reset scope to 'all' if user clears all marked models while in 'compared' mode
  useEffect(() => {
    if (validComparedModelIds.length === 0 && homeTableScope === 'compared') {
      setHomeTableScope('all');
    }
  }, [validComparedModelIds.length, homeTableScope]);

  // Strictly filtered compared entries (respecting selectedProviders, Top 4/provider, frontier benchmarks)
  const comparedEntries = useMemo(() => {
    if (!state || validComparedModelIds.length === 0) return [];
    const ranked = calculateOverallRanking(state.scores, {
      weights,
      includeSubstitutes,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      selectedModelIds: validComparedModelIds,
      qualifiedBenchmarkIds,
      maxModelsPerProvider: MAX_MODELS_PER_PROVIDER,
    });
    const map = new Map(ranked.map((m) => [m.modelCanonicalId, m]));
    return validComparedModelIds
      .map((id) => map.get(id))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [
    state,
    weights,
    includeSubstitutes,
    globalEffort,
    modelEffortOverrides,
    selectedProviders,
    validComparedModelIds,
    qualifiedBenchmarkIds,
  ]);

  // =========================================================================
  // 4. PER-BENCHMARK RANKING TABLES (SEPARATE TABLE PER BENCHMARK, BEST->WORST)
  // =========================================================================
  const homeBenchmarkTables = useMemo(() => {
    if (!state) return [];
    const useMarkedOnly =
      homeTableScope === 'compared' && validComparedModelIds.length > 0;
    return buildPerBenchmarkRankings(state.scores, {
      includeSubstitutes,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      selectedModelIds: useMarkedOnly ? validComparedModelIds : undefined,
      qualifiedBenchmarkIds,
      maxModelsPerProvider: MAX_MODELS_PER_PROVIDER,
      searchQuery,
    });
  }, [
    state,
    homeTableScope,
    validComparedModelIds,
    includeSubstitutes,
    globalEffort,
    modelEffortOverrides,
    selectedProviders,
    qualifiedBenchmarkIds,
    searchQuery,
  ]);

  const compareBenchmarkTables = useMemo(() => {
    if (!state) return [];
    const useMarkedOnly =
      compareTableScope === 'compared' && validComparedModelIds.length > 0;
    if (compareTableScope === 'compared' && validComparedModelIds.length === 0) {
      return [];
    }
    return buildPerBenchmarkRankings(state.scores, {
      includeSubstitutes,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      selectedModelIds: useMarkedOnly ? validComparedModelIds : undefined,
      qualifiedBenchmarkIds,
      maxModelsPerProvider: MAX_MODELS_PER_PROVIDER,
      searchQuery,
    });
  }, [
    state,
    compareTableScope,
    validComparedModelIds,
    includeSubstitutes,
    globalEffort,
    modelEffortOverrides,
    selectedProviders,
    qualifiedBenchmarkIds,
    searchQuery,
  ]);

  // Strictly filtered lookup map (benchmarkId -> BenchmarkRankingTable) for Tabs 3 & 4
  const allActiveBenchmarkTablesMap = useMemo(() => {
    if (!state) return new Map<string, BenchmarkRankingTable>();
    const tables = buildPerBenchmarkRankings(state.scores, {
      includeSubstitutes: true,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      qualifiedBenchmarkIds,
      maxModelsPerProvider: MAX_MODELS_PER_PROVIDER,
    });
    return new Map(tables.map((t) => [t.benchmarkId, t]));
  }, [
    state,
    globalEffort,
    modelEffortOverrides,
    selectedProviders,
    qualifiedBenchmarkIds,
  ]);

  const handleManualImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportStatusMsg(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: importFormat,
          content: importContent,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setImportStatusMsg({
          type: 'success',
          text: `Sucesso! ${data.importedCount} pontuações determinísticas importadas e salvas no SQLite.`,
        });
        await fetchState();
      } else {
        setImportStatusMsg({
          type: 'error',
          text: data.error || 'Falha ao importar dados.',
        });
      }
    } catch (err: any) {
      setImportStatusMsg({
        type: 'error',
        text: err?.message || 'Erro de comunicação com o servidor.',
      });
    }
  };

  const renderGroupedBenchmarkTables = (
    tables: BenchmarkRankingTable[],
    emptyMessage: string
  ) => {
    const filteredByUc =
      selectedUseCaseFilter === 'all'
        ? tables
        : tables.filter((t) => t.useCaseIds.includes(selectedUseCaseFilter));

    if (filteredByUc.length === 0) {
      return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
          {emptyMessage}
        </div>
      );
    }

    // Group tables by their primary Use Case (1..7) without duplicating a benchmark across sections
    const groups = USE_CASES.map((uc) => {
      const ucTables = filteredByUc.filter((t) =>
        selectedUseCaseFilter === 'all'
          ? t.useCaseIds[0] === uc.id
          : uc.id === selectedUseCaseFilter && t.useCaseIds.includes(uc.id)
      );
      return { uc, tables: ucTables };
    }).filter((g) => g.tables.length > 0);

    return (
      <div className="space-y-8">
        {groups.map(({ uc, tables: ucTables }) => (
          <div key={uc.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  Caso de Uso #{uc.number}
                </span>
                <h3 className="text-base font-bold text-white">{uc.title}</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {ucTables.length} benchmark{ucTables.length === 1 ? '' : 's'}{' '}
                ativo{ucTables.length === 1 ? '' : 's'} de fronteira
              </span>
            </div>

            <div className="space-y-5">
              {ucTables.map((table) => (
                <BenchmarkTableCard
                  key={table.benchmarkId}
                  table={table}
                  comparedModelIds={validComparedModelIds}
                  onToggleCompare={toggleModelCompare}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
        <h1 className="text-xl font-bold">
          Carregando Comparativo LLMs (Coleta 100% Determinística)...
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Sincronizando benchmarks oficiais, modelos, provedores e variantes de
          esforço.
        </p>
      </div>
    );
  }

  const lastRun = state?.syncRuns?.[0] ?? null;
  const liveCount =
    state?.sources.filter((s) => s.status === 'live').length ?? 0;
  const partialCount =
    state?.sources.filter((s) => s.status === 'partial').length ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* TOP HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Comparativo LLMs
                </h1>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  100% Determinístico • Sem IA
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Top 4 / Provedor • Fronteira 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Monitoramento em tempo real (ciclo de 5 min) • 7 Casos de Uso
                Práticos • Uma Tabela por Benchmark (Melhor → Pior)
              </p>
            </div>
          </div>

          {/* LIVE SCHEDULER STATUS & SYNC BUTTON */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-300 font-medium">
                Agendador 5 min:
              </span>
              <span className="text-indigo-300 font-mono">
                {Math.floor(countdownSec / 60)}m{' '}
                {String(countdownSec % 60).padStart(2, '0')}s
              </span>
              {lastRun && (
                <span className="text-slate-500 hidden md:inline">
                  | Última:{' '}
                  {new Date(lastRun.completedAt).toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>

            <button
              onClick={handleTriggerSync}
              disabled={syncingNow}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white shadow-sm transition cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncingNow ? 'animate-spin' : ''}`}
              />
              {syncingNow ? 'Sincronizando...' : 'Sincronizar Agora'}
            </button>
          </div>
        </div>

        {/* KPI SUMMARY BAR */}
        <div className="bg-slate-950/60 border-t border-slate-800/80">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-slate-400">Modelos (Top 4/prov):</span>
              <strong className="text-white font-mono">
                {rankedModels.length}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-400">Provedores Ativos:</span>
              <strong className="text-white font-mono">
                {selectedProviders.length > 0
                  ? `${selectedProviders.length} / ${totalActiveProvidersCount}`
                  : totalActiveProvidersCount}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-400">Benchs Fronteira:</span>
              <strong className="text-emerald-300 font-mono">
                {qualifiedBenchmarkIds.size} ativos
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400">Benchs Legados:</span>
              <strong className="text-slate-300 font-mono">
                {hiddenFrontierBenchmarks.length} ocultados
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-400">Fontes Ao Vivo:</span>
              <strong className="text-emerald-300 font-mono">
                {liveCount} live / {partialCount} parcial
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400">Ciclo Determinístico:</span>
              <strong className="text-slate-200 font-mono">
                300.000 ms (5m)
              </strong>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto pt-2">
          <button
            onClick={() => setActiveTab('overall')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'overall'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            1. Classificação Geral (0–100)
          </button>

          <button
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'compare'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            2. Comparar ({validComparedModelIds.length})
          </button>

          <button
            onClick={() => setActiveTab('use-cases')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'use-cases'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            3. Os 7 Casos de Uso & Destaque Tributário BR
          </button>

          <button
            onClick={() => setActiveTab('substitutes')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'substitutes'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            4. Benchmarks Substitutos Qualificados
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'sources'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            5. Fontes Oficiais, Agendador & Importação Manual
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* GLOBAL CONTROLS BAR (Shown on Tabs 1, 2, 3, and 4 so Provider Filter is always visible & strict) */}
        {activeTab !== 'sources' && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow-lg">
            {(activeTab === 'overall' || activeTab === 'compare') && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search Models */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Buscar Modelo ou Provedor
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ex: Claude Fable 5.2, GPT-6, Gemini 4, DeepSeek..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Effort Level Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nível de Esforço Global (effort / reasoning_effort)
                  </label>
                  <select
                    value={globalEffort}
                    onChange={(e) =>
                      setGlobalEffort(e.target.value as EffortLevel | 'best')
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="best">
                      Melhor esforço publicado no benchmark (Recomendado)
                    </option>
                    {(Object.keys(EFFORT_LABELS) as EffortLevel[]).map(
                      (eff) => (
                        <option key={eff} value={eff}>
                          {EFFORT_LABELS[eff]} ({eff})
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Weight Preset Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Preset de Ponderação (7 Casos de Uso)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedPresetId}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      {WEIGHT_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      {selectedPresetId === 'custom' && (
                        <option value="custom">Personalizado (Sliders)</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowWeightsPanel((v) => !v)}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      Pesos
                    </button>
                  </div>
                </div>

                {/* Substitute Benchmarks Toggle */}
                <div className="flex flex-col justify-between">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Benchmarks Substitutos Qualificados (Artificial Analysis)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIncludeSubstitutes((v) => !v)}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between transition cursor-pointer ${
                      includeSubstitutes
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {includeSubstitutes
                        ? 'Substitutos Ativos (Com Badge)'
                        : 'Apenas Benchmarks Primários'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                        includeSubstitutes
                          ? 'bg-amber-500/30 text-amber-100'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {includeSubstitutes ? 'LIGADO' : 'DESLIGADO'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* STRICT PROVIDER FILTER BAR (ALL ACTIVE DISCOVERED PROVIDERS) */}
            <div
              className={`${
                activeTab === 'overall' || activeTab === 'compare'
                  ? 'pt-3 border-t border-slate-800/80'
                  : ''
              } space-y-2.5`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Filtro Estrito de Provedores (Top {MAX_MODELS_PER_PROVIDER}{' '}
                    modelos/provedor):
                  </span>
                  {selectedProviders.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/50">
                      {selectedProviders.length} selecionado
                      {selectedProviders.length === 1 ? '' : 's'} — zero
                      vazamento
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Exibindo todos os {totalActiveProvidersCount} provedores
                      ativos
                    </span>
                  )}
                </div>

                {selectedProviders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedProviders([])}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/40 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    Limpar filtro de provedores
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedProviders([])}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                    selectedProviders.length === 0
                      ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/40'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {selectedProviders.length === 0 && (
                    <Check className="w-3 h-3" />
                  )}
                  Todos ({totalActiveProvidersCount})
                </button>

                {featuredActiveProviders.map((prov) => {
                  const active = selectedProviders.includes(prov);
                  return (
                    <button
                      type="button"
                      key={prov}
                      onClick={() => toggleProvider(prov)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/40 font-bold'
                          : selectedProviders.length > 0
                            ? 'bg-slate-950/80 text-slate-400 border-slate-800 opacity-75 hover:opacity-100 hover:border-slate-600'
                            : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      {prov}
                    </button>
                  );
                })}

                {otherActiveProviders
                  .filter(
                    (prov) =>
                      showAllProviders || selectedProviders.includes(prov)
                  )
                  .map((prov) => {
                    const active = selectedProviders.includes(prov);
                    return (
                      <button
                        type="button"
                        key={prov}
                        onClick={() => toggleProvider(prov)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                          active
                            ? 'bg-cyan-600 text-white border-cyan-400 ring-2 ring-cyan-400/40 font-bold'
                            : selectedProviders.length > 0
                              ? 'bg-slate-950/80 text-slate-400 border-slate-800 opacity-75 hover:opacity-100 hover:border-slate-600'
                              : 'bg-slate-900 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                        {prov}
                      </button>
                    );
                  })}

                {otherActiveProviders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllProviders((v) => !v)}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-950 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/15 transition cursor-pointer"
                  >
                    {showAllProviders
                      ? 'Recolher outros provedores'
                      : `+${otherActiveProviders.length} outros provedores ativos`}
                  </button>
                )}
              </div>
            </div>

            {/* CUSTOM WEIGHT SLIDERS PANEL */}
            {showWeightsPanel &&
              (activeTab === 'overall' || activeTab === 'compare') && (
                <div className="pt-3 border-t border-slate-800 bg-slate-950/70 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      Ponderação Customizável por Caso de Uso (0 a 100)
                    </h3>
                    <button
                      type="button"
                      onClick={() => handlePresetChange('balanced')}
                      className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Restaurar Equilibrado (100 em todos)
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {USE_CASES.map((uc) => (
                      <div
                        key={uc.id}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-3"
                      >
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-medium text-slate-200">
                            {uc.shortTitle}
                          </span>
                          <span className="font-mono font-bold text-indigo-400">
                            Peso: {weights[uc.id] ?? 100}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={weights[uc.id] ?? 100}
                          onChange={(e) =>
                            handleWeightSlider(uc.id, Number(e.target.value))
                          }
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </section>
        )}

        {/* ===================================================================== */}
        {/* TAB 1: OVERALL RANKING + SEPARATE TABLE PER ACTIVE BENCHMARK          */}
        {/* ===================================================================== */}
        {activeTab === 'overall' && (
          <section className="space-y-6">
            {/* BRAZILIAN ACCOUNTING & TAX HIGHLIGHT BANNER */}
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Scale className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2 flex-wrap">
                    Ponto de Atenção: Contabilidade e Direito Tributário
                    Brasileiro (Casos 1 e 2)
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                      SPED • Simples Nacional • Reforma Tributária BR
                    </span>
                  </h3>
                  <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">
                    Benchmarks jurídicos norte-americanos como o{' '}
                    <strong>Vals Legal Research Bench</strong> não cobrem
                    nuances de{' '}
                    <strong>SPED (ECD/ECF/EFD-Contribuições)</strong>,{' '}
                    <strong>Simples Nacional (LC 123/2006)</strong> ou a{' '}
                    <strong>
                      Reforma Tributária Brasileira (EC 132/2023 e LC 214/2025 —
                      IBS/CBS)
                    </strong>
                    . Por isso, o Caso 1 e o Caso 2 integram o{' '}
                    <strong>
                      LLM Benchmark for Accountants and Lawyers (BR/EUA)
                    </strong>{' '}
                    com trava rígida contra alucinação de norma revogada.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('sources')}
                className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 cursor-pointer"
              >
                Importar Caderno Contábil BR (JSON/CSV)
              </button>
            </div>

            {/* COMPOSITE OVERALL RANKING SUMMARY TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-400" />
                    Resumo da Classificação Geral Composta (0–100)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Exibindo {Math.min(rankedModels.length, 80)} de{' '}
                    {rankedModels.length} modelos (máx. {MAX_MODELS_PER_PROVIDER}{' '}
                    melhores por provedor • apenas{' '}
                    {qualifiedBenchmarkIds.size} benchmarks qualificados de
                    fronteira).
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('compare')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold hover:bg-indigo-600/30 cursor-pointer"
                  >
                    Ver Comparativo ({validComparedModelIds.length} marcados)
                  </button>
                </div>
              </div>

              {rankedModels.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum modelo encontrado para o filtro atual de provedores /
                  busca.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3 w-12 text-center">#</th>
                        <th className="py-3 px-3 min-w-[210px]">
                          Modelo & Provedor
                        </th>
                        <th className="py-3 px-3 min-w-[165px]">
                          Nível de Esforço
                        </th>
                        <th className="py-3 px-3 text-center min-w-[110px]">
                          Nota Geral (0–100)
                        </th>
                        <th className="py-3 px-3 text-center min-w-[135px]">
                          Cobertura (Casos / Benchs)
                        </th>
                        {USE_CASES.map((uc) => (
                          <th
                            key={uc.id}
                            className="py-3 px-2.5 text-center min-w-[110px]"
                            title={uc.title}
                          >
                            <div className="font-bold text-slate-300">
                              Caso {uc.number}
                            </div>
                            <div className="text-[10px] font-normal text-slate-500 truncate max-w-[105px]">
                              {uc.shortTitle.replace(/^\d+\.\s*/, '')}
                            </div>
                          </th>
                        ))}
                        <th className="py-3 px-3 text-right min-w-[125px]">
                          Velocidade / Custo
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {rankedModels.slice(0, 80).map((entry, idx) => {
                        const isCompared = validComparedModelIds.includes(
                          entry.modelCanonicalId
                        );
                        const hasMultipleEfforts =
                          entry.availableEfforts.length > 1;
                        const currentOverride =
                          modelEffortOverrides[entry.modelCanonicalId];

                        return (
                          <tr
                            key={entry.modelCanonicalId}
                            className={`hover:bg-slate-800/40 transition ${
                              isCompared ? 'bg-indigo-950/25' : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-bold text-slate-100 text-sm">
                                    {entry.displayName}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                      {entry.provider}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleModelCompare(entry.modelCanonicalId)
                                  }
                                  className={`px-2 py-1 rounded text-[11px] font-semibold border transition cursor-pointer ${
                                    isCompared
                                      ? 'bg-indigo-600 border-indigo-500 text-white'
                                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-indigo-400'
                                  }`}
                                >
                                  {isCompared ? 'Selecionado' : '+ Comparar'}
                                </button>
                              </div>
                            </td>

                            {/* Effort Selector Per Model */}
                            <td className="py-3 px-3">
                              {hasMultipleEfforts ? (
                                <select
                                  value={currentOverride ?? 'best'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setModelEffortOverrides((prev) => {
                                      const next = { ...prev };
                                      if (val === 'best') {
                                        delete next[entry.modelCanonicalId];
                                      } else {
                                        next[entry.modelCanonicalId] =
                                          val as EffortLevel;
                                      }
                                      return next;
                                    });
                                  }}
                                  className="w-full bg-slate-950 border border-indigo-500/40 rounded px-2 py-1 text-[11px] text-indigo-200 font-medium"
                                >
                                  <option value="best">
                                    Melhor ({entry.availableEfforts.join(', ')})
                                  </option>
                                  {entry.availableEfforts.map((eff) => (
                                    <option key={eff} value={eff}>
                                      {EFFORT_LABELS[eff]} ({eff})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[11px]">
                                  {entry.selectedEffort === 'default'
                                    ? 'Padrão do benchmark'
                                    : EFFORT_LABELS[entry.selectedEffort]}
                                </span>
                              )}
                            </td>

                            {/* Overall Score */}
                            <td className="py-3 px-3 text-center">
                              <div className="inline-flex flex-col items-center">
                                <span className="text-base font-extrabold font-mono text-emerald-400">
                                  {entry.overallScore.toFixed(1)}
                                </span>
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                                  <div
                                    className="h-full bg-emerald-500"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        entry.overallScore
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Coverage */}
                            <td className="py-3 px-3 text-center">
                              <div className="font-mono font-semibold text-slate-200">
                                {entry.useCasesCovered}/{entry.totalUseCases}{' '}
                                casos
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {entry.primaryBenchmarksCovered}/
                                {entry.totalPrimaryBenchmarks} primários
                                {entry.substituteBenchmarksUsed > 0 && (
                                  <span className="ml-1 text-amber-300">
                                    (+{entry.substituteBenchmarksUsed} sub)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Per Use Case Scores */}
                            {USE_CASES.map((uc) => {
                              const ucData = entry.useCaseScores[uc.id];
                              if (!ucData || ucData.score === null) {
                                return (
                                  <td
                                    key={uc.id}
                                    className="py-3 px-2.5 text-center text-slate-600 font-mono"
                                  >
                                    —
                                  </td>
                                );
                              }
                              const isOnlySub =
                                ucData.primaryAvailableCount === 0 &&
                                ucData.usedSubstituteCount > 0;
                              const hasSub = ucData.usedSubstituteCount > 0;

                              return (
                                <td
                                  key={uc.id}
                                  className="py-3 px-2.5 text-center"
                                >
                                  <div className="font-mono font-bold text-slate-100">
                                    {ucData.score.toFixed(1)}
                                  </div>
                                  <div className="flex items-center justify-center gap-1 mt-0.5">
                                    {hasSub ? (
                                      <span
                                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                          isOnlySub
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : 'bg-slate-800 text-amber-200/90'
                                        }`}
                                        title={ucData.cells
                                          .map((c) =>
                                            c.isSubstitute
                                              ? `${c.benchmarkName} via Substituto: ${c.substitutedBenchmarkName} (${c.displayScore})`
                                              : `${c.benchmarkName}: ${c.displayScore}`
                                          )
                                          .join('\n')}
                                      >
                                        {isOnlySub ? 'Substituto' : 'Prim+Sub'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-emerald-400/90">
                                        Primário ({ucData.primaryAvailableCount}
                                        )
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Speed / Cost Telemetry */}
                            <td className="py-3 px-3 text-right font-mono text-[11px]">
                              {entry.telemetry?.outputSpeedTokensPerSec ? (
                                <div className="text-cyan-300">
                                  {entry.telemetry.outputSpeedTokensPerSec}{' '}
                                  tok/s
                                </div>
                              ) : (
                                <div className="text-slate-600">— tok/s</div>
                              )}
                              {entry.telemetry?.priceInput1M != null &&
                              entry.telemetry?.priceOutput1M != null ? (
                                <div className="text-slate-400">
                                  ${entry.telemetry.priceInput1M}/
                                  {entry.telemetry.priceOutput1M} /1M
                                </div>
                              ) : (
                                <div className="text-slate-600">— $/1M</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* INDIVIDUAL PER-BENCHMARK TABLES SECTION ON HOME PAGE */}
            <div className="space-y-4 pt-2">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-400" />
                      Tabelas Individuais por Benchmark Ativo (Ordenadas do
                      Melhor para o Pior)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Cada benchmark de fronteira qualificado aparece em sua
                      própria tabela, respeitando Top {MAX_MODELS_PER_PROVIDER}{' '}
                      por provedor, filtro estrito de provedores e nível de
                      esforço selecionado.
                    </p>
                  </div>

                  {/* Quick Scope Toggle */}
                  <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setHomeTableScope('all')}
                      className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                        homeTableScope === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Todos os modelos dos provedores filtrados (Top{' '}
                      {MAX_MODELS_PER_PROVIDER}/provedor)
                    </button>
                    <button
                      type="button"
                      disabled={validComparedModelIds.length === 0}
                      onClick={() => setHomeTableScope('compared')}
                      className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        homeTableScope === 'compared'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Apenas modelos marcados (+ Comparar:{' '}
                      {validComparedModelIds.length})
                    </button>
                  </div>
                </div>

                {/* Use Case Quick Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setSelectedUseCaseFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      selectedUseCaseFilter === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    Todos os 7 Casos ({homeBenchmarkTables.length} benchmarks)
                  </button>
                  {USE_CASES.map((uc) => {
                    const count = homeBenchmarkTables.filter((t) =>
                      t.useCaseIds.includes(uc.id)
                    ).length;
                    if (count === 0) return null;
                    const active = selectedUseCaseFilter === uc.id;
                    return (
                      <button
                        type="button"
                        key={uc.id}
                        onClick={() => setSelectedUseCaseFilter(uc.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-400 font-semibold'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {uc.shortTitle} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {renderGroupedBenchmarkTables(
                homeBenchmarkTables,
                'Nenhum benchmark ativo possui modelos para os filtros selecionados.'
              )}
            </div>
          </section>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: COMPARE — SEPARATE TABLE PER BENCHMARK (BEST -> WORST)         */}
        {/* ===================================================================== */}
        {activeTab === 'compare' && (
          <section className="space-y-6">
            {/* MODEL PICKER BAR */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-indigo-400" />
                    Comparar Modelos — Uma Tabela Separada por Benchmark (Melhor
                    → Pior)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Selecione os modelos abaixo (Top {MAX_MODELS_PER_PROVIDER}{' '}
                    por provedor, respeitando o filtro estrito de provedores) e
                    ajuste o esforço por modelo.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const highCov = rankedModels
                        .filter((m) => m.useCasesCovered >= 4)
                        .slice(0, 5);
                      const top5 = (
                        highCov.length >= 3
                          ? highCov
                          : rankedModels.slice(0, 5)
                      ).map((m) => m.modelCanonicalId);
                      setComparedModelIds(top5);
                      setCompareTableScope('compared');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 cursor-pointer"
                  >
                    Selecionar Top 5 Fronteira
                  </button>
                  <button
                    type="button"
                    onClick={() => setComparedModelIds([])}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>

              {/* Quick Model Selector Pills (strictly filtered & Top 4/provider) */}
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {rankedModels.slice(0, 48).map((m) => {
                  const selected = validComparedModelIds.includes(
                    m.modelCanonicalId
                  );
                  return (
                    <button
                      type="button"
                      key={m.modelCanonicalId}
                      onClick={() => toggleModelCompare(m.modelCanonicalId)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                        selected
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span>{m.displayName}</span>
                      <span className="text-[10px] opacity-75">
                        ({m.provider} • {m.overallScore.toFixed(1)})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Scope Toggle & Use Case Filter */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setCompareTableScope('compared')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                      compareTableScope === 'compared'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Apenas modelos marcados (+ Comparar:{' '}
                    {validComparedModelIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareTableScope('all')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                      compareTableScope === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos os modelos dos provedores filtrados (Top{' '}
                    {MAX_MODELS_PER_PROVIDER}/provedor)
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedUseCaseFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      selectedUseCaseFilter === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    Todos ({compareBenchmarkTables.length})
                  </button>
                  {USE_CASES.map((uc) => {
                    const count = compareBenchmarkTables.filter((t) =>
                      t.useCaseIds.includes(uc.id)
                    ).length;
                    if (count === 0) return null;
                    return (
                      <button
                        type="button"
                        key={uc.id}
                        onClick={() => setSelectedUseCaseFilter(uc.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                          selectedUseCaseFilter === uc.id
                            ? 'bg-indigo-600 text-white border-indigo-400 font-semibold'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        Caso {uc.number} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SELECTED MODELS EFFORT & TELEMETRY SUMMARY CARDS */}
            {comparedEntries.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {comparedEntries.map((entry) => (
                  <div
                    key={entry.modelCanonicalId}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-white leading-tight">
                          {entry.displayName}
                        </div>
                        <div className="text-[11px] text-indigo-300 font-medium mt-0.5">
                          {entry.provider}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          toggleModelCompare(entry.modelCanonicalId)
                        }
                        className="text-slate-500 hover:text-rose-400 text-xs cursor-pointer"
                        title="Remover da comparação"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 mb-1">
                        Esforço:
                      </label>
                      {entry.availableEfforts.length > 1 ? (
                        <select
                          value={
                            modelEffortOverrides[entry.modelCanonicalId] ??
                            'best'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            setModelEffortOverrides((prev) => {
                              const next = { ...prev };
                              if (val === 'best')
                                delete next[entry.modelCanonicalId];
                              else
                                next[entry.modelCanonicalId] =
                                  val as EffortLevel;
                              return next;
                            });
                          }}
                          className="w-full bg-slate-950 border border-indigo-500/40 rounded px-2 py-1 text-[11px] text-indigo-200"
                        >
                          <option value="best">
                            Melhor ({entry.availableEfforts.join(', ')})
                          </option>
                          {entry.availableEfforts.map((eff) => (
                            <option key={eff} value={eff}>
                              {EFFORT_LABELS[eff]} ({eff})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                          {entry.selectedEffort === 'default'
                            ? 'Padrão do benchmark'
                            : EFFORT_LABELS[entry.selectedEffort]}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Nota Composta:</span>
                      <span className="font-mono font-extrabold text-emerald-400">
                        {entry.overallScore.toFixed(1)} / 100
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Cobertura:</span>
                      <span className="font-mono text-slate-200">
                        {entry.useCasesCovered}/{entry.totalUseCases} casos (
                        {entry.primaryBenchmarksCovered}/
                        {entry.totalPrimaryBenchmarks} prim)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SEPARATE RANKED TABLE PER BENCHMARK */}
            {renderGroupedBenchmarkTables(
              compareBenchmarkTables,
              compareTableScope === 'compared' &&
                validComparedModelIds.length === 0
                ? 'Marque ao menos um modelo acima (ou clique em "Todos os modelos dos provedores filtrados") para visualizar as tabelas individuais por benchmark.'
                : 'Nenhum benchmark ativo possui pontuações para os modelos selecionados com os filtros atuais.'
            )}
          </section>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: OS 7 CASOS DE USO (FRONTIER-QUALIFIED & STRICT PROVIDER FILTER) */}
        {/* ===================================================================== */}
        {activeTab === 'use-cases' && (
          <section className="space-y-6">
            {/* DESTAQUE CONTÁBIL E TRIBUTÁRIO BRASILEIRO */}
            <div className="bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border border-amber-500/40 rounded-xl p-5 space-y-3 shadow-lg">
              <div className="flex items-center gap-2.5 text-amber-300 font-bold text-base">
                <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
                Ponto de Atenção Obrigatório: Contabilidade e Direito Tributário
                Brasileiro (Itens 1 e 2)
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                Benchmarks internacionais como o{' '}
                <strong>Vals Legal Research Bench</strong> e o{' '}
                <strong>LegalBench</strong> avaliam majoritariamente o sistema
                jurídico norte-americano (Common Law e Internal Revenue Code) e{' '}
                <strong className="text-amber-300">
                  NÃO cobrem nuances críticas da legislação contábil e fiscal
                  brasileira
                </strong>
                , tais como:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-3">
                  <div className="font-bold text-xs text-amber-300">
                    1. Obrigações Acessórias & SPED
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Cruzamento de blocos e registros do SPED (ECD, ECF,
                    EFD-ICMS/IPI, EFD-Contribuições, EFD-Reinf e MIT) e regras
                    da Receita Federal do Brasil.
                  </p>
                </div>
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-3">
                  <div className="font-bold text-xs text-amber-300">
                    2. Simples Nacional & Regimes Tributários
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Cálculo de Fator R, anexos da LC 123/2006, sublimites
                    estaduais, substituição tributária (ICMS-ST / MVA) e
                    equiparação hospitalar no Lucro Presumido.
                  </p>
                </div>
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-3">
                  <div className="font-bold text-xs text-amber-300">
                    3. Reforma Tributária BR & Trava Anti-Revogação
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Regras de transição da EC 132/2023 e LC 214/2025 (IBS, CBS e
                    Imposto Seletivo). O{' '}
                    <strong>
                      LLM Benchmark for Accountants and Lawyers
                    </strong>{' '}
                    aplica trava rígida penalizando qualquer citação de
                    instrução normativa ou lei revogada.
                  </p>
                </div>
              </div>
            </div>

            {/* 7 USE CASES CARDS — ONLY FRONTIER-QUALIFIED BENCHMARKS & STRICT FILTER */}
            <div className="space-y-6">
              {USE_CASES.map((uc) => {
                const qualifiedPrimaries = uc.primaryBenchmarkIds
                  .filter((id) => qualifiedBenchmarkIds.has(id))
                  .map((id) => state?.benchmarks.find((b) => b.id === id))
                  .filter((b): b is BenchmarkDefinition => Boolean(b));

                const qualifiedSubstitutes = uc.substituteBenchmarkIds
                  .filter((id) => qualifiedBenchmarkIds.has(id))
                  .map((id) => state?.benchmarks.find((b) => b.id === id))
                  .filter((b): b is BenchmarkDefinition => Boolean(b));

                const displayBenchmarks =
                  qualifiedPrimaries.length > 0
                    ? qualifiedPrimaries
                    : qualifiedSubstitutes;

                return (
                  <div
                    key={uc.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                          Caso de Uso #{uc.number}
                        </span>
                        <h3 className="text-lg font-bold text-white mt-0.5">
                          {uc.title}
                        </h3>
                        <p className="text-xs text-slate-300 mt-1">
                          {uc.practicalContext}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {qualifiedSubstitutes.map((sub) => (
                          <span
                            key={sub.id}
                            className="px-2.5 py-1 rounded-full text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          >
                            Substituto Ativo: {sub.shortName}
                          </span>
                        ))}
                      </div>
                    </div>

                    {uc.brazilianCaveat && (
                      <div className="bg-amber-950/25 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{uc.brazilianCaveat}</span>
                      </div>
                    )}

                    {qualifiedPrimaries.length === 0 && (
                      <div className="bg-slate-950 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200/90">
                        Os benchmarks primários deste caso de uso foram
                        ocultados automaticamente por ausência de modelos atuais
                        de fronteira ou falta de dados públicos. Exibindo abaixo
                        apenas os <strong>substitutos qualificados</strong> com
                        cobertura de fronteira ativa.
                      </div>
                    )}

                    {/* Qualified Benchmarks Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {displayBenchmarks.map((bench) => {
                        const table = allActiveBenchmarkTablesMap.get(bench.id);
                        const rows = table?.rows ?? [];

                        return (
                          <div
                            key={bench.id}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-sm text-white">
                                  {bench.name}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                    bench.isSubstitute
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  {bench.isSubstitute
                                    ? 'Substituto'
                                    : 'Primário'}
                                </span>
                              </div>

                              <p className="text-xs text-slate-300 leading-relaxed">
                                <strong>O que mede:</strong> {bench.whatItTests}
                              </p>
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {bench.practicalExplanation}
                              </p>

                              {bench.jurisdictionNote && (
                                <div className="p-2 rounded bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200">
                                  {bench.jurisdictionNote}
                                </div>
                              )}
                            </div>

                            {/* Strictly Filtered Top Models in this Benchmark */}
                            <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span>
                                  Top Modelos Filtrados ({rows.length}):
                                </span>
                                <a
                                  href={bench.officialUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-400 hover:underline inline-flex items-center gap-1"
                                >
                                  Fonte Oficial
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>

                              {rows.length > 0 ? (
                                <div className="space-y-1">
                                  {rows.slice(0, 6).map((row) => (
                                    <div
                                      key={row.modelCanonicalId}
                                      className="flex items-center justify-between text-xs bg-slate-900/90 px-2.5 py-1 rounded gap-2"
                                    >
                                      <span className="truncate text-slate-200">
                                        {row.rank}. {row.displayName}{' '}
                                        <span className="text-[10px] text-slate-400">
                                          [{row.provider}]
                                        </span>
                                      </span>
                                      <span className="font-mono font-bold text-emerald-400 shrink-0">
                                        {row.displayScore}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                                  Nenhum modelo dos provedores selecionados
                                  possui pontuação neste benchmark.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: QUALIFIED SUBSTITUTE BENCHMARKS (STRICT PROVIDER & TOP 4)      */}
        {/* ===================================================================== */}
        {activeTab === 'substitutes' && (
          <section className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Benchmarks Substitutos Qualificados de Fronteira (Artificial
                Analysis & Equivalentes)
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Exibindo apenas substitutos com cobertura ativa de modelos de
                fronteira 2026 (Top {MAX_MODELS_PER_PROVIDER} modelos/provedor
                e filtro estrito de provedores aplicado). Sempre que acionados
                no ranking composto, recebem o badge explícito{' '}
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                  Substituto
                </span>
                .
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(state?.benchmarks ?? [])
                .filter(
                  (b) => b.isSubstitute && qualifiedBenchmarkIds.has(b.id)
                )
                .map((sub) => {
                  const table = allActiveBenchmarkTablesMap.get(sub.id);
                  const rows = table?.rows ?? [];
                  const primaryNames = (sub.substituteForIds ?? []).map(
                    (pid) =>
                      state?.benchmarks.find((b) => b.id === pid)?.shortName ??
                      pid
                  );

                  return (
                    <div
                      key={sub.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                              Substituto Qualificado
                            </span>
                            <h3 className="font-bold text-sm text-white mt-1.5">
                              {sub.name}
                            </h3>
                          </div>
                          <a
                            href={sub.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1 shrink-0"
                          >
                            Fonte
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        <p className="text-xs text-slate-300">
                          <strong>Equivalência técnica:</strong>{' '}
                          {sub.substituteEquivalenceExplanation}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          <span className="text-[11px] text-slate-400">
                            Atua como fallback para:
                          </span>
                          {primaryNames.map((name) => (
                            <span
                              key={name}
                              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-indigo-300 font-medium"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 space-y-1.5">
                        <div className="text-[11px] text-slate-400 flex justify-between">
                          <span>Modelos Filtrados (Top 4/provedor):</span>
                          <strong className="text-emerald-400 font-mono">
                            {rows.length} modelos
                          </strong>
                        </div>
                        {rows.length > 0 ? (
                          rows.slice(0, 5).map((row) => (
                            <div
                              key={row.modelCanonicalId}
                              className="flex items-center justify-between text-xs bg-slate-950 px-2.5 py-1 rounded gap-2"
                            >
                              <span className="truncate text-slate-200">
                                {row.rank}. {row.displayName}{' '}
                                <span className="text-[10px] text-slate-400">
                                  [{row.provider}]
                                </span>
                              </span>
                              <span className="font-mono font-bold text-amber-300 shrink-0">
                                {row.displayScore}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                            Nenhum modelo dos provedores selecionados neste
                            substituto.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: STATUS DAS FONTES, AGENDADOR (5m), IMPORTAÇÃO & OCULTADOS      */}
        {/* ===================================================================== */}
        {activeTab === 'sources' && (
          <section className="space-y-6">
            {/* MANUAL IMPORT PANEL */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Upload className="w-5 h-5 text-indigo-400" />
                    Importação Manual Determinística (JSON / CSV)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Para benchmarks acadêmicos/fechados sem endpoint público
                    estruturado (ex.: <code>bluefin</code>,{' '}
                    <code>finsheet-bench</code>, <code>mm-browsecomp</code>,{' '}
                    <code>ui-cube</code>, <code>slidebench</code>,{' '}
                    <code>design2code</code> ou cadernos brasileiros de{' '}
                    <code>llm-accountants-lawyers-br</code>), importe pontuações
                    verificáveis sem fabricar dados.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormat('json');
                      setImportContent(SAMPLE_MANUAL_JSON);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      importFormat === 'json'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Template JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormat('csv');
                      setImportContent(SAMPLE_MANUAL_CSV);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      importFormat === 'csv'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Template CSV
                  </button>
                </div>
              </div>

              <form onSubmit={handleManualImportSubmit} className="space-y-3">
                <textarea
                  rows={8}
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Formato selecionado:{' '}
                    <strong className="uppercase text-indigo-300">
                      {importFormat}
                    </strong>
                    . Os dados importados são persistidos no SQLite com{' '}
                    <code>originType: "manual"</code>.
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  >
                    Importar Dados Determinísticos
                  </button>
                </div>
              </form>

              {importStatusMsg && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium border ${
                    importStatusMsg.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {importStatusMsg.text}
                </div>
              )}
            </div>

            {/* DISCREET SECTION: BENCHMARKS AUTOMATICALLY HIDDEN FOR LOW FRONTIER COVERAGE */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-slate-400" />
                    Benchmarks Ocultados Automaticamente por Baixa Cobertura de
                    Fronteira ({hiddenFrontierBenchmarks.length})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Critério determinístico: exige ao menos 4 modelos atuais de
                    fronteira (2026) cobrindo 3+ provedores distintos e 3+ dos 4
                    principais laboratórios (Anthropic, OpenAI, Google, Meta).
                    Estes benchmarks são omitidos de todo o comparativo.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[11px]">
                      <th className="p-3">Benchmark</th>
                      <th className="p-3 text-center">Tipo</th>
                      <th className="p-3 text-center">Modelos Coletados</th>
                      <th className="p-3 text-center">Fronteira / Labs</th>
                      <th className="p-3">Motivo Determinístico da Ocultação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {hiddenFrontierBenchmarks.map((diag) => (
                      <tr
                        key={diag.benchmarkId}
                        className="hover:bg-slate-800/30 text-slate-300"
                      >
                        <td className="p-3 font-medium text-slate-200">
                          <div>{diag.benchmarkName}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {diag.benchmarkId}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              diag.isSubstitute
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {diag.isSubstitute ? 'Substituto' : 'Primário'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">
                          {diag.totalDistinctModels}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-400">
                          {diag.frontierModelsCount} fr /{' '}
                          {diag.majorFrontierLabsCount}/4 labs
                        </td>
                        <td className="p-3 text-slate-400">{diag.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ADAPTER SOURCES STATUS TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  Status Detalhado por Fonte Oficial (
                  {state?.sources.length ?? 0} Adaptadores Determinísticos)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[11px]">
                      <th className="p-3">Fonte / Adaptador</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Registros</th>
                      <th className="p-3 text-center">Latência / HTTP</th>
                      <th className="p-3">Última Atualização</th>
                      <th className="p-3">Diagnóstico Técnico / Motivo</th>
                      <th className="p-3 text-right">Link Oficial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {(state?.sources ?? []).map((src) => (
                      <tr key={src.sourceId} className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-slate-100">
                          <div>{src.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {src.sourceId}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              src.status === 'live'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : src.status === 'partial'
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                  : src.status === 'manual'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {src.status}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-200">
                          {src.recordsCount}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-400">
                          {src.durationMs}ms
                          {src.httpStatus ? ` (HTTP ${src.httpStatus})` : ''}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-400">
                          {src.lastSyncAt
                            ? new Date(src.lastSyncAt).toLocaleString('pt-BR')
                            : '—'}
                        </td>
                        <td className="p-3 text-slate-300 max-w-md">
                          {src.technicalReason}
                        </td>
                        <td className="p-3 text-right">
                          <a
                            href={src.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-400 hover:underline font-medium"
                          >
                            Abrir Fonte
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RECENT SYNC RUNS LOG */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  Histórico das Últimas Execuções do Agendador (Ciclo de 5
                  Minutos)
                </h3>
              </div>
              <div className="divide-y divide-slate-800/70">
                {(state?.syncRuns ?? []).map((run) => (
                  <div
                    key={run.id}
                    className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-mono text-slate-400">
                        #{run.id} [{run.trigger.toUpperCase()}]
                      </span>
                      <span className="text-slate-200">
                        {run.summaryMessage}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(run.completedAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 px-6 text-center text-xs text-slate-400">
        Comparativo LLMs (2026) • Node.js 22 + TypeScript + SQLite Nativo •
        Coleta 100% Determinística a cada 5 minutos (Zero IA no
        scraping/parsing/ranking)
      </footer>
    </div>
  );
}
