import {
  AdapterSourceDefinition,
  BenchmarkDefinition,
  EffortLevel,
  UseCaseDefinition,
  WeightPreset,
} from './types.js';

export const EFFORT_LABELS: Record<EffortLevel, string> = {
  default: 'Padrão do benchmark',
  low: 'Baixo (low)',
  medium: 'Médio (medium)',
  high: 'Alto (high)',
  xhigh: 'Extra Alto (xhigh)',
  max: 'Máximo (max)',
  thinking: 'Modo Thinking (Raciocínio)',
  'non-thinking': 'Modo Non-Thinking (Padrão)',
};

export const USE_CASES: UseCaseDefinition[] = [
  {
    id: 'uc-1-legal-tax-search',
    number: 1,
    title: 'Busca profunda de leis tributárias/contábeis',
    shortTitle: '1. Leis Tributárias & Contábeis',
    description:
      'Pesquisa jurídica e normativa profunda com cruzamento de múltiplas restrições, leitura de PDFs/tabelas escaneadas e citação precisa sem alucinar normas revogadas.',
    practicalContext:
      'BrowseComp avalia persistência e busca multi-hop na web para achar fatos escondidos cruzando múltiplas restrições; Vals Legal Research Bench mede precisão normativa e citação sem alucinar legislação revogada; MM-BrowseComp testa leitura de PDFs e tabelas escaneadas.',
    brazilianCaveat:
      'ATENÇÃO CONTABILIDADE / TRIBUTÁRIO BRASILEIRO: Benchmarks internacionais como o Vals Legal Research avaliam majoritariamente jurisdição dos EUA (Common Law / IRC) e NÃO cobrem nuances críticas de SPED (ECD/ECF/EFD-Contribuições), Simples Nacional (LC 123/2006), substituição tributária do ICMS ou a Reforma Tributária Brasileira (EC 132/2023 e LC 214/2025 — IBS/CBS). Por isso, incluímos suporte explícito ao LLM Benchmark for Accountants and Lawyers (BR/EUA), com trava rígida contra alucinação de norma revogada.',
    primaryBenchmarkIds: [
      'browsecomp',
      'vals-legal-research',
      'mm-browsecomp',
      'llm-accountants-lawyers-br',
    ],
    substituteBenchmarkIds: [
      'aa-lcr',
      'simpleqa',
      'legalbench',
      'aa-intelligence-index',
    ],
  },
  {
    id: 'uc-2-financial-tax-analysis',
    number: 2,
    title: 'Análise financeira/tributária empresarial e insights',
    shortTitle: '2. Análise Financeira & Tributária',
    description:
      'Avaliação de entregas econômicas reais, auditoria analítica de demonstrativos (DRE, Balanço, DFC), agregações contábeis e cálculo de índices financeiros sem erros aritméticos.',
    practicalContext:
      'GDPval-AA v2.1 avalia entregas reais de trabalho econômico (análise financeira, contabilidade, relatórios decisórios); FinSheet-Bench testa raciocínio em múltiplos passos sobre demonstrativos, agregações e índices financeiros sem errar contas.',
    brazilianCaveat:
      'Para análises tributárias e contábeis no Brasil (Lucro Real vs. Lucro Presumido, créditos de PIS/COFINS, transição IBS/CBS e conciliações SPED), combine o desempenho em GDPval-AA v2.1 com o LLM Benchmark for Accountants and Lawyers (BR/EUA).',
    primaryBenchmarkIds: ['gdpval-aa', 'finsheet-bench'],
    substituteBenchmarkIds: [
      'aa-intelligence-index',
      'finqa',
      'financebench',
    ],
  },
  {
    id: 'uc-3-excel-spreadsheets',
    number: 3,
    title: 'Criação de planilhas Excel complexas',
    shortTitle: '3. Planilhas Excel Complexas',
    description:
      'Construção e edição real de arquivos .xlsx com fórmulas dinâmicas, múltiplas abas, modelagem financeira, depuração de fórmulas e formatação aderente a convenções contábeis.',
    practicalContext:
      'BlueFin e SpreadsheetBench 2 testam construção e edição real de arquivos .xlsx (fórmulas dinâmicas, modelagem financeira, formatação e aderência a convenções contábeis), não apenas leitura superficial de CSV.',
    primaryBenchmarkIds: ['bluefin', 'spreadsheetbench-2'],
    substituteBenchmarkIds: [
      'spreadsheetbench-v1',
      'aa-coding-math-index',
      'livecodebench',
    ],
  },
  {
    id: 'uc-4-automations-cli-api',
    number: 4,
    title: 'Automações em geral (estilo Hermes Agent / CLI / APIs)',
    shortTitle: '4. Automações (CLI / APIs / Agentes)',
    description:
      'Execução autônoma em terminal/shell, chamadas sequenciais confiáveis de APIs respeitando políticas de negócio (pass^k) e orquestração multi-ferramenta.',
    practicalContext:
      'Terminal-Bench 2.1 testa agentes ponta a ponta no terminal/shell (scripts, pipelines, admin); τ-bench mede confiabilidade (pass^k) em chamadas sequenciais de APIs e respeito a regras de negócio; GAIA avalia orquestração multi-ferramenta (busca + arquivos + Python).',
    primaryBenchmarkIds: ['terminal-bench-2-1', 'tau-bench', 'gaia'],
    substituteBenchmarkIds: [
      'tau2-bench-sub',
      'terminal-bench-legacy',
      'bfcl',
      'aa-agentic-index',
    ],
  },
  {
    id: 'uc-5-desktop-computer-use',
    number: 5,
    title: 'Computer Use 100% desktop (clicar em apps e preencher dados)',
    shortTitle: '5. Computer Use 100% Desktop',
    description:
      'Operação visual e por árvore de acessibilidade de sistemas desktop reais (Ubuntu/Windows) e preenchimento de formulários corporativos complexos (date pickers, tabelas paginadas, ERPs).',
    practicalContext:
      'OSWorld 2.0 é referência em desktop real (Ubuntu/Windows) via screenshot/árvore de acessibilidade; UI-CUBE foca em formulários corporativos complexos (date pickers, tabelas paginadas, filtros).',
    primaryBenchmarkIds: ['osworld-2', 'ui-cube'],
    substituteBenchmarkIds: ['screenspot-pro', 'osworld-v1', 'workarena'],
  },
  {
    id: 'uc-6-fullstack-db-apps',
    number: 6,
    title: 'Criação de apps com banco de dados',
    shortTitle: '6. Apps Web + Banco de Dados',
    description:
      'Engenharia de software multi-arquivo, arquitetura backend e persistência SQL/NoSQL, e geração funcional ponta a ponta de aplicações web interativas.',
    practicalContext:
      'WebDev Arena avalia criação do zero de apps web em sandbox; SWE-bench Pro V2 avalia engenharia de software multi-arquivo, backend e persistência; ArtifactsBench avalia fidelidade funcional de apps gerados.',
    primaryBenchmarkIds: ['swe-bench-pro-v2', 'webdev-arena', 'artifactsbench'],
    substituteBenchmarkIds: [
      'swe-bench-verified',
      'livecodebench',
      'aa-coding-index',
      'aider-polyglot',
    ],
  },
  {
    id: 'uc-7-office-presentations-layouts',
    number: 7,
    title: 'Apresentações PPTX, HTML e layouts Word/PDF (relatórios/orçamentos)',
    shortTitle: '7. PPTX, HTML & Pacote Office/PDF',
    description:
      'Geração de apresentações PowerPoint (.pptx) com fidelidade visual e OOXML editável, fluxos completos de documentos Office (DOCX/XLSX/PPTX/PDF) e conversão fiel de design em HTML/CSS.',
    practicalContext:
      'SlideBench avalia visual renderizado e editabilidade real OOXML de .pptx; OmegaUse-OfficeVal mede fluxos completos de pacote Office; Design2Code mede precisão de layout HTML/CSS.',
    primaryBenchmarkIds: ['slidebench', 'omegause-officeval', 'design2code'],
    substituteBenchmarkIds: [
      'mmmu',
      'websight-design2code',
      'aa-multimodal-index',
    ],
  },
];

