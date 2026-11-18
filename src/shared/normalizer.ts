import { EFFORT_LABELS } from './catalog.js';
import { EffortLevel, NormalizedModelInfo } from './types.js';

interface CanonicalRule {
  pattern: RegExp;
  canonicalId: string;
  displayName: string;
  provider: string;
}

const CANONICAL_MODEL_RULES: CanonicalRule[] = [
  // Anthropic Claude 5.x / Fable / Mythos / 4.x / 3.x
  {
    pattern: /\b(?:claude[-\s]*)?fable[-\s]*5[.\s-]*2\b/i,
    canonicalId: 'claude-fable-5-2',
    displayName: 'Claude Fable 5.2',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?fable[-\s]*5[.\s-]*1\b/i,
    canonicalId: 'claude-fable-5-1',
    displayName: 'Claude Fable 5.1',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?fable[-\s]*5(?![.\s-]*[12])\b/i,
    canonicalId: 'claude-fable-5',
    displayName: 'Claude Fable 5',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?mythos[-\s]*5[.\s-]*1\b/i,
    canonicalId: 'claude-mythos-5-1',
    displayName: 'Claude Mythos 5.1',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?mythos(?:\s*preview|[-\s]*5)?\b/i,
    canonicalId: 'claude-mythos-5',
    displayName: 'Claude Mythos 5',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?opus[-\s]*5[.\s-]*5\b/i,
    canonicalId: 'claude-opus-5-5',
    displayName: 'Claude Opus 5.5',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?opus[-\s]*5(?![.\s-]*[1-9])\b/i,
    canonicalId: 'claude-opus-5',
    displayName: 'Claude Opus 5',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?sonnet[-\s]*5[.\s-]*5\b/i,
    canonicalId: 'claude-sonnet-5-5',
    displayName: 'Claude Sonnet 5.5',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?sonnet[-\s]*5(?![.\s-]*[1-9])\b/i,
    canonicalId: 'claude-sonnet-5',
    displayName: 'Claude Sonnet 5',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?haiku[-\s]*5[.\s-]*5\b/i,
    canonicalId: 'claude-haiku-5-5',
    displayName: 'Claude Haiku 5.5',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?opus[-\s]*4[.\s-]*8\b/i,
    canonicalId: 'claude-opus-4-8',
    displayName: 'Claude Opus 4.8',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?opus[-\s]*4[.\s-]*7\b/i,
    canonicalId: 'claude-opus-4-7',
    displayName: 'Claude Opus 4.7',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?opus[-\s]*4[.\s-]*6\b/i,
    canonicalId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?opus[-\s]*4[.\s-]*5\b/i,
    canonicalId: 'claude-opus-4-5',
    displayName: 'Claude Opus 4.5',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?opus[-\s]*4[.\s-]*1\b/i,
    canonicalId: 'claude-opus-4-1',
    displayName: 'Claude Opus 4.1',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?sonnet[-\s]*4[.\s-]*6\b/i,
    canonicalId: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?sonnet[-\s]*4[.\s-]*5\b/i,
    canonicalId: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
  },
  {
    pattern: /\b(?:claude[-\s]*)?sonnet[-\s]*4(?![.\s-]*[1-9])\b/i,
    canonicalId: 'claude-sonnet-4',
    displayName: 'Claude Sonnet 4',
    provider: 'Anthropic',
  },
  {
    pattern: /\bclaude[-\s]*3[.\s-]*7[-\s]*sonnet\b/i,
    canonicalId: 'claude-3-7-sonnet',
    displayName: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
  },

  // OpenAI GPT-6.x / GPT-5.x / o3 / o4
  {
    pattern: /\bgpt[-\s]*6[.\s-]*2[-\s]*astra\b/i,
    canonicalId: 'gpt-6-2-astra',
    displayName: 'GPT-6.2 Astra',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*6[.\s-]*2[-\s]*sol\b/i,
    canonicalId: 'gpt-6-2-sol',
    displayName: 'GPT-6.2 Sol',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*6[.\s-]*1[-\s]*sol\b/i,
    canonicalId: 'gpt-6-1-sol',
    displayName: 'GPT-6.1 Sol',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*6[.\s-]*1[-\s]*terra\b/i,
    canonicalId: 'gpt-6-1-terra',
    displayName: 'GPT-6.1 Terra',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*6[-\s]*astra\b/i,
    canonicalId: 'gpt-6-astra',
    displayName: 'GPT-6 Astra',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*6[-\s]*luna\b/i,
    canonicalId: 'gpt-6-luna',
    displayName: 'GPT-6 Luna',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*5[.\s-]*6[-\s]*sol(?:\s*ultra)?\b/i,
    canonicalId: 'gpt-5-6-sol',
    displayName: 'GPT-5.6 Sol',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*5[.\s-]*5\b/i,
    canonicalId: 'gpt-5-5',
    displayName: 'GPT-5.5',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*5[.\s-]*4\b/i,
    canonicalId: 'gpt-5-4',
    displayName: 'GPT-5.4',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*5[.\s-]*2\b/i,
    canonicalId: 'gpt-5-2',
    displayName: 'GPT-5.2',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*5(?![.\s-]*[1-9]|\s*oss)\b/i,
    canonicalId: 'gpt-5',
    displayName: 'GPT-5',
    provider: 'OpenAI',
  },
  {
    pattern: /\bgpt[-\s]*oss[-\s]*120b\b/i,
    canonicalId: 'gpt-oss-120b',
    displayName: 'GPT-OSS-120B',
    provider: 'OpenAI',
  },
  {
    pattern: /\bo3[-\s]*pro\b/i,
    canonicalId: 'o3-pro',
    displayName: 'o3-pro',
    provider: 'OpenAI',
  },
  {
    pattern: /\bo4[-\s]*mini\b/i,
    canonicalId: 'o4-mini',
    displayName: 'o4-mini',
    provider: 'OpenAI',
  },

  // Google Gemini 4.x / 3.x / 2.5
  {
    pattern: /\bgemini[-\s]*4[-\s]*carbon\b/i,
    canonicalId: 'gemini-4-carbon',
    displayName: 'Gemini 4 Carbon',
    provider: 'Google',
  },
  {
    pattern: /\bgemini[-\s]*4[-\s]*argon\b/i,
    canonicalId: 'gemini-4-argon',
    displayName: 'Gemini 4 Argon',
    provider: 'Google',
  },
  {
    pattern: /\bgemini[-\s]*4[-\s]*hydrogen\b/i,
    canonicalId: 'gemini-4-hydrogen',
    displayName: 'Gemini 4 Hydrogen',
    provider: 'Google',
  },
  {
    pattern: /\bgemini[-\s]*3[.\s-]*8[-\s]*flash\b/i,
    canonicalId: 'gemini-3-8-flash',
    displayName: 'Gemini 3.8 Flash',
    provider: 'Google',
  },
  {
    pattern: /\bgemini[-\s]*3[.\s-]*1[-\s]*pro\b/i,
    canonicalId: 'gemini-3-1-pro',
    displayName: 'Gemini 3.1 Pro',
    provider: 'Google',
  },
  {
    pattern: /\bgemini[-\s]*3[-\s]*pro\b/i,
    canonicalId: 'gemini-3-pro',
    displayName: 'Gemini 3 Pro',
    provider: 'Google',
  },
  {
    pattern: /\bgemini[-\s]*3[-\s]*flash\b/i,
    canonicalId: 'gemini-3-flash',
    displayName: 'Gemini 3 Flash',
    provider: 'Google',
  },
  {
    pattern: /\bgemini[-\s]*2[.\s-]*5[-\s]*pro\b/i,
    canonicalId: 'gemini-2-5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'Google',
  },
  {
    pattern: /\bgemini[-\s]*2[.\s-]*5[-\s]*flash\b/i,
    canonicalId: 'gemini-2-5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'Google',
  },

  // Meta Muse / Llama 4
  {
    pattern: /\bmuse[-\s]*spark[-\s]*1[.\s-]*3\b/i,
    canonicalId: 'muse-spark-1-3',
    displayName: 'Muse Spark 1.3',
    provider: 'Meta',
  },
  {
    pattern: /\bmuse[-\s]*spark[-\s]*1[.\s-]*1\b/i,
    canonicalId: 'muse-spark-1-1',
    displayName: 'Muse Spark 1.1',
    provider: 'Meta',
  },
  {
    pattern: /\bmuse[-\s]*spark(?![-\s]*1[.\s-]*[13])\b/i,
    canonicalId: 'muse-spark',
    displayName: 'Muse Spark',
    provider: 'Meta',
  },
  {
    pattern: /\bmuse[-\s]*wonder[-\s]*1[.\s-]*0\b/i,
    canonicalId: 'muse-wonder-1-0',
    displayName: 'Muse Wonder 1.0',
    provider: 'Meta',
  },
  {
    pattern: /\bmuse[-\s]*ember\b/i,
    canonicalId: 'muse-ember',
    displayName: 'Muse Ember',
    provider: 'Meta',
  },

  // DeepSeek
  {
    pattern: /\bdeepseek[-\s]*v4[.\s-]*1[-\s]*flash\b/i,
    canonicalId: 'deepseek-v4-1-flash',
    displayName: 'DeepSeek V4.1 Flash',
    provider: 'DeepSeek',
  },
  {
    pattern: /\bdeepseek[-\s]*v4[-\s]*pro\b/i,
    canonicalId: 'deepseek-v4-pro',
    displayName: 'DeepSeek V4 Pro',
    provider: 'DeepSeek',
  },
  {
    pattern: /\bdeepseek[-\s]*v4(?![.\s-]*1|[-\s]*pro)\b/i,
    canonicalId: 'deepseek-v4',
    displayName: 'DeepSeek V4',
    provider: 'DeepSeek',
  },
  {
    pattern: /\bdeepseek[-\s]*v3[.\s-]*2\b/i,
    canonicalId: 'deepseek-v3-2',
    displayName: 'DeepSeek V3.2',
    provider: 'DeepSeek',
  },
  {
    pattern: /\bdeepseek[-\s]*r1\b/i,
    canonicalId: 'deepseek-r1',
    displayName: 'DeepSeek R1',
    provider: 'DeepSeek',
  },

  // Moonshot / Kimi
  {
    pattern: /\bkimi[-\s]*k3[.\s-]*1[-\s]*pro\b/i,
    canonicalId: 'kimi-k3-1-pro',
    displayName: 'Kimi K3.1 Pro',
    provider: 'Moonshot AI',
  },
  {
    pattern: /\bkimi[-\s]*k3(?![.\s-]*1)\b/i,
    canonicalId: 'kimi-k3',
    displayName: 'Kimi K3',
    provider: 'Moonshot AI',
  },
  {
    pattern: /\bkimi[-\s]*k2[.\s-]*6\b/i,
    canonicalId: 'kimi-k2-6',
    displayName: 'Kimi K2.6',
    provider: 'Moonshot AI',
  },
  {
    pattern: /\bkimi[-\s]*k2[.\s-]*5\b/i,
    canonicalId: 'kimi-k2-5',
    displayName: 'Kimi K2.5',
    provider: 'Moonshot AI',
  },

  // Alibaba / Qwen
  {
    pattern: /\bqwen[-\s]*3[.\s-]*8[-\s]*max\b/i,
    canonicalId: 'qwen-3-8-max',
    displayName: 'Qwen 3.8 Max',
    provider: 'Alibaba / Qwen',
  },
  {
    pattern: /\bqwen[-\s]*3[.\s-]*8[-\s]*27b\b/i,
    canonicalId: 'qwen-3-8-27b',
    displayName: 'Qwen 3.8 27B',
    provider: 'Alibaba / Qwen',
  },
  {
    pattern: /\bqwen[-\s]*3[.\s-]*7[-\s]*plus\b/i,
    canonicalId: 'qwen-3-7-plus',
    displayName: 'Qwen 3.7 Plus',
    provider: 'Alibaba / Qwen',
  },
  {
    pattern: /\bqwen[-\s]*3[.\s-]*5[-\s]*397b/i,
    canonicalId: 'qwen-3-5-397b',
    displayName: 'Qwen 3.5 397B',
    provider: 'Alibaba / Qwen',
  },

  // Zhipu / Z.AI GLM
  {
    pattern: /\bglm[-\s]*5[.\s-]*3[-\s]*flash\b/i,
    canonicalId: 'glm-5-3-flash',
    displayName: 'GLM-5.3 Flash',
    provider: 'Z.AI (Zhipu)',
  },
  {
    pattern: /\bglm[-\s]*5[.\s-]*2\b/i,
    canonicalId: 'glm-5-2',
    displayName: 'GLM-5.2',
    provider: 'Z.AI (Zhipu)',
  },
  {
    pattern: /\bglm[-\s]*5[.\s-]*1\b/i,
    canonicalId: 'glm-5-1',
    displayName: 'GLM-5.1',
    provider: 'Z.AI (Zhipu)',
  },
  {
    pattern: /\bglm[-\s]*5(?![.\s-]*[123])\b/i,
    canonicalId: 'glm-5',
    displayName: 'GLM-5',
    provider: 'Z.AI (Zhipu)',
  },

  // xAI Grok
  {
    pattern: /\bgrok[-\s]*4[.\s-]*2\b/i,
    canonicalId: 'grok-4-2',
    displayName: 'Grok 4.2',
    provider: 'xAI',
  },
  {
    pattern: /\bgrok[-\s]*4\b/i,
    canonicalId: 'grok-4',
    displayName: 'Grok 4',
    provider: 'xAI',
  },

  // GitHub / Microsoft
  {
    pattern: /\bcopilot[-\s]*fusion\b/i,
    canonicalId: 'copilot-fusion',
    displayName: 'Copilot Fusion',
    provider: 'Microsoft / GitHub',
  },
];

