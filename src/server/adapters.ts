import { ADAPTER_SOURCES } from '../shared/catalog.js';
import { BenchmarkScoreRecord, SourceStatusRecord } from '../shared/types.js';
import {
  parseArtificialAnalysisHtmlOrJson,
  parseArtifactsBenchJs,
  parseLMArenaWebDevHtml,
  parseOmegaUseOfficeValHtml,
  parseScaleSweBenchProHtml,
  parseSpreadsheetBenchJson,
  parseSteelLeaderboardJson,
  parseTau2SubmissionJson,
  parseTbenchHtml,
  parseValsBenchmarkHtml,
} from './parsers.js';

export interface AdapterExecutionResult {
  statusRecord: SourceStatusRecord;
  scores: BenchmarkScoreRecord[];
}

const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 12000);
const USER_AGENT =
  'ComparativoLLMs/1.0 (Deterministic Benchmark Collector; Node.js/22; +https://localhost)';

async function fetchWithRetry(
  url: string,
  options: { headers?: Record<string, string>; retries?: number; timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; text: string }> {
  const retries = options.retries ?? 1;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json, text/html, */*',
    ...(options.headers || {}),
  };

  if (url.includes('api.github.com') && process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error(`Falha ao acessar ${url}`);
}

export async function runAllDeterministicAdapters(
  existingManualCountsBySource: Map<string, number>
): Promise<AdapterExecutionResult[]> {
  const nowIso = new Date().toISOString();

  const tasks = ADAPTER_SOURCES.map(async (src): Promise<AdapterExecutionResult> => {
    const startMs = Date.now();
    const manualCount = existingManualCountsBySource.get(src.id) ?? 0;

    try {
      switch (src.id) {
        case 'artificial-analysis': {
          const apiKey = process.env.AA_API_KEY?.trim();
          let scores: BenchmarkScoreRecord[] = [];
          let httpStatus = 200;
          let usedApiV2 = false;

          if (apiKey) {
            const apiRes = await fetchWithRetry(
              'https://data.artificialanalysis.ai/api/v2/language/models',
              {
                headers: { 'x-api-key': apiKey, Authorization: `Bearer ${apiKey}` },
              }
            );
            if (apiRes.ok) {
              scores = parseArtificialAnalysisHtmlOrJson(apiRes.text, nowIso);
              httpStatus = apiRes.status;
              usedApiV2 = true;
            }
          }

          if (scores.length === 0) {
            const webRes = await fetchWithRetry(
              'https://artificialanalysis.ai/leaderboards/models'
            );
            httpStatus = webRes.status;
            if (webRes.ok) {
              scores = parseArtificialAnalysisHtmlOrJson(webRes.text, nowIso);
            }
          }

          const durationMs = Date.now() - startMs;
          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: usedApiV2
                ? 'https://data.artificialanalysis.ai/api/v2/language/models'
                : src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs,
              httpStatus,
              technicalReason:
                scores.length > 0
                  ? `Coleta determinística concluída (${scores.length} pontuações extraídas via ${
                      usedApiV2 ? 'Data API v2 com AA_API_KEY' : 'página pública initialModels JSON'
                    }).`
                  : 'Nenhum modelo retornado pelo endpoint do Artificial Analysis.',
            },
          };
        }

        case 'tau2-bench': {
          const manifestRes = await fetchWithRetry(
            'https://raw.githubusercontent.com/sierra-research/tau2-bench/main/web/leaderboard/public/submissions/manifest.json'
          );
          const scores: BenchmarkScoreRecord[] = [];
          if (manifestRes.ok) {
            const manifest = JSON.parse(manifestRes.text);
            const dirs: string[] = Array.isArray(manifest.submissions)
              ? manifest.submissions.slice(0, 18)
              : [];

            const subResults = await Promise.allSettled(
              dirs.map(async (dir) => {
                const subRes = await fetchWithRetry(
                  `https://raw.githubusercontent.com/sierra-research/tau2-bench/main/web/leaderboard/public/submissions/${dir}/submission.json`,
                  { retries: 0, timeoutMs: 7000 }
                );
                if (subRes.ok) {
                  return parseTau2SubmissionJson(JSON.parse(subRes.text), nowIso);
                }
                return null;
              })
            );

            for (const r of subResults) {
              if (r.status === 'fulfilled' && r.value) {
                scores.push(r.value);
              }
            }
          }

          // Complement with steel-dev tauBench.json
          const steelTau = await fetchWithRetry(
            'https://raw.githubusercontent.com/steel-dev/leaderboard/main/src/data/tauBench.json'
          );
          if (steelTau.ok) {
            const extra = parseSteelLeaderboardJson(
              JSON.parse(steelTau.text),
              'tau-bench',
              'tau2-bench',
              'https://taubench.com/',
              nowIso
            );
            scores.push(...extra);
          }

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus: manifestRes.status,
              technicalReason: `Coleta oficial Sierra τ²-bench concluída (${scores.length} registros extraídos do GitHub sierra-research/tau2-bench + taubench.com).`,
            },
          };
        }

        case 'terminal-bench-2-1': {
          const [tbenchRes, valsTbRes] = await Promise.allSettled([
            fetchWithRetry('https://www.tbench.ai/'),
            fetchWithRetry('https://www.vals.ai/benchmarks/terminal-bench-2-1'),
          ]);

          const scores: BenchmarkScoreRecord[] = [];
          let httpStatus = 200;

          if (tbenchRes.status === 'fulfilled' && tbenchRes.value.ok) {
            httpStatus = tbenchRes.value.status;
            scores.push(...parseTbenchHtml(tbenchRes.value.text, nowIso));
          }
          if (valsTbRes.status === 'fulfilled' && valsTbRes.value.ok) {
            scores.push(
              ...parseValsBenchmarkHtml(
                valsTbRes.value.text,
                'terminal-bench-2-1',
                'terminal-bench-2-1',
                'https://www.vals.ai/benchmarks/terminal-bench-2-1',
                nowIso
              )
            );
          }

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus,
              technicalReason: `Leaderboard Terminal-Bench 2.1 extraído de tbench.ai e Vals.ai (${scores.length} entradas com nível de esforço e scaffold).`,
            },
          };
        }

        case 'gaia-leaderboard': {
          const [hfSpaceRes, steelGaiaRes] = await Promise.allSettled([
            fetchWithRetry('https://huggingface.co/api/spaces/gaia-benchmark/leaderboard'),
            fetchWithRetry(
              'https://raw.githubusercontent.com/steel-dev/leaderboard/main/src/data/gaia.json'
            ),
          ]);

          const scores: BenchmarkScoreRecord[] = [];
          let httpStatus = 200;
          if (hfSpaceRes.status === 'fulfilled') {
            httpStatus = hfSpaceRes.value.status;
          }
          if (steelGaiaRes.status === 'fulfilled' && steelGaiaRes.value.ok) {
            scores.push(
              ...parseSteelLeaderboardJson(
                JSON.parse(steelGaiaRes.value.text),
                'gaia',
                'gaia-leaderboard',
                'https://huggingface.co/spaces/gaia-benchmark/leaderboard',
                nowIso
              )
            );
          }

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'partial',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus,
              technicalReason: `Hugging Face Space gaia-benchmark/leaderboard verificado (HTTP ${httpStatus}) + ${scores.length} entradas oficiais GAIA sincronizadas.`,
            },
          };
        }

        case 'osworld-2': {
          const res = await fetchWithRetry(
            'https://raw.githubusercontent.com/steel-dev/leaderboard/main/src/data/osworld2.json'
          );
          const scores = res.ok
            ? parseSteelLeaderboardJson(
                JSON.parse(res.text),
                'osworld-2',
                'osworld-2',
                'https://osworld-v2.xlang.ai/',
                nowIso
              )
            : [];

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus: res.status,
              technicalReason: `OSWorld 2.0 sincronizado deterministicamente (${scores.length} modelos avaliados).`,
            },
          };
        }

        case 'steel-leaderboard': {
          const files: Array<{ file: string; benchmarkId: string; url: string }> = [
            {
              file: 'browsecomp.json',
              benchmarkId: 'browsecomp',
              url: 'https://github.com/steel-dev/leaderboard/blob/main/src/data/browsecomp.json',
            },
            {
              file: 'osworld.json',
              benchmarkId: 'osworld-v1',
              url: 'https://github.com/steel-dev/leaderboard/blob/main/src/data/osworld.json',
            },
            {
              file: 'aiderPolyglot.json',
              benchmarkId: 'aider-polyglot',
              url: 'https://aider.chat/docs/leaderboards/',
            },
            {
              file: 'webarena.json',
              benchmarkId: 'workarena',
              url: 'https://github.com/steel-dev/leaderboard/blob/main/src/data/webarena.json',
            },
          ];

          const scores: BenchmarkScoreRecord[] = [];
          let lastStatus = 200;

          const fetched = await Promise.allSettled(
            files.map(async (f) => {
              const r = await fetchWithRetry(
                `https://raw.githubusercontent.com/steel-dev/leaderboard/main/src/data/${f.file}`
              );
              lastStatus = r.status;
              if (r.ok) {
                return parseSteelLeaderboardJson(
                  JSON.parse(r.text),
                  f.benchmarkId,
                  'steel-leaderboard',
                  f.url,
                  nowIso
                );
              }
              return [];
            })
          );

          for (const item of fetched) {
            if (item.status === 'fulfilled') scores.push(...item.value);
          }

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus: lastStatus,
              technicalReason: `Coleta JSON concluída para BrowseComp, OSWorld v1, Aider Polyglot e WorkArena (${scores.length} registros).`,
            },
          };
        }

        case 'vals-legal-research':
        case 'vals-legal-bench':
        case 'vals-swebench':
        case 'vals-lcb':
        case 'vals-cua-bench':
        case 'vals-mmmu':
        case 'llm-accountants-lawyers-br': {
          const benchId = src.benchmarkIds[0];
          const res = await fetchWithRetry(src.endpointUrl);
          const scores = res.ok
            ? parseValsBenchmarkHtml(res.text, benchId, src.id, src.officialUrl, nowIso)
            : [];

          // Also enrich swe-bench-verified with steel-dev sweBenchVerified.json
          if (src.id === 'vals-swebench') {
            const steelSwe = await fetchWithRetry(
              'https://raw.githubusercontent.com/steel-dev/leaderboard/main/src/data/sweBenchVerified.json'
            );
            if (steelSwe.ok) {
              scores.push(
                ...parseSteelLeaderboardJson(
                  JSON.parse(steelSwe.text),
                  'swe-bench-verified',
                  src.id,
                  src.officialUrl,
                  nowIso
                )
              );
            }
          }

          const totalCount = scores.length + manualCount;
          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status:
                scores.length > 0
                  ? src.id === 'llm-accountants-lawyers-br' && manualCount === 0
                    ? 'partial'
                    : 'live'
                  : manualCount > 0
                    ? 'manual'
                    : 'unavailable',
              recordsCount: totalCount,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus: res.status,
              technicalReason:
                src.id === 'llm-accountants-lawyers-br'
                  ? `Base tributária sincronizada via Vals Tax Eval v2 (${scores.length} modelos). Para cadernos específicos de SPED, Simples Nacional e Reforma Tributária BR (IBS/CBS), utilize também a importação manual JSON/CSV (${manualCount} importados).`
                  : `Tabela HTML extraída deterministicamente de ${src.endpointUrl} (${scores.length} modelos).`,
            },
          };
        }

        case 'vals-finance-index': {
          const [finIdxRes, corpFinRes] = await Promise.allSettled([
            fetchWithRetry('https://www.vals.ai/benchmarks/finance_index'),
            fetchWithRetry('https://www.vals.ai/benchmarks/corp_fin_v2'),
          ]);

          const scores: BenchmarkScoreRecord[] = [];
          let httpStatus = 200;

          if (finIdxRes.status === 'fulfilled' && finIdxRes.value.ok) {
            httpStatus = finIdxRes.value.status;
            scores.push(
              ...parseValsBenchmarkHtml(
                finIdxRes.value.text,
                'financebench',
                src.id,
                'https://www.vals.ai/benchmarks/finance_index',
                nowIso
              )
            );
          }
          if (corpFinRes.status === 'fulfilled' && corpFinRes.value.ok) {
            scores.push(
              ...parseValsBenchmarkHtml(
                corpFinRes.value.text,
                'finqa',
                src.id,
                'https://www.vals.ai/benchmarks/corp_fin_v2',
                nowIso
              )
            );
          }

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus,
              technicalReason: `Dados de Finance Index e Corporate Finance v2 coletados do Vals.ai (${scores.length} registros).`,
            },
          };
        }

        case 'spreadsheetbench': {
          const [v2Res, v1Res] = await Promise.allSettled([
            fetchWithRetry(
              'https://spreadsheetbench.github.io/data/leaderboard-v2-full.json'
            ),
            fetchWithRetry(
              'https://spreadsheetbench.github.io/data/leaderboard-v1-full.json'
            ),
          ]);

          const scores: BenchmarkScoreRecord[] = [];
          let httpStatus = 200;

          if (v2Res.status === 'fulfilled' && v2Res.value.ok) {
            httpStatus = v2Res.value.status;
            scores.push(
              ...parseSpreadsheetBenchJson(
                JSON.parse(v2Res.value.text),
                'spreadsheetbench-2',
                nowIso
              )
            );
          }
          if (v1Res.status === 'fulfilled' && v1Res.value.ok) {
            scores.push(
              ...parseSpreadsheetBenchJson(
                JSON.parse(v1Res.value.text),
                'spreadsheetbench-v1',
                nowIso
              )
            );
          }

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus,
              technicalReason: `JSONs oficiais do SpreadsheetBench V2 e V1 sincronizados (${scores.length} entradas com subscores de modelagem financeira e fórmulas).`,
            },
          };
        }

        case 'scale-swebench-pro': {
          const res = await fetchWithRetry(
            'https://scale.com/leaderboard/swe_bench_pro_public_v2'
          );
          const scores = res.ok ? parseScaleSweBenchProHtml(res.text, nowIso) : [];

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus: res.status,
              technicalReason: `Leaderboard público SWE-bench Pro V2 da Scale AI extraído (${scores.length} modelos).`,
            },
          };
        }

        case 'lmarena-webdev': {
          const res = await fetchWithRetry('https://web.lmarena.ai/leaderboard/webdev');
          const scores = res.ok ? parseLMArenaWebDevHtml(res.text, nowIso) : [];

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus: res.status,
              technicalReason: `Ranking oficial por modalidade WebDev extraído do LMArena (${scores.length} modelos ranqueados).`,
            },
          };
        }

        case 'artifactsbench': {
          const res = await fetchWithRetry(
            'https://artifactsbenchmark.github.io/static/js/main.f0afaa17.js'
          );
          const scores = res.ok ? parseArtifactsBenchJs(res.text, nowIso) : [];

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus: res.status,
              technicalReason: `Matriz JSON de desempenho extraída do bundle oficial do ArtifactsBench (${scores.length} modelos).`,
            },
          };
        }

        case 'omegause-officeval': {
          const res = await fetchWithRetry(
            'https://raw.githubusercontent.com/omegause-officeval/omegause-officeval.github.io/main/index.html'
          );
          const scores = res.ok ? parseOmegaUseOfficeValHtml(res.text, nowIso) : [];

          return {
            scores,
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: scores.length > 0 ? 'live' : 'unavailable',
              recordsCount: scores.length,
              lastSyncAt: nowIso,
              lastSuccessAt: scores.length > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus: res.status,
              technicalReason: `Array leaderboardData extraído de omegause-officeval.github.io (${scores.length} modelos avaliados em DOCX/PPTX/XLSX/PDF).`,
            },
          };
        }

        // Sources that verify repository availability and rely on manual import or substitutes (zero score fabrication!)
        case 'ui-cube':
        case 'mm-browsecomp':
        case 'finsheet-bench':
        case 'bluefin':
        case 'slidebench':
        case 'design2code': {
          let httpStatus = 200;
          try {
            const probe = await fetchWithRetry(src.endpointUrl, {
              retries: 0,
              timeoutMs: 6000,
            });
            httpStatus = probe.status;
          } catch {
            httpStatus = 0;
          }

          const reasons: Record<string, string> = {
            'ui-cube':
              'Repositório oficial UiPath/uipath_enterprise_benchmark verificado (HTTP ' +
              httpStatus +
              '), porém publica apenas o código-fonte do avaliador DeterministicBenchmark sem tabela JSON/HTML de scores. Nenhuma pontuação fabricada; utilize importação manual JSON/CSV ou os substitutos automáticos (OSWorld v1 / ScreenSpot-Pro / WorkArena).',
            'mm-browsecomp':
              'Repositório oficial MMBrowseComp/MM-BrowseComp verificado (HTTP ' +
              httpStatus +
              '), mas publica o dataset criptografado e resultados apenas em imagem estática (images/results.png). Nenhuma pontuação fabricada; utilize importação manual JSON/CSV ou o substituto automático AA-LCR.',
            'finsheet-bench':
              'Benchmark publicado apenas em artigo científico (paper-only), sem endpoint JSON/HTML público legível de forma determinística. Nenhuma pontuação fabricada; utilize importação manual JSON/CSV ou os substitutos automáticos (FinanceBench / FinQA / AA Intelligence Index).',
            bluefin:
              'Benchmark proprietário/fechado de modelagem Excel sem feed público estruturado. Nenhuma pontuação fabricada; utilize importação manual JSON/CSV ou os substitutos automáticos (SpreadsheetBench 2 / SpreadsheetBench v1 / AA Coding+Math Index).',
            slidebench:
              'Repositório BL4Z23/SlideBench verificado (HTTP ' +
              httpStatus +
              '), sem leaderboard JSON/HTML público estruturado. Nenhuma pontuação fabricada; utilize importação manual JSON/CSV ou os substitutos automáticos (MMMU / AA Briefcase / OmegaUse-OfficeVal).',
            design2code:
              'Repositório Stanford SALT NoviScl/Design2Code verificado (HTTP ' +
              httpStatus +
              '); resultados do paper divulgados apenas em PDF/figuras estáticas sem JSON de leaderboard ativo. Nenhuma pontuação fabricada; utilize importação manual JSON/CSV ou os substitutos automáticos (AA Briefcase / MMMU).',
          };

          return {
            scores: [],
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: manualCount > 0 ? 'manual' : 'unavailable',
              recordsCount: manualCount,
              lastSyncAt: nowIso,
              lastSuccessAt: manualCount > 0 ? nowIso : null,
              durationMs: Date.now() - startMs,
              httpStatus,
              technicalReason: reasons[src.id],
            },
          };
        }

        default:
          return {
            scores: [],
            statusRecord: {
              sourceId: src.id,
              name: src.name,
              officialUrl: src.officialUrl,
              endpointUrl: src.endpointUrl,
              status: manualCount > 0 ? 'manual' : 'unavailable',
              recordsCount: manualCount,
              lastSyncAt: nowIso,
              lastSuccessAt: null,
              durationMs: Date.now() - startMs,
              httpStatus: null,
              technicalReason: 'Adaptador sem endpoint público configurado.',
            },
          };
      }
    } catch (err: any) {
      return {
        scores: [],
        statusRecord: {
          sourceId: src.id,
          name: src.name,
          officialUrl: src.officialUrl,
          endpointUrl: src.endpointUrl,
          status: manualCount > 0 ? 'manual' : 'unavailable',
          recordsCount: manualCount,
          lastSyncAt: nowIso,
          lastSuccessAt: null,
          durationMs: Date.now() - startMs,
          httpStatus: null,
          technicalReason: `Erro de rede/timeout ao consultar fonte oficial: ${
            err?.message || String(err)
          }`,
        },
      };
    }
  });

  return Promise.all(tasks);
}