export const BENCHMARKS: BenchmarkDefinition[] = [
  // ================= CASO 1 PRIMÁRIOS =================
  {
    id: 'browsecomp',
    name: 'BrowseComp',
    shortName: 'BrowseComp',
    useCaseIds: ['uc-1-legal-tax-search'],
    isSubstitute: false,
    officialUrl: 'https://github.com/steel-dev/leaderboard/blob/main/src/data/browsecomp.json',
    adapterSourceId: 'steel-leaderboard',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Persistência e busca multi-hop na web para localizar fatos complexos cruzando múltiplas restrições simultâneas.',
    practicalExplanation:
      'Mede a capacidade de o agente navegar profundamente em fontes primárias (diários oficiais, portais legislativos e jurisprudência) sem desistir na primeira busca superficial.',
  },
  {
    id: 'vals-legal-research',
    name: 'Vals Legal Research Bench',
    shortName: 'Vals Legal Research',
    useCaseIds: ['uc-1-legal-tax-search'],
    isSubstitute: false,
    officialUrl: 'https://www.vals.ai/benchmarks/legal_research',
    adapterSourceId: 'vals-legal-research',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Precisão normativa, recuperação de jurisprudência/estatutos e citação fundamentada sem alucinar dispositivos revogados.',
    practicalExplanation:
      'Avalia agentes em tarefas reais de pesquisa jurídica ponta a ponta com verificação estrita de citações (All-Pass %). Nota: focado em direito norte-americano; exige complemento BR para SPED/Reforma Tributária.',
    jurisdictionNote:
      'Baseado em legislação e jurisprudência dos EUA. Não cobre diretamente SPED, Simples Nacional ou Reforma Tributária BR (IBS/CBS).',
  },
  {
    id: 'mm-browsecomp',
    name: 'MM-BrowseComp',
    shortName: 'MM-BrowseComp',
    useCaseIds: ['uc-1-legal-tax-search'],
    isSubstitute: false,
    officialUrl: 'https://github.com/MMBrowseComp/MM-BrowseComp',
    adapterSourceId: 'mm-browsecomp',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Busca profunda multimodal envolvendo leitura de PDFs nativos/escaneados, tabelas em imagens e anexos normativos.',
    practicalExplanation:
      'Essencial para direito tributário e contabilidade, onde anexos de leis, tabelas de NCM/TIPI e certidões ou balanços são publicados em PDFs escaneados.',
  },
  {
    id: 'llm-accountants-lawyers-br',
    name: 'LLM Benchmark for Accountants and Lawyers (BR/EUA)',
    shortName: 'Accountants & Lawyers (BR/EUA)',
    useCaseIds: ['uc-1-legal-tax-search', 'uc-2-financial-tax-analysis'],
    isSubstitute: false,
    officialUrl: 'https://www.vals.ai/benchmarks/tax_eval_v2',
    adapterSourceId: 'llm-accountants-lawyers-br',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Peças técnico-jurídicas, conciliações contábeis/fiscais e aplicação de legislação tributária BR/EUA com trava rígida contra alucinação de norma revogada.',
    practicalExplanation:
      'Avalia cenários práticos de contabilidade e direito tributário (incluindo suporte a avaliação de regras fiscais, conciliação e penalização severa caso o modelo cite instrução normativa ou lei revogada).',
    jurisdictionNote:
      'Destaque Contábil/Tributário Brasileiro: contempla validação contra alucinação de legislação revogada (essencial para Simples Nacional, SPED, PIS/COFINS e Reforma Tributária BR).',
    isBrazilianSpecific: true,
  },

  // ================= CASO 2 PRIMÁRIOS =================
  {
    id: 'gdpval-aa',
    name: 'GDPval-AA v2.1',
    shortName: 'GDPval-AA v2.1',
    useCaseIds: ['uc-2-financial-tax-analysis'],
    isSubstitute: false,
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: 'ELO / Norm',
    minScore: 800,
    maxScore: 1800,
    higherIsBetter: true,
    whatItTests:
      'Entregas reais de trabalho econômico de alto valor (análise financeira, contabilidade corporativa, pareceres e relatórios executivos decisórios).',
    practicalExplanation:
      'Publicado pelo Artificial Analysis (score gdpval-aa-normalized em escala ELO ~1000-1700, normalizado deterministicamente para 0-100), mede qualidade real de trabalho de analistas financeiros e consultores.',
  },
  {
    id: 'finsheet-bench',
    name: 'FinSheet-Bench',
    shortName: 'FinSheet-Bench',
    useCaseIds: ['uc-2-financial-tax-analysis'],
    isSubstitute: false,
    officialUrl: 'https://www.vals.ai/benchmarks/corp_fin_v2',
    adapterSourceId: 'finsheet-bench',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Raciocínio quantitativo em múltiplos passos sobre demonstrativos contábeis (DRE, Balanço Patrimonial, DFC), agregações e índices financeiros sem errar contas.',
    practicalExplanation:
      'Verifica se o modelo calcula corretamente EBITDA, margem líquida, capital de giro, alavancagem e variações horizontais/verticais a partir de tabelas financeiras complexas.',
  },

  // ================= CASO 3 PRIMÁRIOS =================
  {
    id: 'bluefin',
    name: 'BlueFin',
    shortName: 'BlueFin',
    useCaseIds: ['uc-3-excel-spreadsheets'],
    isSubstitute: false,
    officialUrl: 'https://spreadsheetbench.github.io/',
    adapterSourceId: 'bluefin',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Modelagem financeira institucional em Excel (.xlsx), incluindo projeções de 3 demonstrativos integrados, valuation DCF e convenções de bancos de investimento.',
    practicalExplanation:
      'Mede a criação de pastas de trabalho .xlsx profissionais com fórmulas auditáveis, sem hardcode de valores calculados.',
  },
  {
    id: 'spreadsheetbench-2',
    name: 'SpreadsheetBench 2',
    shortName: 'SpreadsheetBench 2',
    useCaseIds: ['uc-3-excel-spreadsheets'],
    isSubstitute: false,
    officialUrl: 'https://spreadsheetbench.github.io/',
    adapterSourceId: 'spreadsheetbench',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Construção, depuração e edição ponta a ponta de arquivos .xlsx corporativos (Template, Financial Model, Debugging e Visualization) recalculados via LibreOffice.',
    practicalExplanation:
      'Avalia agentes manipulando planilhas reais multi-aba e verificando se as fórmulas dinâmicas produzem os valores exatos nas células após recálculo.',
  },

  // ================= CASO 4 PRIMÁRIOS =================
  {
    id: 'terminal-bench-2-1',
    name: 'Terminal-Bench 2.1',
    shortName: 'Terminal-Bench 2.1',
    useCaseIds: ['uc-4-automations-cli-api'],
    isSubstitute: false,
    officialUrl: 'https://www.tbench.ai/',
    adapterSourceId: 'terminal-bench-2-1',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Agentes autônomos ponta a ponta no terminal/shell Linux (criação de scripts, compilação, diagnóstico de serviços, pipelines de dados e administração de sistemas).',
    practicalExplanation:
      'Mede a taxa de resolução real em containers isolados para agentes estilo Hermes Agent, Claude Code, Antigravity CLI e Codex.',
  },
  {
    id: 'tau-bench',
    name: 'τ-bench (tau-bench / tau2-bench)',
    shortName: 'τ-bench / τ²-bench',
    useCaseIds: ['uc-4-automations-cli-api'],
    isSubstitute: false,
    officialUrl: 'https://taubench.com/',
    adapterSourceId: 'tau2-bench',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Confiabilidade (pass^k) em chamadas sequenciais de APIs/ferramentas em múltiplos turnos interagindo com usuários e respeitando regras de negócio estritas.',
    practicalExplanation:
      'Avalia se o agente mantém consistência ao acionar bancos de dados e APIs corporativas (telecom, varejo, companhias aéreas, banking) sem violar políticas operacionais.',
  },
  {
    id: 'gaia',
    name: 'GAIA',
    shortName: 'GAIA',
    useCaseIds: ['uc-4-automations-cli-api'],
    isSubstitute: false,
    officialUrl: 'https://huggingface.co/spaces/gaia-benchmark/leaderboard',
    adapterSourceId: 'gaia-leaderboard',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Orquestração multi-ferramenta para assistentes gerais (busca web + leitura de arquivos diversos + execução de código Python + raciocínio multi-etapa).',
    practicalExplanation:
      'Questões com resposta única e verificável que exigem encadear múltiplas ferramentas externas com precisão.',
  },

  // ================= CASO 5 PRIMÁRIOS =================
  {
    id: 'osworld-2',
    name: 'OSWorld 2.0',
    shortName: 'OSWorld 2.0',
    useCaseIds: ['uc-5-desktop-computer-use'],
    isSubstitute: false,
    officialUrl: 'https://osworld-v2.xlang.ai/',
    adapterSourceId: 'osworld-2',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Execução de tarefas reais de longo horizonte em ambiente desktop completo (Ubuntu/Windows) via screenshots, mouse/teclado e árvore de acessibilidade.',
    practicalExplanation:
      'Referência mundial para agentes GUI que precisam clicar em aplicativos nativos, cruzar dados entre e-mail/planilha/navegador e salvar arquivos no sistema operacional.',
  },
  {
    id: 'ui-cube',
    name: 'UI-CUBE (UiPath Enterprise Benchmark)',
    shortName: 'UI-CUBE',
    useCaseIds: ['uc-5-desktop-computer-use'],
    isSubstitute: false,
    officialUrl: 'https://github.com/UiPath/uipath_enterprise_benchmark',
    adapterSourceId: 'ui-cube',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Automação de interfaces corporativas densas: preenchimento de formulários empresariais, date pickers, modais, tabelas paginadas e filtros em ERPs/CRMs.',
    practicalExplanation:
      'Focado em RPA/Computer Use determinístico sobre telas empresariais onde um único clique fora de ordem ou campo mal formatado invalida o lançamento.',
  },

  // ================= CASO 6 PRIMÁRIOS =================
  {
    id: 'swe-bench-pro-v2',
    name: 'SWE-bench Pro V2',
    shortName: 'SWE-bench Pro V2',
    useCaseIds: ['uc-6-fullstack-db-apps'],
    isSubstitute: false,
    officialUrl: 'https://scale.com/leaderboard/swe_bench_pro_public_v2',
    adapterSourceId: 'scale-swebench-pro',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Engenharia de software multi-arquivo de longo horizonte em repositórios complexos (backend, migrações, persistência e lógica de negócios).',
    practicalExplanation:
      'Mede a taxa de resolução verificada por suítes de testes automatizados em tarefas reais de engenharia de software corporativa.',
  },
  {
    id: 'webdev-arena',
    name: 'WebDev Arena (LMArena WebDev)',
    shortName: 'WebDev Arena',
    useCaseIds: ['uc-6-fullstack-db-apps'],
    isSubstitute: false,
    officialUrl: 'https://web.lmarena.ai/leaderboard/webdev',
    adapterSourceId: 'lmarena-webdev',
    unit: 'Score (0-100)',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Criação do zero de aplicações web interativas completas em sandbox, avaliadas em batalhas cegas lado a lado por desenvolvedores.',
    practicalExplanation:
      'Reflete a qualidade prática percebida na construção de UI, estado, rotas e funcionalidades completas de aplicações web.',
  },
  {
    id: 'artifactsbench',
    name: 'ArtifactsBench',
    shortName: 'ArtifactsBench',
    useCaseIds: ['uc-6-fullstack-db-apps'],
    isSubstitute: false,
    officialUrl: 'https://artifactsbenchmark.github.io/',
    adapterSourceId: 'artifactsbench',
    unit: 'Pts',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Fidelidade funcional e visual-interativa de aplicações e artefatos web gerados (renderização real em browser headless + inspeção funcional).',
    practicalExplanation:
      'Testa se o código gerado realmente abre, renderiza sem quebrar layout e responde às interações do usuário.',
  },

  // ================= CASO 7 PRIMÁRIOS =================
  {
    id: 'slidebench',
    name: 'SlideBench',
    shortName: 'SlideBench',
    useCaseIds: ['uc-7-office-presentations-layouts'],
    isSubstitute: false,
    officialUrl: 'https://github.com/BL4Z23/SlideBench',
    adapterSourceId: 'slidebench',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Qualidade visual renderizada e editabilidade real OOXML na geração de apresentações PowerPoint (.pptx).',
    practicalExplanation:
      'Avalia se os slides gerados possuem hierarquia visual limpa, sem sobreposição de caixas de texto e com objetos nativos editáveis no PowerPoint.',
  },
  {
    id: 'omegause-officeval',
    name: 'OmegaUse-OfficeVal',
    shortName: 'OmegaUse-OfficeVal',
    useCaseIds: ['uc-7-office-presentations-layouts'],
    isSubstitute: false,
    officialUrl: 'https://omegause-officeval.github.io/',
    adapterSourceId: 'omegause-officeval',
    unit: 'Score (0-30)',
    minScore: 0,
    maxScore: 30,
    higherIsBetter: true,
    whatItTests:
      'Fluxos completos de trabalho em pacote Office (DOCX, PPTX, XLSX e PDF) com fundamentação econômica, cruzando múltiplos arquivos de entrada e saída.',
    practicalExplanation:
      'Avalia a entrega de relatórios executivos, apresentações e orçamentos complexos (referência humana: 27.79 pts; normalizado para escala 0-100).',
  },
  {
    id: 'design2code',
    name: 'Design2Code',
    shortName: 'Design2Code',
    useCaseIds: ['uc-7-office-presentations-layouts'],
    isSubstitute: false,
    officialUrl: 'https://salt-nlp.github.io/Design2Code/',
    adapterSourceId: 'design2code',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Fidelidade estrutural, tipográfica, de cores e posicionamento na conversão de layouts visuais para HTML/CSS responsivo.',
    practicalExplanation:
      'Crucial para geração automatizada de relatórios em HTML/PDF, propostas comerciais e dashboards executivos.',
  },

  // =========================================================================
  // BENCHMARKS SUBSTITUTOS (ARTIFICIAL ANALYSIS & EQUIVALENTES POR CASO DE USO)
  // =========================================================================
  {
    id: 'aa-intelligence-index',
    name: 'Artificial Analysis Intelligence Index',
    shortName: 'AA Intelligence Index',
    useCaseIds: ['uc-1-legal-tax-search', 'uc-2-financial-tax-analysis'],
    isSubstitute: true,
    substituteForIds: ['browsecomp', 'vals-legal-research', 'gdpval-aa', 'finsheet-bench'],
    substituteEquivalenceExplanation:
      'Índice composto oficial do Artificial Analysis combinando raciocínio complexo, precisão factual, contexto longo e resolução de problemas analíticos.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: 'Index (0-100)',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Capacidade analítica geral consolidada pelo Artificial Analysis em múltiplas avaliações de fronteira.',
    practicalExplanation:
      'Atua como fallback universal de alta cobertura para análise jurídica, tributária e financeira quando um modelo recém-lançado ainda não possui avaliação em benchmarks setoriais.',
  },
  {
    id: 'aa-lcr',
    name: 'AA-LCR (Artificial Analysis Long Context Reasoning)',
    shortName: 'AA-LCR (Long Context)',
    useCaseIds: ['uc-1-legal-tax-search'],
    isSubstitute: true,
    substituteForIds: ['browsecomp', 'vals-legal-research', 'mm-browsecomp'],
    substituteEquivalenceExplanation:
      'Mede raciocínio multi-hop sobre documentos extensos (leis, contratos e regulamentos longos), substituindo diretamente a etapa de leitura profunda de legislação.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Raciocínio preciso sobre janelas de contexto longas sem perda de informação no meio do documento (needle-in-a-haystack + síntese lógica).',
    practicalExplanation:
      'Excelente substituto para pesquisa tributária em textos longos como o Regulamento do Imposto de Renda (RIR), RICMS ou manuais do SPED.',
  },
  {
    id: 'simpleqa',
    name: 'SimpleQA / AA Omniscience Factuality',
    shortName: 'SimpleQA / Omniscience',
    useCaseIds: ['uc-1-legal-tax-search'],
    isSubstitute: true,
    substituteForIds: ['browsecomp', 'llm-accountants-lawyers-br'],
    substituteEquivalenceExplanation:
      'Avalia precisão factual estrita e resistência à alucinação (calibration / non-hallucination), essencial para evitar citação de leis inexistentes.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Capacidade de responder fatos verificáveis com exatidão e abster-se quando não tem certeza (não-alucinação).',
    practicalExplanation:
      'Atua como substituto direto para medir o risco de alucinação normativa em consultas jurídicas e contábeis.',
  },
  {
    id: 'legalbench',
    name: 'LegalBench (Vals.ai)',
    shortName: 'LegalBench',
    useCaseIds: ['uc-1-legal-tax-search'],
    isSubstitute: true,
    substituteForIds: ['vals-legal-research', 'llm-accountants-lawyers-br'],
    substituteEquivalenceExplanation:
      'Avalia raciocínio jurídico estruturado (identificação de regras, interpretação contratual e aplicação de normas a fatos).',
    officialUrl: 'https://www.vals.ai/benchmarks/legal_bench',
    adapterSourceId: 'vals-legal-bench',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      '162 tarefas de raciocínio jurídico colaborativamente construídas por juristas (Issue, Rule, Application, Conclusion).',
    practicalExplanation:
      'Substituto direto para o Vals Legal Research Bench com ampla cobertura de modelos comerciais e open-weights.',
  },
  {
    id: 'finqa',
    name: 'FinQA / Vals Tax & Corporate Finance Eval',
    shortName: 'FinQA / TaxEval',
    useCaseIds: ['uc-2-financial-tax-analysis'],
    isSubstitute: true,
    substituteForIds: ['finsheet-bench', 'llm-accountants-lawyers-br'],
    substituteEquivalenceExplanation:
      'Mede cálculos numéricos e interpretação de relatórios financeiros e apurações fiscais passo a passo.',
    officialUrl: 'https://www.vals.ai/benchmarks/finance_index',
    adapterSourceId: 'vals-finance-index',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Resolução de perguntas financeiras e tributárias exigindo leitura combinada de texto de notas explicativas e tabelas contábeis.',
    practicalExplanation:
      'Substituto direto para o FinSheet-Bench na validação de cálculos sobre demonstrativos financeiros.',
  },
  {
    id: 'financebench',
    name: 'FinanceBench / Vals Finance Index',
    shortName: 'FinanceBench',
    useCaseIds: ['uc-2-financial-tax-analysis'],
    isSubstitute: true,
    substituteForIds: ['gdpval-aa', 'finsheet-bench'],
    substituteEquivalenceExplanation:
      'Avalia análise financeira corporativa sobre documentos reais (10-K, 10-Q, balanços e relatórios de resultados).',
    officialUrl: 'https://www.vals.ai/benchmarks/finance_index',
    adapterSourceId: 'vals-finance-index',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Extração e cálculo de indicadores financeiros reais a partir de demonstrações financeiras auditadas.',
    practicalExplanation:
      'Substituto de alta fidelidade para GDPval-AA e FinSheet-Bench em análise financeira empresarial.',
  },
  {
    id: 'spreadsheetbench-v1',
    name: 'SpreadsheetBench v1 (Full 912)',
    shortName: 'SpreadsheetBench v1',
    useCaseIds: ['uc-3-excel-spreadsheets'],
    isSubstitute: true,
    substituteForIds: ['spreadsheetbench-2', 'bluefin'],
    substituteEquivalenceExplanation:
      'Primeira geração oficial do SpreadsheetBench (912 tarefas reais de manipulação de planilhas Excel via Python/fórmulas).',
    officialUrl: 'https://spreadsheetbench.github.io/',
    adapterSourceId: 'spreadsheetbench',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Manipulação programática de arquivos Excel reais coletados de fóruns técnicos de Excel.',
    practicalExplanation:
      'Substituto direto para o SpreadsheetBench 2 e BlueFin quando um modelo foi avaliado apenas na suíte v1.',
  },
  {
    id: 'aa-coding-math-index',
    name: 'Artificial Analysis Coding + Math Index',
    shortName: 'AA Coding+Math Index',
    useCaseIds: ['uc-3-excel-spreadsheets'],
    isSubstitute: true,
    substituteForIds: ['bluefin', 'spreadsheetbench-2'],
    substituteEquivalenceExplanation:
      'Combina determinísticamente os índices de Codificação e Matemática do Artificial Analysis, altamente correlacionados com geração de fórmulas Excel/VBA/openpyxl e modelagem quantitativa.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: 'Index (0-100)',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Precisão algorítmica e matemática avançada para síntese de scripts de geração de planilhas e fórmulas aninhadas.',
    practicalExplanation:
      'Garante comparação justa da capacidade de geração de planilhas para qualquer modelo presente no Artificial Analysis.',
  },
  {
    id: 'livecodebench',
    name: 'LiveCodeBench',
    shortName: 'LiveCodeBench',
    useCaseIds: ['uc-3-excel-spreadsheets', 'uc-6-fullstack-db-apps'],
    isSubstitute: true,
    substituteForIds: ['bluefin', 'spreadsheetbench-2', 'swe-bench-pro-v2', 'artifactsbench'],
    substituteEquivalenceExplanation:
      'Avalia geração de código livre de contaminação, execução e autorreparo de bugs lógicos.',
    officialUrl: 'https://www.vals.ai/benchmarks/lcb',
    adapterSourceId: 'vals-lcb',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Problemas de programação competitiva e engenharia de código coletados continuamente para evitar memorização no treino.',
    practicalExplanation:
      'Substituto confiável tanto para lógica de scripts de planilhas (Caso 3) quanto para desenvolvimento de aplicações (Caso 6).',
  },
  {
    id: 'tau2-bench-sub',
    name: 'τ²-bench (Artificial Analysis / Sierra Feed)',
    shortName: 'τ²-bench (AA)',
    useCaseIds: ['uc-4-automations-cli-api'],
    isSubstitute: true,
    substituteForIds: ['tau-bench', 'gaia'],
    substituteEquivalenceExplanation:
      'Avaliação padronizada do τ²-bench executada pelo Artificial Analysis sobre centenas de modelos e níveis de esforço.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Execução confiável de ferramentas e políticas de atendimento/automação em múltiplos turnos.',
    practicalExplanation:
      'Complementa o feed oficial da Sierra cobrindo todas as variantes de esforço monitoradas pelo Artificial Analysis.',
  },
  {
    id: 'terminal-bench-legacy',
    name: 'Terminal-Bench Hard / 2.0',
    shortName: 'Terminal-Bench Hard',
    useCaseIds: ['uc-4-automations-cli-api'],
    isSubstitute: true,
    substituteForIds: ['terminal-bench-2-1'],
    substituteEquivalenceExplanation:
      'Versão Terminal-Bench Hard / 2.0 avaliada continuamente pelo Artificial Analysis e Vals.ai.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Subconjunto de alta dificuldade de automação em terminal Linux sem assistência humana.',
    practicalExplanation:
      'Substituto direto para o Terminal-Bench 2.1 quando um modelo ainda não possui submissão no repositório Harbor 2.1.',
  },
  {
    id: 'bfcl',
    name: 'BFCL / IFBench (Function Calling & Instruction Following)',
    shortName: 'BFCL / IFBench',
    useCaseIds: ['uc-4-automations-cli-api'],
    isSubstitute: true,
    substituteForIds: ['tau-bench', 'gaia'],
    substituteEquivalenceExplanation:
      'Avalia precisão sintática de chamadas de função (JSON schema / tool use) e obediência estrita a restrições de formatação.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Invocação determinística de ferramentas/APIs e cumprimento rigoroso de instruções de saída.',
    practicalExplanation:
      'Substituto fundamental para automações de APIs e agentes estilo Hermes Agent.',
  },
  {
    id: 'aa-agentic-index',
    name: 'Artificial Analysis Agentic / Tool Index',
    shortName: 'AA Agentic Index',
    useCaseIds: ['uc-4-automations-cli-api'],
    isSubstitute: true,
    substituteForIds: ['terminal-bench-2-1', 'tau-bench', 'gaia'],
    substituteEquivalenceExplanation:
      'Índice composto determinístico do Artificial Analysis agregando τ²-bench, Terminal-Bench, AutomationBench-AA e IFBench.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: 'Index (0-100)',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Capacidade geral do modelo atuar como agente autônomo invocando ferramentas, shell e APIs.',
    practicalExplanation:
      'Fallback consolidado para o Caso de Uso 4 (Automações em geral).',
  },
  {
    id: 'screenspot-pro',
    name: 'ScreenSpot-Pro / Vals CUA Bench',
    shortName: 'ScreenSpot-Pro / CUA',
    useCaseIds: ['uc-5-desktop-computer-use'],
    isSubstitute: true,
    substituteForIds: ['osworld-2', 'ui-cube'],
    substituteEquivalenceExplanation:
      'Avalia localização visual de elementos de interface (grounding de cliques em alta resolução) e tarefas de Computer Use Agent (CUA).',
    officialUrl: 'https://www.vals.ai/benchmarks/cua_bench',
    adapterSourceId: 'vals-cua-bench',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Precisão de clique em ícones, menus, campos de formulário e botões em interfaces desktop de alta resolução.',
    practicalExplanation:
      'Substituto direto para OSWorld 2.0 e UI-CUBE na avaliação de agentes de desktop.',
  },
  {
    id: 'osworld-v1',
    name: 'OSWorld v1 (Verified)',
    shortName: 'OSWorld v1',
    useCaseIds: ['uc-5-desktop-computer-use'],
    isSubstitute: true,
    substituteForIds: ['osworld-2', 'ui-cube'],
    substituteEquivalenceExplanation:
      'Primeira versão verificada do OSWorld (361 tarefas em desktop Ubuntu/Windows).',
    officialUrl: 'https://github.com/steel-dev/leaderboard/blob/main/src/data/osworld.json',
    adapterSourceId: 'steel-leaderboard',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Automação de tarefas desktop multi-aplicativo na suíte clássica OSWorld Verified.',
    practicalExplanation:
      'Substituto imediato quando um modelo possui score publicado no OSWorld v1 mas ainda não no OSWorld 2.0.',
  },
  {
    id: 'workarena',
    name: 'WorkArena / WebArena Enterprise',
    shortName: 'WorkArena / WebArena',
    useCaseIds: ['uc-5-desktop-computer-use'],
    isSubstitute: true,
    substituteForIds: ['ui-cube', 'osworld-2'],
    substituteEquivalenceExplanation:
      'Mede navegação e preenchimento de sistemas corporativos (ServiceNow, ERPs, portais administrativos e formulários complexos).',
    officialUrl: 'https://github.com/steel-dev/leaderboard/blob/main/src/data/webarena.json',
    adapterSourceId: 'steel-leaderboard',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Interação ponta a ponta com sistemas web corporativos reais auto-hospedados.',
    practicalExplanation:
      'Substituto ideal para o UI-CUBE em fluxos de preenchimento de dados empresariais.',
  },
  {
    id: 'swe-bench-verified',
    name: 'SWE-bench Verified',
    shortName: 'SWE-bench Verified',
    useCaseIds: ['uc-6-fullstack-db-apps'],
    isSubstitute: true,
    substituteForIds: ['swe-bench-pro-v2'],
    substituteEquivalenceExplanation:
      'Subconjunto de 500 issues reais do GitHub validado por engenheiros humanos, amplamente adotado pela indústria.',
    officialUrl: 'https://www.vals.ai/benchmarks/swebench',
    adapterSourceId: 'vals-swebench',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Resolução de bugs e implementação de features em repositórios reais com validação por testes unitários.',
    practicalExplanation:
      'Substituto direto para o SWE-bench Pro V2 com altíssima cobertura de modelos.',
  },
  {
    id: 'aa-coding-index',
    name: 'Artificial Analysis Coding Index',
    shortName: 'AA Coding Index',
    useCaseIds: ['uc-6-fullstack-db-apps'],
    isSubstitute: true,
    substituteForIds: ['swe-bench-pro-v2', 'webdev-arena', 'artifactsbench'],
    substituteEquivalenceExplanation:
      'Índice de codificação do Artificial Analysis combinando LiveCodeBench, SciCode, FrontierCode e Terminal-Bench.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: 'Index (0-100)',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Capacidade geral de engenharia de software, algoritmos e arquitetura de código.',
    practicalExplanation:
      'Substituto de cobertura universal para criação de aplicações full-stack e banco de dados.',
  },
  {
    id: 'aider-polyglot',
    name: 'Aider Polyglot Benchmark',
    shortName: 'Aider Polyglot',
    useCaseIds: ['uc-6-fullstack-db-apps'],
    isSubstitute: true,
    substituteForIds: ['swe-bench-pro-v2', 'webdev-arena'],
    substituteEquivalenceExplanation:
      'Avalia edição precisa de código multi-linguagem (C++, Go, Java, JS/TS, Python, Rust) sem quebrar diffs.',
    officialUrl: 'https://aider.chat/docs/leaderboards/',
    adapterSourceId: 'steel-leaderboard',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      '225 exercícios complexos em 6 linguagens de programação medindo qualidade de código e aplicação limpa de patches.',
    practicalExplanation:
      'Excelente indicador da capacidade do modelo de editar projetos full-stack reais.',
  },
  {
    id: 'mmmu',
    name: 'MMMU / MMMU-Pro (Multimodal Understanding)',
    shortName: 'MMMU / MMMU-Pro',
    useCaseIds: ['uc-7-office-presentations-layouts'],
    isSubstitute: true,
    substituteForIds: ['slidebench', 'design2code', 'omegause-officeval'],
    substituteEquivalenceExplanation:
      'Avalia compreensão visual e diagramática de slides, gráficos financeiros, layouts e documentos técnicos.',
    officialUrl: 'https://www.vals.ai/benchmarks/mmmu',
    adapterSourceId: 'vals-mmmu',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Compreensão multimodal avançada de nível universitário/profissional sobre imagens, diagramas, tabelas e layouts.',
    practicalExplanation:
      'Substituto direto para avaliar percepção visual necessária em PPTX, PDF e Design2Code.',
  },
  {
    id: 'websight-design2code',
    name: 'AA Briefcase / Document & Visual Code Eval',
    shortName: 'AA Briefcase / Visual Layout',
    useCaseIds: ['uc-7-office-presentations-layouts'],
    isSubstitute: true,
    substituteForIds: ['design2code', 'slidebench', 'omegause-officeval'],
    substituteEquivalenceExplanation:
      'Avalia geração de documentos executivos, artefatos visuais e processamento estruturado de PDFs (aa-briefcase / gdp-pdf) no Artificial Analysis.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: 'Score (0-100)',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Produção de entregáveis visuais e corporativos de escritório (apresentações, relatórios e layouts estruturados).',
    practicalExplanation:
      'Substituto direto para Design2Code, SlideBench e OmegaUse-OfficeVal.',
  },
  {
    id: 'aa-multimodal-index',
    name: 'Artificial Analysis Coding/Multimodal Index',
    shortName: 'AA Multimodal/Office Index',
    useCaseIds: ['uc-7-office-presentations-layouts'],
    isSubstitute: true,
    substituteForIds: ['slidebench', 'omegause-officeval', 'design2code'],
    substituteEquivalenceExplanation:
      'Combina determinísticamente métricas visuais/multimodais (MMMU-Pro, GDP-PDF, AA-Briefcase) e geração de código de interface.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: 'Index (0-100)',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests:
      'Capacidade multimodal e de geração de código visual para apresentações, HTML e documentos formatados.',
    practicalExplanation:
      'Garante cobertura substituta transparente no Caso 7 para modelos avaliados pelo Artificial Analysis.',
  },
  // Índices complementares do Artificial Analysis listados na Seção 5
  {
    id: 'aa-math-index',
    name: 'Artificial Analysis Math Index',
    shortName: 'AA Math Index',
    useCaseIds: ['uc-2-financial-tax-analysis', 'uc-3-excel-spreadsheets'],
    isSubstitute: true,
    substituteForIds: ['finsheet-bench', 'bluefin'],
    substituteEquivalenceExplanation:
      'Índice de raciocínio matemático exato do Artificial Analysis (AIME, CritPt, HLE), base para precisão em cálculos financeiros e planilhas.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: 'Index (0-100)',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests: 'Raciocínio matemático formal e resolução de problemas quantitativos multi-etapa.',
    practicalExplanation: 'Substituto complementar para tarefas que exigem zero erro em fórmulas e cálculos.',
  },
  {
    id: 'hle',
    name: "HLE (Humanity's Last Exam)",
    shortName: 'HLE',
    useCaseIds: ['uc-1-legal-tax-search', 'uc-2-financial-tax-analysis'],
    isSubstitute: true,
    substituteForIds: ['browsecomp', 'gdpval-aa'],
    substituteEquivalenceExplanation:
      'Avalia raciocínio especializado de fronteira em questões de nível pós-graduação/especialista.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests: "Exame multidisciplinar de altíssima complexidade (Humanity's Last Exam).",
    practicalExplanation: 'Diferencia modelos de ponta em problemas analíticos e normativos extremos.',
  },
  {
    id: 'gpqa-diamond',
    name: 'GPQA Diamond',
    shortName: 'GPQA Diamond',
    useCaseIds: ['uc-1-legal-tax-search', 'uc-2-financial-tax-analysis'],
    isSubstitute: true,
    substituteForIds: ['vals-legal-research', 'finsheet-bench'],
    substituteEquivalenceExplanation:
      'Mede raciocínio analítico profundo resistente a busca superficial ("Google-proof Q&A").',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests: 'Questões complexas validadas por especialistas de doutorado.',
    practicalExplanation: 'Indicador sólido de densidade lógica e raciocínio dedutivo.',
  },
  {
    id: 'scicode',
    name: 'SciCode',
    shortName: 'SciCode',
    useCaseIds: ['uc-3-excel-spreadsheets', 'uc-6-fullstack-db-apps'],
    isSubstitute: true,
    substituteForIds: ['spreadsheetbench-2', 'swe-bench-pro-v2'],
    substituteEquivalenceExplanation:
      'Avalia síntese de código científico, numérico e analítico estruturado em subproblemas.',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    adapterSourceId: 'artificial-analysis',
    unit: '%',
    minScore: 0,
    maxScore: 100,
    higherIsBetter: true,
    whatItTests: 'Resolução de problemas computacionais e numéricos em múltiplos passos.',
    practicalExplanation: 'Substituto técnico para modelagem quantitativa e código analítico.',
  },
];