const PROVIDER_NORMALIZATION_MAP: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /anthropic/i, name: 'Anthropic' },
  { pattern: /openai|codex/i, name: 'OpenAI' },
  { pattern: /google|deepmind|vertex/i, name: 'Google' },
  { pattern: /meta|facebook/i, name: 'Meta' },
  { pattern: /deepseek/i, name: 'DeepSeek' },
  { pattern: /xai|x\.ai/i, name: 'xAI' },
  { pattern: /alibaba|qwen|tongyi/i, name: 'Alibaba / Qwen' },
  { pattern: /moonshot|kimi/i, name: 'Moonshot AI' },
  { pattern: /zhipu|z\.ai|\bzai\b|glm/i, name: 'Z.AI (Zhipu)' },
  { pattern: /mistral/i, name: 'Mistral AI' },
  { pattern: /minimax/i, name: 'MiniMax' },
  { pattern: /tencent|hunyuan/i, name: 'Tencent' },
  { pattern: /baidu|ernie/i, name: 'Baidu' },
  { pattern: /amazon|aws|nova/i, name: 'Amazon' },
  { pattern: /microsoft|github/i, name: 'Microsoft / GitHub' },
  { pattern: /xiaomi|mimo/i, name: 'Xiaomi' },
  { pattern: /cohere/i, name: 'Cohere' },
  { pattern: /nvidia/i, name: 'NVIDIA' },
  { pattern: /thinking\s*machines|inkling/i, name: 'Thinking Machines' },
  { pattern: /kingsoft|wps/i, name: 'Kingsoft Office' },
];

