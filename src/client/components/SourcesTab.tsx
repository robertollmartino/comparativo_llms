import React from 'react';
import {
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  EyeOff,
  Upload,
} from 'lucide-react';
import {
  BenchmarkFrontierDiagnostic,
  SourceStatusRecord,
  SyncRunLog,
} from '../../shared/types.js';

export const SAMPLE_MANUAL_JSON = JSON.stringify(
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

export const SAMPLE_MANUAL_CSV = `benchmarkId,model,provider,effort,score,sourceUrl,notes
finsheet-bench,Claude Fable 5.2 (Max),Anthropic,max,88.2,https://www.vals.ai/benchmarks/corp_fin_v2,Auditoria determinística DRE/Balanço/DFC
finsheet-bench,GPT-6.2 Astra (Max),OpenAI,max,86.7,https://www.vals.ai/benchmarks/corp_fin_v2,Auditoria determinística DRE/Balanço/DFC
ui-cube,Claude Opus 5.5 (Max),Anthropic,max,79.4,https://github.com/UiPath/uipath_enterprise_benchmark,Execução local DeterministicBenchmark UiPath`;

interface SourcesTabProps {
  importFormat: 'json' | 'csv';
  setImportFormat: (fmt: 'json' | 'csv') => void;
  importContent: string;
  setImportContent: (content: string) => void;
  importStatusMsg: { type: 'success' | 'error'; text: string } | null;
  onSubmitImport: (e: React.FormEvent) => void;
  hiddenFrontierBenchmarks: BenchmarkFrontierDiagnostic[];
  sources: SourceStatusRecord[];
  syncRuns: SyncRunLog[];
}

export function SourcesTab({
  importFormat,
  setImportFormat,
  importContent,
  setImportContent,
  importStatusMsg,
  onSubmitImport,
  hiddenFrontierBenchmarks,
  sources,
  syncRuns,
}: SourcesTabProps) {
  return (
    <section className="space-y-6">
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

        <form onSubmit={onSubmitImport} className="space-y-3">
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
              principais laboratórios (Anthropic, OpenAI, Google, Meta). Estes
              benchmarks são omitidos de todo o comparativo.
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            Status Detalhado por Fonte Oficial ({sources.length} Adaptadores
            Determinísticos)
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
              {sources.map((src) => (
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Histórico das Últimas Execuções do Agendador (Ciclo de 5 Minutos)
          </h3>
        </div>
        <div className="divide-y divide-slate-800/70">
          {syncRuns.map((run) => (
            <div
              key={run.id}
              className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-slate-400">
                  #{run.id} [{run.trigger.toUpperCase()}]
                </span>
                <span className="text-slate-200">{run.summaryMessage}</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {new Date(run.completedAt).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
