# Comparativo LLMs (Edição 2026)

Plataforma web completa em português (PT-BR), construída com **Node.js 22 + TypeScript + SQLite nativo (`node:sqlite`) + React 19 + Tailwind CSS**, para comparação em tempo real de modelos de linguagem (LLMs) nos **7 Casos de Uso Corporativos e Técnicos de 2026**, com **coleta 100% determinística (zero uso de IA/LLM para scraping, parsing, normalização ou ranking)**.

---

## 1. Arquitetura e Princípios Técnicos

- **Stack Unificada (Node.js 22 + TypeScript)**:
  - **Backend (`src/server/`)**: Express + TypeScript + Persistência em SQLite nativo (`node:sqlite`) + exportação automática de snapshot JSON (`data/latest-snapshot.json`) + streaming de eventos em tempo real via **Server-Sent Events (`/api/events`)**.
  - **Frontend (`src/client/`)**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons.
  - ** Domínio Compartilhado (`src/shared/`)**: Catálogo dos 7 Casos de Uso, 35+ Benchmarks (primários e substitutos), normalizador determinístico de modelos/provedores/nível de esforço (`normalizer.ts`) e motor de cálculo da Classificação Geral (`ranking.ts`).
- **Agendador Determinístico de 5 Minutos (`300000 ms`)**:
  - Executa automaticamente a cada 5 minutos (`SYNC_INTERVAL_MS=300000`) a varredura de todas as 25 fontes configuradas.
  - Inclui botão **"Sincronizar Agora"** na interface e endpoint `POST /api/sync`.
- **Proibição Estrita de Fabricação de Dados**:
  - Quando um benchmark primário é publicado apenas em artigo científico (paper-only), dataset criptografado ou imagem estática (`MM-BrowseComp`, `FinSheet-Bench`, `BlueFin`, `UI-CUBE`, `SlideBench`, `Design2Code`), o adaptador verifica o repositório/página oficial, registra o status real (`unavailable` ou `manual`), exibe o diagnóstico técnico na UI, habilita **importação manual determinística via JSON/CSV** e aciona **benchmarks substitutos** claramente identificados com o badge **`Substituto`**.

---

## 2. Os 7 Casos de Uso e Benchmarks Implementados

| # | Caso de Uso | Benchmarks Primários | Benchmarks Substitutos (Fallback com Badge `Substituto`) |
|---|---|---|---|
| **1** | **Busca profunda de leis tributárias/contábeis** | `BrowseComp`, `Vals Legal Research Bench`, `MM-BrowseComp`, `LLM Benchmark for Accountants and Lawyers (BR/EUA)` | `AA-LCR`, `SimpleQA / AA Omniscience`, `LegalBench`, `AA Intelligence Index` |
| **2** | **Análise financeira/tributária empresarial e insights** | `GDPval-AA v2.1`, `FinSheet-Bench`, `LLM Benchmark for Accountants and Lawyers (BR/EUA)` | `AA Intelligence Index`, `FinQA / Vals CorpFin v2`, `FinanceBench / Vals Finance Index` |
| **3** | **Criação de planilhas Excel complexas** | `BlueFin`, `SpreadsheetBench 2` | `SpreadsheetBench v1`, `AA Coding + Math Index`, `LiveCodeBench` |
| **4** | **Automações em geral (estilo Hermes Agent / CLI / APIs)** | `Terminal-Bench 2.1`, `τ-bench (tau-bench / tau2-bench)`, `GAIA` | `τ²-bench (AA)`, `Terminal-Bench Hard/2.0`, `BFCL / IFBench`, `AA Agentic Index` |
| **5** | **Computer Use 100% desktop (clicar em apps e preencher dados)** | `OSWorld 2.0`, `UI-CUBE` | `ScreenSpot-Pro / Vals CUA Bench`, `OSWorld v1`, `WorkArena / WebArena` |
| **6** | **Criação de apps com banco de dados** | `SWE-bench Pro V2`, `WebDev Arena (LMArena)`, `ArtifactsBench` | `SWE-bench Verified`, `LiveCodeBench`, `AA Coding Index`, `Aider Polyglot` |
| **7** | **Apresentações PPTX, HTML e layouts Word/PDF** | `SlideBench`, `OmegaUse-OfficeVal`, `Design2Code` | `MMMU / MMMU-Pro`, `AA Briefcase / Visual Layout`, `AA Multimodal/Office Index` |

### Destaque Contabilidade e Direito Tributário Brasileiro (Casos 1 e 2)
A plataforma destaca visualmente e no modelo de dados que benchmarks norte-americanos como o **Vals Legal Research Bench** não cobrem nuances de **SPED (ECD/ECF/EFD-Contribuições)**, **Simples Nacional (LC 123/2006)** ou da **Reforma Tributária Brasileira (EC 132/2023 e LC 214/2025 — IBS/CBS)**, integrando o **LLM Benchmark for Accountants and Lawyers (BR/EUA)** com trava rígida contra alucinação de legislação revogada.