export function extractEffortLevel(
  rawName: string,
  explicitEffort?: string | null,
  isReasoning?: boolean | null
): EffortLevel {
  const combined = `${explicitEffort ?? ''} ${rawName}`.toLowerCase();

  // Check explicit effort tokens in parentheses, suffixes or explicit field
  if (
    /\b(?:xhigh|x-high|extra[-\s]*high)\b/i.test(combined) ||
    /\(\s*xhigh\s*\)/i.test(combined)
  ) {
    return 'xhigh';
  }
  if (
    /\b(?:max|ultra)\b/i.test(combined) &&
    !/\bqwen[-\s]*3[.\s-]*8[-\s]*max\b/i.test(rawName.replace(/\(.*?\)/g, ''))
  ) {
    return 'max';
  }
  // Even if the model is Qwen 3.8 Max, check if explicitEffort or parenthetical says max
  if (explicitEffort && /\bmax\b/i.test(explicitEffort)) {
    return 'max';
  }
  if (/\(\s*max\b/i.test(rawName)) {
    return 'max';
  }
  if (
    /\b(?:high)\b/i.test(explicitEffort ?? '') ||
    /\(\s*high\b/i.test(rawName) ||
    /[-\s]high$/i.test(rawName.trim())
  ) {
    return 'high';
  }
  if (
    /\b(?:medium|med)\b/i.test(explicitEffort ?? '') ||
    /\(\s*medium\b/i.test(rawName) ||
    /[-\s]medium$/i.test(rawName.trim())
  ) {
    return 'medium';
  }
  if (
    /\b(?:low|minimal)\b/i.test(explicitEffort ?? '') ||
    /\(\s*low\b/i.test(rawName) ||
    /[-\s]low$/i.test(rawName.trim())
  ) {
    return 'low';
  }
  if (
    /\b(?:non[-\s]*thinking|non[-\s]*reasoning|no[-\s]*thinking|none)\b/i.test(combined) ||
    /-none\b/i.test(rawName)
  ) {
    return 'non-thinking';
  }
  if (
    /\b(?:thinking|reasoning|think)\b/i.test(combined)
  ) {
    return 'thinking';
  }

  return 'default';
}

export function normalizeProvider(rawProvider?: string | null, rawModelName?: string): string {
  const candidate = `${rawProvider ?? ''} ${rawModelName ?? ''}`.trim();
  for (const rule of PROVIDER_NORMALIZATION_MAP) {
    if (rule.pattern.test(candidate)) {
      return rule.name;
    }
  }
  if (rawProvider && rawProvider.trim().length > 0) {
    return rawProvider.trim();
  }
  return 'Outros / Independente';
}

export function normalizeModel(
  rawModelName: string,
  rawProvider?: string | null,
  explicitEffort?: string | null,
  isReasoning?: boolean | null
): NormalizedModelInfo {
  const cleanedRaw = rawModelName.trim().replace(/\*+$/, '').trim();
  const effort = extractEffortLevel(cleanedRaw, explicitEffort, isReasoning);
  const effortLabel = EFFORT_LABELS[effort];

  for (const rule of CANONICAL_MODEL_RULES) {
    if (rule.pattern.test(cleanedRaw)) {
      return {
        canonicalId: rule.canonicalId,
        displayName: rule.displayName,
        provider: rule.provider,
        effort,
        effortLabel,
        rawModelName,
        rawProvider: rawProvider ?? undefined,
      };
    }
  }

  // Fallback deterministic slugification stripping parenthetical effort/harness suffixes
  const baseName = cleanedRaw
    .replace(
      /\(\s*(?:max|xhigh|high|medium|low|thinking|non-thinking|non-reasoning|default fallback|claude code|mini-swe-agent|codex|vals\.ai run)[^)]*\)/gi,
      ''
    )
    .replace(/\s+(?:xhigh|high|medium|low|max)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const canonicalId = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const provider = normalizeProvider(rawProvider, baseName);

  return {
    canonicalId: canonicalId || 'unknown-model',
    displayName: baseName || cleanedRaw,
    provider,
    effort,
    effortLabel,
    rawModelName,
    rawProvider: rawProvider ?? undefined,
  };
}

export function clampNormalizedScore(
  rawScore: number,
  minScore: number,
  maxScore: number,
  higherIsBetter = true
): number {
  if (!Number.isFinite(rawScore)) return 0;
  if (maxScore === minScore) return 50;
  const ratio = (rawScore - minScore) / (maxScore - minScore);
  const pct = higherIsBetter ? ratio * 100 : (1 - ratio) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 100) / 100));
}