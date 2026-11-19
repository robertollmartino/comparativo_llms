import React from 'react';
import {
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { USE_CASES } from '../../shared/catalog.js';
import {
  BenchmarkDefinition,
  BenchmarkRankingTable,
} from '../../shared/types.js';
import { CompactTopRows } from './BenchmarkTables.js';

export function UseCasesTab({
  benchmarks,
  qualifiedBenchmarkIds,
  allActiveBenchmarkTablesMap,
}: {
  benchmarks: BenchmarkDefinition[];
  qualifiedBenchmarkIds: Set<string>;
  allActiveBenchmarkTablesMap: Map<string, BenchmarkRankingTable>;
}) {
  return (
    <section className="space-y-6">
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
              Cruzamento de blocos e registros do SPED (ECD, ECF, EFD-ICMS/IPI,
              EFD-Contribuições, EFD-Reinf e MIT) e regras da Receita Federal do
              Brasil.
            </p>
          </div>
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-3">
            <div className="font-bold text-xs text-amber-300">
              2. Simples Nacional & Regimes Tributários
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Cálculo de Fator R, anexos da LC 123/2006, sublimites estaduais,
              substituição tributária (ICMS-ST / MVA) e equiparação hospitalar
              no Lucro Presumido.
            </p>
          </div>
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-3">
            <div className="font-bold text-xs text-amber-300">
              3. Reforma Tributária BR & Trava Anti-Revogação
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Regras de transição da EC 132/2023 e LC 214/2025 (IBS, CBS e
              Imposto Seletivo). O{' '}
              <strong>LLM Benchmark for Accountants and Lawyers</strong> aplica
              trava rígida penalizando qualquer citação de instrução normativa
              ou lei revogada.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {USE_CASES.map((uc) => {
          const qualifiedPrimaries = uc.primaryBenchmarkIds
            .filter((id) => qualifiedBenchmarkIds.has(id))
            .map((id) => benchmarks.find((b) => b.id === id))
            .filter((b): b is BenchmarkDefinition => Boolean(b));

          const qualifiedSubstitutes = uc.substituteBenchmarkIds
            .filter((id) => qualifiedBenchmarkIds.has(id))
            .map((id) => benchmarks.find((b) => b.id === id))
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
                  Os benchmarks primários deste caso de uso foram ocultados
                  automaticamente por ausência de modelos atuais de fronteira ou
                  falta de dados públicos. Exibindo abaixo apenas os{' '}
                  <strong>substitutos qualificados</strong> com cobertura de
                  fronteira ativa.
                </div>
              )}

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
                            {bench.isSubstitute ? 'Substituto' : 'Primário'}
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

                      <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            Top {Math.min(rows.length, 20)} Fronteira (de{' '}
                            {rows.length} • máx. 4/provedor):
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

                        <CompactTopRows
                          rows={rows}
                          scoreColorClass="text-emerald-400"
                          emptyText="Nenhum modelo de fronteira dos provedores selecionados possui pontuação neste benchmark."
                        />
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
  );
}

export function SubstitutesTab({
  benchmarks,
  qualifiedBenchmarkIds,
  allActiveBenchmarkTablesMap,
}: {
  benchmarks: BenchmarkDefinition[];
  qualifiedBenchmarkIds: Set<string>;
  allActiveBenchmarkTablesMap: Map<string, BenchmarkRankingTable>;
}) {
  return (
    <section className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          Benchmarks Substitutos Qualificados de Fronteira (Artificial Analysis
          & Equivalentes)
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          Exibindo apenas substitutos com cobertura ativa de modelos atuais de
          fronteira (Top 4 modelos de fronteira/provedor e filtro estrito de
          provedores aplicado). Sempre que acionados no ranking composto,
          recebem o badge explícito{' '}
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
            Substituto
          </span>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {benchmarks
          .filter((b) => b.isSubstitute && qualifiedBenchmarkIds.has(b.id))
          .map((sub) => {
            const table = allActiveBenchmarkTablesMap.get(sub.id);
            const rows = table?.rows ?? [];
            const primaryNames = (sub.substituteForIds ?? []).map(
              (pid) => benchmarks.find((b) => b.id === pid)?.shortName ?? pid
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
                    <span>
                      Top {Math.min(rows.length, 20)} Fronteira (máx.
                      4/provedor):
                    </span>
                    <strong className="text-emerald-400 font-mono">
                      {rows.length} modelos
                    </strong>
                  </div>
                  <CompactTopRows
                    rows={rows}
                    scoreColorClass="text-amber-300"
                    emptyText="Nenhum modelo de fronteira dos provedores selecionados neste substituto."
                  />
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