---

## 3. Endpoints Oficiais Conectados nos Adaptadores

- **Artificial Analysis (`GDPval-AA v2.1`, Índices Substitutos, Velocidade `tokens/s`, Latência `TTFT` e Custo `$/1M tokens`)**:
  - Página pública: `https://artificialanalysis.ai/leaderboards/models`
  - API v2 (opcional com `AA_API_KEY`): `https://data.artificialanalysis.ai/api/v2/language/models`
- **τ-bench / τ²-bench**: `https://raw.githubusercontent.com/sierra-research/tau2-bench/main/web/leaderboard/public/submissions/manifest.json` + `https://taubench.com/`
- **Terminal-Bench 2.1**: `https://www.tbench.ai/` + `https://www.vals.ai/benchmarks/terminal-bench-2-1` + `harbor-framework/terminal-bench-2-1`
- **GAIA**: `https://huggingface.co/api/spaces/gaia-benchmark/leaderboard` + `steel-dev/leaderboard/src/data/gaia.json`
- **OSWorld 2.0 & v1**: `https://osworld-v2.xlang.ai/` + `xlang-ai/OSWorld-V2` + `steel-dev/leaderboard/src/data/osworld2.json`
- **BrowseComp, Aider Polyglot & WorkArena**: `https://api.github.com/repos/steel-dev/leaderboard/contents/src/data`
- **Vals.ai Suites**: `legal_research`, `legal_bench`, `finance_index`, `corp_fin_v2`, `tax_eval_v2`, `swebench`, `lcb`, `cua_bench`, `mmmu`
- **SpreadsheetBench 2 & v1**: `https://spreadsheetbench.github.io/data/leaderboard-v2-full.json` e `leaderboard-v1-full.json`
- **SWE-bench Pro V2**: `https://scale.com/leaderboard/swe_bench_pro_public_v2`
- **WebDev Arena**: `https://web.lmarena.ai/leaderboard/webdev`
- **ArtifactsBench**: `https://artifactsbenchmark.github.io/static/js/main.f0afaa17.js`
- **OmegaUse-OfficeVal**: `https://raw.githubusercontent.com/omegause-officeval/omegause-officeval.github.io/main/index.html`

---

## 4. Como Configurar `AA_API_KEY` (Opcional)

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
2. Caso possua uma chave da Data API v2 do Artificial Analysis, preencha:
   ```env
   AA_API_KEY=sua_chave_aqui
   ```
   > **Nota**: Mesmo sem `AA_API_KEY`, o adaptador do Artificial Analysis extrai deterministicamente mais de 3.000 pontuações e métricas de telemetria diretamente do payload estruturado da página pública oficial (`https://artificialanalysis.ai/leaderboards/models`).

---

## 5. Como Importar JSON ou CSV Manualmente

Para alimentar notas de avaliações internas ou benchmarks sem endpoint público estruturado (`bluefin`, `finsheet-bench`, `mm-browsecomp`, `ui-cube`, `slidebench`, `design2code`, `llm-accountants-lawyers-br`):

1. Acesse a aba **"5. Fontes Oficiais, Agendador & Importação Manual"** na interface web (ou envie `POST /api/import`).
2. Formato **JSON** suportado:
   ```json
   [
     {
       "benchmarkId": "llm-accountants-lawyers-br",
       "model": "Claude Fable 5.2 (Max)",
       "provider": "Anthropic",
       "effort": "max",
       "score": 91.4,
       "sourceUrl": "https://www.vals.ai/benchmarks/tax_eval_v2",
       "notes": "Caderno Contábil/Tributário BR (SPED, Simples Nacional e Reforma Tributária IBS/CBS)"
     }
   ]
   ```
3. Formato **CSV** suportado:
   ```csv
   benchmarkId,model,provider,effort,score,sourceUrl,notes
   bluefin,Claude Opus 5.5 (Max),Anthropic,max,84.5,https://spreadsheetbench.github.io/,Modelagem Excel 3-Statement
   ```

---

## 6. Como Executar Localmente e via Docker

### Localmente (Node.js 22+)
```bash
# Instalar dependências
npm install

# Executar suíte de testes automatizados (Vitest)
npm test

# Executar uma sincronização determinística única via CLI
npm run sync:once

# Gerar build de produção (Frontend Vite + Backend TypeScript)
npm run build

# Iniciar servidor unificado em http://localhost:3000
npm start
```

### Via Docker
```bash
docker build -t comparativo-llms .
docker run -p 3000:3000 --env-file .env.example comparativo-llms
```