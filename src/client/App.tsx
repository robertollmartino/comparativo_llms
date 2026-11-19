import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Check,
  Clock,
  Cpu,
  Database,
  EyeOff,
  Filter,
  GitCompare,
  Layers,
  RefreshCw,
  Scale,
  Search,
  Sliders,
  Sparkles,
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
  isFrontierModel,
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
import { BenchmarkTableCard } from './components/BenchmarkTables.js';
import { SAMPLE_MANUAL_JSON, SourcesTab } from './components/SourcesTab.js';
import {
  SubstitutesTab,
  UseCasesTab,
} from './components/UseCasesAndSubstitutes.js';

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
  const [overallBenchmarkFilter, setOverallBenchmarkFilter] =
    useState<string>('overall');
  const [overallUseCaseSort, setOverallUseCaseSort] =
    useState<string>('overall');
  const [homeBenchmarkSelect, setHomeBenchmarkSelect] =
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
  // 2. ACTIVE DISCOVERED PROVIDERS (STRICTLY CURRENT FRONTIER MODELS)
  // =========================================================================
  const { featuredActiveProviders, otherActiveProviders, modelProviderMap } =
    useMemo(() => {
      const counts = new Map<string, Set<string>>();
      const provMap = new Map<string, string>();
      if (state) {
        for (const s of state.scores) {
          if (s.modelCanonicalId === 'human') continue;
          if (!qualifiedBenchmarkIds.has(s.benchmarkId)) continue;
          if (!isFrontierModel(s.modelCanonicalId, s.modelDisplayName)) {
            continue;
          }
          const provider = resolveScoreProvider(s);
          const existing = provMap.get(s.modelCanonicalId);
          if (!existing || existing === 'Outros / Independente') {
            provMap.set(s.modelCanonicalId, provider);
          }
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
  // 3. COMPOSITE OVERALL RANKING (FRONTIER ONLY • TOP 4 PER PROVIDER)
  // =========================================================================
  const allFrontierModelsMap = useMemo(() => {
    if (!state) return new Map<string, ReturnType<typeof calculateOverallRanking>[number]>();
    const all = calculateOverallRanking(state.scores, {
      weights,
      includeSubstitutes,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      qualifiedBenchmarkIds,
      onlyFrontierModels: true,
      maxModelsPerProvider: null,
    });
    return new Map(all.map((m) => [m.modelCanonicalId, m]));
  }, [
    state,
    weights,
    includeSubstitutes,
    globalEffort,
    modelEffortOverrides,
    selectedProviders,
    qualifiedBenchmarkIds,
  ]);

  const rankedModels = useMemo(() => {
    if (!state) return [];
    const top4Ranked = calculateOverallRanking(state.scores, {
      weights,
      includeSubstitutes,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      qualifiedBenchmarkIds,
      onlyFrontierModels: true,
      maxModelsPerProvider: MAX_MODELS_PER_PROVIDER,
    });

    const filtered = !searchQuery.trim()
      ? top4Ranked
      : top4Ranked.filter((m) => {
          const q = searchQuery.toLowerCase().trim();
          return (
            m.displayName.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q) ||
            m.modelCanonicalId.toLowerCase().includes(q)
          );
        });

    if (overallUseCaseSort === 'overall') {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const aScore = a.useCaseScores[overallUseCaseSort]?.score ?? -1;
      const bScore = b.useCaseScores[overallUseCaseSort]?.score ?? -1;
      if (bScore !== aScore) return bScore - aScore;
      return b.overallScore - a.overallScore;
    });
  }, [
    state,
    weights,
    includeSubstitutes,
    globalEffort,
    modelEffortOverrides,
    selectedProviders,
    qualifiedBenchmarkIds,
    searchQuery,
    overallUseCaseSort,
  ]);

  // Synchronously filter comparedModelIds against selectedProviders without destructively wiping user picks
  const validComparedModelIds = useMemo(() => {
    const frontierOnly = comparedModelIds.filter((id) =>
      modelProviderMap.has(id)
    );
    if (selectedProviders.length === 0) return frontierOnly;
    const allowedSet = new Set(selectedProviders);
    return frontierOnly.filter((id) => {
      const prov = modelProviderMap.get(id);
      return prov != null && allowedSet.has(prov);
    });
  }, [comparedModelIds, selectedProviders, modelProviderMap]);

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

  // Reset home scope to 'all' if user clears all marked models while in 'compared' mode
  useEffect(() => {
    if (validComparedModelIds.length === 0 && homeTableScope === 'compared') {
      setHomeTableScope('all');
    }
  }, [validComparedModelIds.length, homeTableScope]);

  // Effective compare scope falls back to 'all' if no marked model matches current provider filter
  const effectiveCompareScope: TableModelScope =
    compareTableScope === 'compared' && validComparedModelIds.length > 0
      ? 'compared'
      : 'all';

  // Strictly filtered compared entries (falls back to active Top 4/provider frontier models when none marked)
  const comparedEntries = useMemo(() => {
    if (!state) return [];
    if (effectiveCompareScope === 'all' || validComparedModelIds.length === 0) {
      return rankedModels;
    }
    const ranked = calculateOverallRanking(state.scores, {
      weights,
      includeSubstitutes,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      selectedModelIds: validComparedModelIds,
      qualifiedBenchmarkIds,
      onlyFrontierModels: true,
      maxModelsPerProvider: MAX_MODELS_PER_PROVIDER,
    });
    const map = new Map(ranked.map((m) => [m.modelCanonicalId, m]));
    return validComparedModelIds
      .map((id) => map.get(id))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [
    state,
    effectiveCompareScope,
    rankedModels,
    weights,
    includeSubstitutes,
    globalEffort,
    modelEffortOverrides,
    selectedProviders,
    validComparedModelIds,
    qualifiedBenchmarkIds,
  ]);

  // =========================================================================
  // 4. PER-BENCHMARK RANKING TABLES (FRONTIER ONLY • TOP 4/PROVIDER • BEST->WORST)
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
      onlyFrontierModels: true,
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

  // Active benchmark table when filtering the main Classificação Geral table by a specific benchmark
  const overallSelectedBenchmarkTable = useMemo(() => {
    if (!state || overallBenchmarkFilter === 'overall') return null;
    const tables = buildPerBenchmarkRankings(state.scores, {
      includeSubstitutes: true,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      qualifiedBenchmarkIds,
      onlyFrontierModels: true,
      maxModelsPerProvider: MAX_MODELS_PER_PROVIDER,
      searchQuery,
    });
    return (
      tables.find((t) => t.benchmarkId === overallBenchmarkFilter) ?? null
    );
  }, [
    state,
    overallBenchmarkFilter,
    globalEffort,
    modelEffortOverrides,
    selectedProviders,
    qualifiedBenchmarkIds,
    searchQuery,
  ]);

  const compareBenchmarkTables = useMemo(() => {
    if (!state) return [];
    const useMarkedOnly =
      effectiveCompareScope === 'compared' && validComparedModelIds.length > 0;
    return buildPerBenchmarkRankings(state.scores, {
      includeSubstitutes,
      preferredEffort: globalEffort,
      modelEffortOverrides,
      providerFilter: selectedProviders,
      selectedModelIds: useMarkedOnly ? validComparedModelIds : undefined,
      qualifiedBenchmarkIds,
      onlyFrontierModels: true,
      maxModelsPerProvider: MAX_MODELS_PER_PROVIDER,
      searchQuery,
    });
  }, [
    state,
    effectiveCompareScope,
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
      onlyFrontierModels: true,
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs space-y-3">
          <div>{emptyMessage}</div>
          {selectedUseCaseFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedUseCaseFilter('all')}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold cursor-pointer"
            >
              Exibir todos os 7 Casos de Uso
            </button>
          )}
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
              <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-400" />
                    {overallSelectedBenchmarkTable
                      ? `Classificação por Benchmark: ${overallSelectedBenchmarkTable.benchmarkName} (Melhor → Pior)`
                      : 'Resumo da Classificação Geral Composta (0–100)'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {overallSelectedBenchmarkTable
                      ? `Exibindo ${Math.min(overallSelectedBenchmarkTable.rows.length, 80)} de ${overallSelectedBenchmarkTable.rows.length} modelos de fronteira avaliados neste benchmark (máx. ${MAX_MODELS_PER_PROVIDER}/provedor • Melhor → Pior).`
                      : `Exibindo ${Math.min(rankedModels.length, 80)} de ${rankedModels.length} modelos de fronteira atuais (máx. ${MAX_MODELS_PER_PROVIDER} melhores por provedor • ${qualifiedBenchmarkIds.size} benchmarks qualificados).`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <select
                      aria-label="Filtrar e ordenar Classificação Geral por Benchmark"
                      value={overallBenchmarkFilter}
                      onChange={(e) => {
                        setOverallBenchmarkFilter(e.target.value);
                        if (e.target.value !== 'overall') {
                          setOverallUseCaseSort('overall');
                        }
                      }}
                      className="bg-slate-950 border border-indigo-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-400 max-w-[280px]"
                    >
                      <option value="overall">
                        Classificação Geral Composta (Todos)
                      </option>
                      <optgroup label="Benchmarks Primários de Fronteira">
                        {(state?.benchmarks ?? [])
                          .filter(
                            (b) =>
                              !b.isSubstitute &&
                              qualifiedBenchmarkIds.has(b.id)
                          )
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Benchmarks Substitutos Qualificados">
                        {(state?.benchmarks ?? [])
                          .filter(
                            (b) =>
                              b.isSubstitute && qualifiedBenchmarkIds.has(b.id)
                          )
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} (Substituto)
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>

                  {overallBenchmarkFilter !== 'overall' && (
                    <button
                      type="button"
                      onClick={() => setOverallBenchmarkFilter('overall')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                    >
                      Limpar filtro de benchmark
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('compare')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold hover:bg-indigo-600/30 cursor-pointer"
                  >
                    Ver Comparativo ({validComparedModelIds.length} marcados)
                  </button>
                </div>
              </div>

              {(overallSelectedBenchmarkTable
                ? overallSelectedBenchmarkTable.rows.length === 0
                : rankedModels.length === 0) ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum modelo de fronteira encontrado para o filtro atual de
                  provedores / benchmark / busca.
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
                        {overallSelectedBenchmarkTable && (
                          <th className="py-3 px-3 text-center min-w-[140px] bg-indigo-950/40 text-indigo-200 border-x border-indigo-500/30">
                            <div>{overallSelectedBenchmarkTable.shortName}</div>
                            <div className="text-[10px] font-normal text-indigo-300">
                              Melhor → Pior
                            </div>
                          </th>
                        )}
                        <th
                          onClick={() => {
                            if (!overallSelectedBenchmarkTable) {
                              setOverallUseCaseSort('overall');
                            }
                          }}
                          className={`py-3 px-3 text-center min-w-[110px] ${
                            !overallSelectedBenchmarkTable
                              ? 'cursor-pointer hover:text-white'
                              : ''
                          }`}
                          title="Ordenar pela Nota Geral Composta"
                        >
                          Nota Geral (0–100)
                          {!overallSelectedBenchmarkTable &&
                            overallUseCaseSort === 'overall' &&
                            ' ▼'}
                        </th>
                        <th className="py-3 px-3 text-center min-w-[135px]">
                          Cobertura (Casos / Benchs)
                        </th>
                        {USE_CASES.map((uc) => (
                          <th
                            key={uc.id}
                            onClick={() => {
                              if (!overallSelectedBenchmarkTable) {
                                setOverallUseCaseSort(uc.id);
                              }
                            }}
                            className={`py-3 px-2.5 text-center min-w-[110px] ${
                              !overallSelectedBenchmarkTable
                                ? 'cursor-pointer hover:text-white'
                                : ''
                            } ${
                              overallUseCaseSort === uc.id &&
                              !overallSelectedBenchmarkTable
                                ? 'bg-indigo-950/40 text-indigo-200'
                                : ''
                            }`}
                            title={`${uc.title} — Clique para ordenar`}
                          >
                            <div className="font-bold text-slate-300">
                              Caso {uc.number}
                              {!overallSelectedBenchmarkTable &&
                                overallUseCaseSort === uc.id &&
                                ' ▼'}
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
                      {(overallSelectedBenchmarkTable
                        ? overallSelectedBenchmarkTable.rows
                            .slice(0, 80)
                            .map((bRow) => ({
                              entry: allFrontierModelsMap.get(
                                bRow.modelCanonicalId
                              ),
                              bRow,
                            }))
                        : rankedModels
                            .slice(0, 80)
                            .map((entry) => ({ entry, bRow: null }))
                      ).map(({ entry, bRow }, idx) => {
                        const modelId =
                          bRow?.modelCanonicalId ?? entry!.modelCanonicalId;
                        const displayName =
                          bRow?.displayName ?? entry!.displayName;
                        const provider = bRow?.provider ?? entry!.provider;
                        const isCompared =
                          validComparedModelIds.includes(modelId);
                        const availableEfforts = entry?.availableEfforts ?? [
                          bRow?.effort ?? 'default',
                        ];
                        const hasMultipleEfforts = availableEfforts.length > 1;
                        const currentOverride = modelEffortOverrides[modelId];
                        const selectedEffort =
                          bRow?.effort ?? entry?.selectedEffort ?? 'default';

                        return (
                          <tr
                            key={modelId}
                            className={`hover:bg-slate-800/40 transition ${
                              isCompared ? 'bg-indigo-950/25' : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                              {bRow ? bRow.rank : idx + 1}
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-bold text-slate-100 text-sm">
                                    {displayName}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                      {provider}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleModelCompare(modelId)}
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
                                        delete next[modelId];
                                      } else {
                                        next[modelId] = val as EffortLevel;
                                      }
                                      return next;
                                    });
                                  }}
                                  className="w-full bg-slate-950 border border-indigo-500/40 rounded px-2 py-1 text-[11px] text-indigo-200 font-medium"
                                >
                                  <option value="best">
                                    Melhor ({availableEfforts.join(', ')})
                                  </option>
                                  {availableEfforts.map((eff) => (
                                    <option key={eff} value={eff}>
                                      {EFFORT_LABELS[eff]} ({eff})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[11px]">
                                  {selectedEffort === 'default'
                                    ? 'Padrão do benchmark'
                                    : EFFORT_LABELS[selectedEffort]}
                                </span>
                              )}
                            </td>

                            {/* Highlighted Selected Benchmark Score */}
                            {overallSelectedBenchmarkTable && bRow && (
                              <td className="py-3 px-3 text-center bg-indigo-950/20 border-x border-indigo-500/20">
                                <div className="inline-flex flex-col items-center">
                                  <span className="text-base font-extrabold font-mono text-indigo-300">
                                    {bRow.displayScore}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {bRow.effort === 'default'
                                      ? 'Padrão'
                                      : EFFORT_LABELS[bRow.effort]}
                                  </span>
                                </div>
                              </td>
                            )}

                            {/* Overall Score */}
                            <td className="py-3 px-3 text-center">
                              {entry ? (
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
                              ) : (
                                <span className="text-slate-600 font-mono">
                                  —
                                </span>
                              )}
                            </td>

                            {/* Coverage */}
                            <td className="py-3 px-3 text-center">
                              {entry ? (
                                <>
                                  <div className="font-mono font-semibold text-slate-200">
                                    {entry.useCasesCovered}/
                                    {entry.totalUseCases} casos
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
                                </>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>

                            {/* Per Use Case Scores */}
                            {USE_CASES.map((uc) => {
                              const ucData = entry?.useCaseScores[uc.id];
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
                              {entry?.telemetry?.outputSpeedTokensPerSec ? (
                                <div className="text-cyan-300">
                                  {entry.telemetry.outputSpeedTokensPerSec}{' '}
                                  tok/s
                                </div>
                              ) : (
                                <div className="text-slate-600">— tok/s</div>
                              )}
                              {entry?.telemetry?.priceInput1M != null &&
                              entry?.telemetry?.priceOutput1M != null ? (
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
                      própria tabela (Top 20 visíveis), respeitando Top{' '}
                      {MAX_MODELS_PER_PROVIDER} modelos de fronteira por
                      provedor, filtro estrito e esforço selecionado.
                    </p>
                  </div>

                  {/* Quick Scope Toggle + Benchmark Select */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Filtrar tabela individual por benchmark"
                      value={homeBenchmarkSelect}
                      onChange={(e) => setHomeBenchmarkSelect(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 max-w-[260px]"
                    >
                      <option value="all">
                        Todos os benchmarks ativos ({homeBenchmarkTables.length})
                      </option>
                      {homeBenchmarkTables.map((t) => (
                        <option key={t.benchmarkId} value={t.benchmarkId}>
                          {t.benchmarkName} ({t.rows.length})
                        </option>
                      ))}
                    </select>

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
                homeBenchmarkSelect === 'all'
                  ? homeBenchmarkTables
                  : homeBenchmarkTables.filter(
                      (t) => t.benchmarkId === homeBenchmarkSelect
                    ),
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
                      setComparedModelIds(
                        rankedModels.map((m) => m.modelCanonicalId)
                      );
                      setCompareTableScope('compared');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 cursor-pointer"
                  >
                    Selecionar Todos Filtrados ({rankedModels.length})
                  </button>
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
                    onClick={() => {
                      setComparedModelIds([]);
                      setCompareTableScope('all');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>

              {/* Quick Model Selector Pills (strictly frontier & Top 4/provider) */}
              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1">
                {rankedModels.map((m) => {
                  const selected = validComparedModelIds.includes(
                    m.modelCanonicalId
                  );
                  return (
                    <button
                      type="button"
                      key={m.modelCanonicalId}
                      onClick={() => {
                        toggleModelCompare(m.modelCanonicalId);
                        if (compareTableScope === 'all') {
                          setCompareTableScope('compared');
                        }
                      }}
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

              {compareTableScope === 'compared' &&
                validComparedModelIds.length === 0 && (
                  <div className="rounded-lg bg-amber-950/30 border border-amber-500/40 px-3 py-2 text-xs text-amber-200">
                    Nenhum dos modelos marcados anteriormente pertence aos
                    provedores filtrados agora — exibindo automaticamente todos
                    os modelos de fronteira dos provedores selecionados (Top{' '}
                    {MAX_MODELS_PER_PROVIDER}/provedor). Clique nos modelos
                    acima para isolar uma seleção específica.
                  </div>
                )}

              {/* Scope Toggle & Use Case Filter */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-1 text-xs">
                  <button
                    type="button"
                    disabled={validComparedModelIds.length === 0}
                    onClick={() => setCompareTableScope('compared')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      effectiveCompareScope === 'compared'
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
                      effectiveCompareScope === 'all'
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
                {(effectiveCompareScope === 'all'
                  ? comparedEntries.slice(0, 15)
                  : comparedEntries
                ).map((entry) => (
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
              'Nenhum benchmark ativo possui pontuações para os modelos selecionados com os filtros atuais.'
            )}
          </section>
        )}

        {activeTab === 'use-cases' && (
          <UseCasesTab
            benchmarks={state?.benchmarks ?? []}
            qualifiedBenchmarkIds={qualifiedBenchmarkIds}
            allActiveBenchmarkTablesMap={allActiveBenchmarkTablesMap}
          />
        )}

        {activeTab === 'substitutes' && (
          <SubstitutesTab
            benchmarks={state?.benchmarks ?? []}
            qualifiedBenchmarkIds={qualifiedBenchmarkIds}
            allActiveBenchmarkTablesMap={allActiveBenchmarkTablesMap}
          />
        )}

        {activeTab === 'sources' && (
          <SourcesTab
            importFormat={importFormat}
            setImportFormat={setImportFormat}
            importContent={importContent}
            setImportContent={setImportContent}
            importStatusMsg={importStatusMsg}
            onSubmitImport={handleManualImportSubmit}
            hiddenFrontierBenchmarks={hiddenFrontierBenchmarks}
            sources={state?.sources ?? []}
            syncRuns={state?.syncRuns ?? []}
          />
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