export const ADAPTER_SOURCES: AdapterSourceDefinition[] = [
  {
    id: 'artificial-analysis',
    name: 'Artificial Analysis (Leaderboards & Data API v2)',
    officialUrl: 'https://artificialanalysis.ai/leaderboards/models',
    endpointUrl: 'https://artificialanalysis.ai/leaderboards/models',
    description:
      'Extrai GDPval-AA v2.1, AA Intelligence/Coding/Math/Agentic/Multimodal Index, AA-LCR, τ²-bench, Terminal-Bench, HLE, GPQA Diamond, LiveCodeBench, IFBench, SciCode, velocidade (tokens/s), TTFT e preços ($/1M tokens). Suporta AA_API_KEY opcional para Data API v2.',
    benchmarkIds: [
      'gdpval-aa',
      'aa-intelligence-index',
      'aa-lcr',
      'simpleqa',
      'aa-coding-math-index',
      'tau2-bench-sub',
      'terminal-bench-legacy',
      'bfcl',
      'aa-agentic-index',
      'aa-coding-index',
      'websight-design2code',
      'aa-multimodal-index',
      'aa-math-index',
      'hle',
      'gpqa-diamond',
      'scicode',
    ],
    supportsManualImport: true,
  },
  {
    id: 'tau2-bench',
    name: 'Sierra τ-bench / τ²-bench (GitHub + taubench.com)',
    officialUrl: 'https://taubench.com/',
    endpointUrl:
      'https://api.github.com/repos/sierra-research/tau2-bench/contents/web/leaderboard/public/submissions',
    description:
      'Coleta submissões oficiais verificadas do repositório sierra-research/tau2-bench (airline, retail, telecom, banking_knowledge) e metadados de esforço (reasoning_effort).',
    benchmarkIds: ['tau-bench'],
    supportsManualImport: true,
  },
  {
    id: 'terminal-bench-2-1',
    name: 'Terminal-Bench 2.1 (tbench.ai + Harbor GitHub + Vals)',
    officialUrl: 'https://www.tbench.ai/',
    endpointUrl: 'https://www.tbench.ai/',
    description:
      'Coleta o leaderboard oficial do Terminal-Bench 2.1 em tbench.ai, submissões do GitHub harbor-framework/terminal-bench-2-1 e execuções independentes do Vals.ai.',
    benchmarkIds: ['terminal-bench-2-1'],
    supportsManualImport: true,
  },
  {
    id: 'gaia-leaderboard',
    name: 'GAIA Benchmark (Hugging Face Space + Steel Feed)',
    officialUrl: 'https://huggingface.co/spaces/gaia-benchmark/leaderboard',
    endpointUrl: 'https://huggingface.co/api/spaces/gaia-benchmark/leaderboard',
    description:
      'Verifica o Space oficial gaia-benchmark/leaderboard no Hugging Face e sincroniza os resultados verificados do GAIA.',
    benchmarkIds: ['gaia'],
    supportsManualImport: true,
  },
  {
    id: 'osworld-2',
    name: 'OSWorld 2.0 (xlang-ai/OSWorld-V2 + osworld-v2.xlang.ai + Steel)',
    officialUrl: 'https://osworld-v2.xlang.ai/',
    endpointUrl: 'https://raw.githubusercontent.com/steel-dev/leaderboard/main/src/data/osworld2.json',
    description:
      'Coleta resultados oficiais do OSWorld 2.0 (xlang-ai/OSWorld-V2 e steel-dev/leaderboard).',
    benchmarkIds: ['osworld-2'],
    supportsManualImport: true,
  },
  {
    id: 'steel-leaderboard',
    name: 'Steel Open Agent Leaderboard (BrowseComp, OSWorld v1, Aider, WebArena)',
    officialUrl: 'https://github.com/steel-dev/leaderboard',
    endpointUrl: 'https://api.github.com/repos/steel-dev/leaderboard/contents/src/data',
    description:
      'Sincroniza JSONs estruturados de BrowseComp (104 entradas), OSWorld v1, Aider Polyglot e WorkArena/WebArena.',
    benchmarkIds: ['browsecomp', 'osworld-v1', 'aider-polyglot', 'workarena'],
    supportsManualImport: true,
  },
  {
    id: 'vals-legal-research',
    name: 'Vals.ai — Legal Research Bench',
    officialUrl: 'https://www.vals.ai/benchmarks/legal_research',
    endpointUrl: 'https://www.vals.ai/benchmarks/legal_research',
    description:
      'Extrai a tabela oficial de 100 modelos avaliados no Vals Legal Research Bench (All-Pass %, custo e duração por teste).',
    benchmarkIds: ['vals-legal-research'],
    supportsManualImport: true,
  },
  {
    id: 'vals-legal-bench',
    name: 'Vals.ai — LegalBench',
    officialUrl: 'https://www.vals.ai/benchmarks/legal_bench',
    endpointUrl: 'https://www.vals.ai/benchmarks/legal_bench',
    description: 'Extrai a tabela oficial do LegalBench no Vals.ai (substituto para Caso 1).',
    benchmarkIds: ['legalbench'],
    supportsManualImport: true,
  },
  {
    id: 'vals-finance-index',
    name: 'Vals.ai — Finance Index & Corporate Finance / Tax Eval',
    officialUrl: 'https://www.vals.ai/benchmarks/finance_index',
    endpointUrl: 'https://www.vals.ai/benchmarks/finance_index',
    description:
      'Extrai dados oficiais de finanças corporativas e tributário do Vals.ai (FinanceBench / FinQA substitutes).',
    benchmarkIds: ['financebench', 'finqa'],
    supportsManualImport: true,
  },
  {
    id: 'vals-swebench',
    name: 'Vals.ai — SWE-bench Verified',
    officialUrl: 'https://www.vals.ai/benchmarks/swebench',
    endpointUrl: 'https://www.vals.ai/benchmarks/swebench',
    description: 'Extrai execuções independentes do SWE-bench Verified no Vals.ai e Steel Leaderboard.',
    benchmarkIds: ['swe-bench-verified'],
    supportsManualImport: true,
  },
  {
    id: 'vals-lcb',
    name: 'Vals.ai — LiveCodeBench',
    officialUrl: 'https://www.vals.ai/benchmarks/lcb',
    endpointUrl: 'https://www.vals.ai/benchmarks/lcb',
    description: 'Extrai pontuações oficiais do LiveCodeBench (Vals.ai + Artificial Analysis).',
    benchmarkIds: ['livecodebench'],
    supportsManualImport: true,
  },
  {
    id: 'vals-cua-bench',
    name: 'Vals.ai — CUA Bench (Computer Use / ScreenSpot)',
    officialUrl: 'https://www.vals.ai/benchmarks/cua_bench',
    endpointUrl: 'https://www.vals.ai/benchmarks/cua_bench',
    description: 'Extrai avaliações de agentes de uso de computador desktop (CUA Bench).',
    benchmarkIds: ['screenspot-pro'],
    supportsManualImport: true,
  },
  {
    id: 'vals-mmmu',
    name: 'Vals.ai — MMMU (Multimodal Understanding)',
    officialUrl: 'https://www.vals.ai/benchmarks/mmmu',
    endpointUrl: 'https://www.vals.ai/benchmarks/mmmu',
    description: 'Extrai pontuações multimodais do MMMU no Vals.ai e MMMU-Pro no Artificial Analysis.',
    benchmarkIds: ['mmmu'],
    supportsManualImport: true,
  },
  {
    id: 'spreadsheetbench',
    name: 'SpreadsheetBench V2 & V1 (spreadsheetbench.github.io)',
    officialUrl: 'https://spreadsheetbench.github.io/',
    endpointUrl: 'https://spreadsheetbench.github.io/data/leaderboard-v2-full.json',
    description:
      'Consome os endpoints JSON públicos oficiais do SpreadsheetBench V2 (Full + subscores Template, Fin.Model, Debug, Visualization) e SpreadsheetBench V1.',
    benchmarkIds: ['spreadsheetbench-2', 'spreadsheetbench-v1'],
    supportsManualImport: true,
  },
  {
    id: 'scale-swebench-pro',
    name: 'Scale AI — SWE-bench Pro V2 Leaderboard',
    officialUrl: 'https://scale.com/leaderboard/swe_bench_pro_public_v2',
    endpointUrl: 'https://scale.com/leaderboard/swe_bench_pro_public_v2',
    description:
      'Extrai deterministicamente o leaderboard público oficial do SWE-bench Pro V2 e V1 da Scale AI.',
    benchmarkIds: ['swe-bench-pro-v2'],
    supportsManualImport: true,
  },
  {
    id: 'lmarena-webdev',
    name: 'LMArena — WebDev Arena Leaderboard',
    officialUrl: 'https://web.lmarena.ai/leaderboard/webdev',
    endpointUrl: 'https://web.lmarena.ai/leaderboard/webdev',
    description:
      'Extrai o ranking oficial por modalidade WebDev diretamente do estado público do LMArena.',
    benchmarkIds: ['webdev-arena'],
    supportsManualImport: true,
  },
  {
    id: 'artifactsbench',
    name: 'Tencent Hunyuan — ArtifactsBench Leaderboard',
    officialUrl: 'https://artifactsbenchmark.github.io/',
    endpointUrl: 'https://artifactsbenchmark.github.io/static/js/main.f0afaa17.js',
    description:
      'Extrai a matriz JSON oficial de desempenho (AVG, WEB, SVG, SI, GAME) do bundle público do ArtifactsBench.',
    benchmarkIds: ['artifactsbench'],
    supportsManualImport: true,
  },
  {
    id: 'omegause-officeval',
    name: 'Baidu Frontier — OmegaUse-OfficeVal Leaderboard',
    officialUrl: 'https://omegause-officeval.github.io/',
    endpointUrl:
      'https://raw.githubusercontent.com/omegause-officeval/omegause-officeval.github.io/main/index.html',
    description:
      'Extrai o array estruturado leaderboardData (Score, Time-Weighted, Price-Weighted, Cost/Task) da página oficial do OmegaUse-OfficeVal.',
    benchmarkIds: ['omegause-officeval'],
    supportsManualImport: true,
  },
  {
    id: 'ui-cube',
    name: 'UiPath — UI-CUBE (uipath_enterprise_benchmark)',
    officialUrl: 'https://github.com/UiPath/uipath_enterprise_benchmark',
    endpointUrl: 'https://api.github.com/repos/UiPath/uipath_enterprise_benchmark',
    description:
      'Monitora o repositório oficial UiPath/uipath_enterprise_benchmark. Como o repositório publica apenas o código do harness DeterministicBenchmark sem tabela JSON de scores, suporta importação manual JSON/CSV e aciona substitutos automáticos.',
    benchmarkIds: ['ui-cube'],
    supportsManualImport: true,
  },
  {
    id: 'mm-browsecomp',
    name: 'MM-BrowseComp (GitHub MMBrowseComp/MM-BrowseComp)',
    officialUrl: 'https://github.com/MMBrowseComp/MM-BrowseComp',
    endpointUrl: 'https://api.github.com/repos/MMBrowseComp/MM-BrowseComp',
    description:
      'Monitora o repositório oficial MMBrowseComp/MM-BrowseComp. Como o dataset é criptografado e os resultados no README estão apenas em imagem estática (images/results.png), reporta status real e habilita importação manual + substituto AA-LCR.',
    benchmarkIds: ['mm-browsecomp'],
    supportsManualImport: true,
  },
  {
    id: 'finsheet-bench',
    name: 'FinSheet-Bench (Paper / Manual Import)',
    officialUrl: 'https://www.vals.ai/benchmarks/corp_fin_v2',
    endpointUrl: 'https://api.github.com/search/repositories?q=FinSheet-Bench',
    description:
      'Benchmark acadêmico sem feed JSON público oficial. Registra status real (unavailable/manual), permite importação determinística via JSON/CSV e utiliza FinanceBench/FinQA como substituto.',
    benchmarkIds: ['finsheet-bench'],
    supportsManualImport: true,
  },
  {
    id: 'bluefin',
    name: 'BlueFin Excel Benchmark (Manual Import)',
    officialUrl: 'https://spreadsheetbench.github.io/',
    endpointUrl: 'https://api.github.com/search/repositories?q=BlueFin+spreadsheet+benchmark',
    description:
      'Benchmark fechado de modelagem financeira em Excel sem endpoint público estruturado. Registra status real, suporta importação manual JSON/CSV e utiliza SpreadsheetBench 2 / v1 como substituto.',
    benchmarkIds: ['bluefin'],
    supportsManualImport: true,
  },
  {
    id: 'slidebench',
    name: 'SlideBench (GitHub BL4Z23/SlideBench)',
    officialUrl: 'https://github.com/BL4Z23/SlideBench',
    endpointUrl: 'https://api.github.com/repos/BL4Z23/SlideBench',
    description:
      'Monitora o repositório BL4Z23/SlideBench. Não expõe JSON de leaderboard público; suporta importação manual JSON/CSV e substituto MMMU / OmegaUse-OfficeVal.',
    benchmarkIds: ['slidebench'],
    supportsManualImport: true,
  },
  {
    id: 'design2code',
    name: 'Stanford SALT — Design2Code (NoviScl/Design2Code)',
    officialUrl: 'https://salt-nlp.github.io/Design2Code/',
    endpointUrl: 'https://api.github.com/repos/NoviScl/Design2Code',
    description:
      'Monitora o repositório oficial NoviScl/Design2Code e página do projeto Stanford SALT. Os resultados do paper estão publicados em PDF/imagens sem JSON de leaderboard ativo; suporta importação manual JSON/CSV e substituto automático.',
    benchmarkIds: ['design2code'],
    supportsManualImport: true,
  },
  {
    id: 'llm-accountants-lawyers-br',
    name: 'LLM Benchmark for Accountants and Lawyers (BR/EUA)',
    officialUrl: 'https://www.vals.ai/benchmarks/tax_eval_v2',
    endpointUrl: 'https://www.vals.ai/benchmarks/tax_eval_v2',
    description:
      'Avalia precisão tributária/contábil e trava contra alucinação de norma revogada (conectado ao Vals Tax Eval v2 para base tributária + suporte a importação manual de cadernos brasileiros de SPED, Simples Nacional e Reforma Tributária IBS/CBS).',
    benchmarkIds: ['llm-accountants-lawyers-br'],
    supportsManualImport: true,
  },
];

