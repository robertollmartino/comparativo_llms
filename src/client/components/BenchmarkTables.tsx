import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { EFFORT_LABELS } from '../../shared/catalog.js';
import { BenchmarkRankingTable } from '../../shared/types.js';

interface BenchmarkTableCardProps {
  table: BenchmarkRankingTable;
  comparedModelIds: string[];
  onToggleCompare: (canonicalId: string) => void;
  defaultRowLimit?: number;
}

export function BenchmarkTableCard({
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

export function CompactTopRows({
  rows,
  scoreColorClass = 'text-emerald-400',
  emptyText,
}: {
  rows: BenchmarkRankingTable['rows'];
  scoreColorClass?: string;
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) {
    return (
      <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
        {emptyText}
      </div>
    );
  }
  const visible = expanded ? rows : rows.slice(0, 20);
  return (
    <div className="space-y-1">
      {visible.map((row) => (
        <div
          key={row.modelCanonicalId}
          className="flex items-center justify-between text-xs bg-slate-900/90 px-2.5 py-1 rounded gap-2"
        >
          <span className="truncate text-slate-200">
            {row.rank}. {row.displayName}{' '}
            <span className="text-[10px] text-slate-400">
              [{row.provider}
              {row.effort !== 'default' ? ` • ${row.effort}` : ''}]
            </span>
          </span>
          <span className={`font-mono font-bold shrink-0 ${scoreColorClass}`}>
            {row.displayScore}
          </span>
        </div>
      ))}
      {rows.length > 20 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-center pt-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer"
        >
          {expanded
            ? 'Recolher para Top 20'
            : `Ver todos os ${rows.length} modelos (+${rows.length - 20})`}
        </button>
      )}
    </div>
  );
}