export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: 'balanced',
    name: 'Equilibrado (Padrão)',
    description: 'Peso igual (100) para todos os 7 casos de uso.',
    weights: {
      'uc-1-legal-tax-search': 100,
      'uc-2-financial-tax-analysis': 100,
      'uc-3-excel-spreadsheets': 100,
      'uc-4-automations-cli-api': 100,
      'uc-5-desktop-computer-use': 100,
      'uc-6-fullstack-db-apps': 100,
      'uc-7-office-presentations-layouts': 100,
    },
  },
  {
    id: 'accounting-tax',
    name: 'Contábil, Tributário & Financeiro',
    description:
      'Prioriza busca de legislação tributária/contábil, análise de demonstrativos financeiros e criação de planilhas Excel complexas.',
    weights: {
      'uc-1-legal-tax-search': 100,
      'uc-2-financial-tax-analysis': 100,
      'uc-3-excel-spreadsheets': 90,
      'uc-4-automations-cli-api': 35,
      'uc-5-desktop-computer-use': 30,
      'uc-6-fullstack-db-apps': 20,
      'uc-7-office-presentations-layouts': 65,
    },
  },
  {
    id: 'automation-dev',
    name: 'Automação, Agentes CLI & Engenharia de Software',
    description:
      'Foco máximo em automações estilo Hermes Agent (Terminal-Bench 2.1, τ-bench, GAIA) e criação de aplicações com banco de dados (SWE-bench Pro V2, WebDev Arena).',
    weights: {
      'uc-1-legal-tax-search': 30,
      'uc-2-financial-tax-analysis': 30,
      'uc-3-excel-spreadsheets': 40,
      'uc-4-automations-cli-api': 100,
      'uc-5-desktop-computer-use': 70,
      'uc-6-fullstack-db-apps': 100,
      'uc-7-office-presentations-layouts': 30,
    },
  },
  {
    id: 'office-computer-use',
    name: 'Pacote Office, Planilhas & Computer Use Desktop',
    description:
      'Prioriza automação desktop 100% GUI (OSWorld 2.0, UI-CUBE), planilhas Excel (.xlsx) e geração de PPTX/Word/PDF.',
    weights: {
      'uc-1-legal-tax-search': 30,
      'uc-2-financial-tax-analysis': 50,
      'uc-3-excel-spreadsheets': 100,
      'uc-4-automations-cli-api': 50,
      'uc-5-desktop-computer-use': 100,
      'uc-6-fullstack-db-apps': 30,
      'uc-7-office-presentations-layouts': 100,
    },
  },
];

export const BENCHMARK_MAP = new Map<string, BenchmarkDefinition>(
  BENCHMARKS.map((b) => [b.id, b])
);

export const USE_CASE_MAP = new Map<string, UseCaseDefinition>(
  USE_CASES.map((u) => [u.id, u])
);