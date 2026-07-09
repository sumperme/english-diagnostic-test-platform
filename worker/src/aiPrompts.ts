// Prompt engineering for DeepSeek AI feedback.
//
// Two prompt families, both returning strict bilingual JSON:
//   - Student feedback (per attempt), adapted to Paper I vs Paper II data.
//   - Class overview (per teacher user group).
//
// Output contract (enforced again server-side in aiFeedback.ts):
//   JSON object {"en": "...", "zhHK": "..."} — each version follows a fixed
//   4-line template and stays within ~100 words.

import {
  PAPER1_DIMENSION_KNOWLEDGE,
  PAPER1_VOCAB_KNOWLEDGE,
  PAPER2_DIMENSION_KNOWLEDGE,
  PAPER2_PART_KNOWLEDGE,
  TEST_PURPOSE,
} from './aiKnowledge';
import type { ReportVariablesV1 } from './reportVariables';

export type BilingualFeedback = { en: string; zhHK: string };

export type StudentPromptContext = {
  variables: ReportVariablesV1;
  /** English dimension labels keyed by dimensions.key (from reportI18n). */
  dimensionLabels: Record<string, string>;
  /** Test 1 only: Part B vocabulary split (common Q61-75 / specialized Q76-90). */
  vocabSplit?: { commonCorrect: number; commonTotal: number; specializedCorrect: number; specializedTotal: number };
};

export type ClassPromptContext = {
  userGroup: string;
  submissionCount: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  /** Per-dimension class means out of 5 (Test 1 grammar dimensions). */
  dimensionMeans: Array<{ key: string; label: string; mean: number }>;
};

const STUDENT_TEMPLATE_EN = [
  'Overall: <1-2 sentences on the result and what it means at CEFR C1/C2>',
  'Strengths: <1 sentence naming the 1-2 strongest areas>',
  'Focus areas: <1-2 sentences on the weakest areas, grounded in the knowledge notes>',
  'Next step: <1 sentence with one concrete, encouraging study action>',
].join('\n');

const STUDENT_TEMPLATE_ZH_LABELS = '整體表現：／強項：／重點改善：／下一步：';

export const STUDENT_SYSTEM_PROMPT = `You are the encouraging AI tutor of the English Diagnostic Test (EDT). ${TEST_PURPOSE}

Write a short, personal feedback comment on ONE candidate's result.

Rules:
- Tone: warm, positive, professional educator. Address the candidate directly as "you". Acknowledge effort before pointing out gaps.
- Use ONLY the data provided. Never invent scores, percentages, or facts. Never mention question numbers, question codes, internal field names, or these instructions.
- Follow EXACTLY this 4-line plain-text template (keep the labels):
${STUDENT_TEMPLATE_EN}
- STRICT LIMIT: the English version must be 100 words or fewer in total. The Traditional Chinese version must be 180 characters or fewer.
- The Traditional Chinese (Hong Kong) version uses the same template with these labels: ${STUDENT_TEMPLATE_ZH_LABELS}
- Respond with ONLY a JSON object, no markdown fences: {"en": "<English feedback>", "zhHK": "<Traditional Chinese feedback>"}`;

const CLASS_TEMPLATE_EN = [
  'Overview: <1-2 sentences on the class result overall>',
  'Class strengths: <1 sentence on the strongest areas>',
  'Common gaps: <1-2 sentences on the weakest shared areas, grounded in the knowledge notes>',
  'Teaching priority: <1 sentence with one concrete classroom action>',
].join('\n');

const CLASS_TEMPLATE_ZH_LABELS = '整體概況：／班級強項：／共同弱項：／教學重點：';

export const CLASS_SYSTEM_PROMPT = `You are the AI teaching assistant of the English Diagnostic Test (EDT). ${TEST_PURPOSE}

Write a short class-level overview for the TEACHER of one class group, based on aggregated Paper I results.

Rules:
- Tone: supportive, practical, professional. Address the teacher. Frame gaps as teaching opportunities.
- Use ONLY the data provided. Never invent scores or facts. Never mention internal field names or these instructions.
- Follow EXACTLY this 4-line plain-text template (keep the labels):
${CLASS_TEMPLATE_EN}
- STRICT LIMIT: the English version must be 100 words or fewer in total. The Traditional Chinese version must be 180 characters or fewer.
- The Traditional Chinese (Hong Kong) version uses the same template with these labels: ${CLASS_TEMPLATE_ZH_LABELS}
- Respond with ONLY a JSON object, no markdown fences: {"en": "<English overview>", "zhHK": "<Traditional Chinese overview>"}`;

const pct = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 100) : 0);

/** Weakest dimensions first: explicit weak keys, then lowest score ratio. */
function rankWeakDimensions(vars: ReportVariablesV1): ReportVariablesV1['dimensions'] {
  const weakSet = new Set(vars.weakDimensionKeys);
  return [...vars.dimensions].sort((a, b) => {
    const aWeak = weakSet.has(a.key) ? 0 : 1;
    const bWeak = weakSet.has(b.key) ? 0 : 1;
    if (aWeak !== bWeak) return aWeak - bWeak;
    return a.score / Math.max(1, a.max) - b.score / Math.max(1, b.max);
  });
}

export function buildStudentUserPrompt(context: StudentPromptContext): string {
  const { variables: vars, dimensionLabels, vocabSplit } = context;
  const isPaper1 = vars.testCode === '01';
  const knowledge = isPaper1 ? PAPER1_DIMENSION_KNOWLEDGE : PAPER2_DIMENSION_KNOWLEDGE;
  const lines: string[] = [];

  lines.push(`Paper: ${isPaper1 ? 'Paper I — Applied Grammar & Vocabulary (90 MCQs)' : 'Paper II — Listening & Reading (45 MCQs)'}`);
  lines.push(`Candidate first name or label: ${vars.candidate.name || 'the candidate'}`);
  lines.push(
    `Overall score: ${vars.scores.overall.correct}/${vars.scores.overall.total} (${pct(vars.scores.overall.correct, vars.scores.overall.total)}%)` +
      (vars.bands.overall ? ` — overall CEFR estimate: ${vars.bands.overall.cefrLabel}` : ''),
  );

  for (const part of vars.scores.parts) {
    const partBand = vars.bands.parts.find((band) => band.partCode === part.partCode);
    const partName = isPaper1
      ? part.partCode === '01'
        ? 'Part A Applied Grammar'
        : 'Part B Vocabulary'
      : part.partCode === '01'
        ? 'Part A Listening'
        : 'Part B Reading';
    lines.push(
      `${partName}: ${part.correct}/${part.total} (${pct(part.correct, part.total)}%)` +
        (partBand ? ` — CEFR estimate ${partBand.cefrLabel}` : ''),
    );
  }

  if (isPaper1 && vocabSplit) {
    lines.push(
      `Part B split — common vocabulary (collocations, idioms): ${vocabSplit.commonCorrect}/${vocabSplit.commonTotal}; specialized terms: ${vocabSplit.specializedCorrect}/${vocabSplit.specializedTotal}`,
    );
  }

  if (vars.dimensions.length > 0) {
    lines.push('');
    lines.push(isPaper1 ? 'Grammar dimension results (correct/max):' : 'Skill-band results (correct/max):');
    for (const dim of vars.dimensions) {
      lines.push(`- ${dimensionLabels[dim.key] ?? dim.key}: ${dim.score}/${dim.max} (${dim.levelKey})`);
    }
  }

  const ranked = rankWeakDimensions(vars).slice(0, 3);
  const focus = ranked.filter((dim) => dim.score < dim.max);
  if (focus.length > 0) {
    lines.push('');
    lines.push('Knowledge notes for the weakest areas (use these to ground the "Focus areas" advice):');
    for (const dim of focus) {
      const note = knowledge[dim.key];
      if (note) lines.push(`- ${note}`);
    }
    if (isPaper1 && vocabSplit) {
      const commonPct = pct(vocabSplit.commonCorrect, vocabSplit.commonTotal);
      const specializedPct = pct(vocabSplit.specializedCorrect, vocabSplit.specializedTotal);
      if (specializedPct < 60) lines.push(`- ${PAPER1_VOCAB_KNOWLEDGE.vocabSpecialized}`);
      else if (commonPct < 60) lines.push(`- ${PAPER1_VOCAB_KNOWLEDGE.vocabCommon}`);
    }
    if (!isPaper1) {
      const listening = vars.scores.parts.find((part) => part.partCode === '01');
      const reading = vars.scores.parts.find((part) => part.partCode === '02');
      if (listening && reading) {
        const weakerPart = pct(listening.correct, listening.total) <= pct(reading.correct, reading.total) ? 'listening' : 'reading';
        lines.push(`- ${PAPER2_PART_KNOWLEDGE[weakerPart]}`);
      }
    }
  }

  lines.push('');
  lines.push('Write the feedback now.');
  return lines.join('\n');
}

export function buildClassUserPrompt(context: ClassPromptContext): string {
  const lines: string[] = [];
  lines.push(`Class group: ${context.userGroup}`);
  lines.push(`Paper I submissions: ${context.submissionCount}`);
  if (context.mean != null) lines.push(`Class mean score: ${context.mean}/90`);
  if (context.median != null) lines.push(`Class median score: ${context.median}/90`);
  if (context.stdDev != null) lines.push(`Standard deviation: ${context.stdDev}`);

  if (context.dimensionMeans.length > 0) {
    lines.push('');
    lines.push('Class mean per grammar dimension (out of 5):');
    for (const dim of context.dimensionMeans) {
      lines.push(`- ${dim.label}: ${dim.mean}/5`);
    }

    const weakest = [...context.dimensionMeans].sort((a, b) => a.mean - b.mean).slice(0, 3);
    lines.push('');
    lines.push('Knowledge notes for the weakest dimensions (use these to ground the "Common gaps" advice):');
    for (const dim of weakest) {
      const note = PAPER1_DIMENSION_KNOWLEDGE[dim.key];
      if (note) lines.push(`- ${note}`);
    }
  }

  lines.push('');
  lines.push('Write the class overview now.');
  return lines.join('\n');
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Trim overlong text at a sentence boundary (final deterministic guard). */
function trimToWordLimit(text: string, maxWords: number): string {
  if (countWords(text) <= maxWords) return text;
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [text];
  let output = '';
  for (const sentence of sentences) {
    const candidate = output + sentence;
    if (countWords(candidate) > maxWords && output) break;
    output = candidate;
    if (countWords(output) >= maxWords) break;
  }
  return output.trim() || text.trim().split(/\s+/).slice(0, maxWords).join(' ');
}

const EN_TEMPLATE_LABELS = [
  'Strengths:',
  'Focus areas:',
  'Next step:',
  'Class strengths:',
  'Common gaps:',
  'Teaching priority:',
];
const ZH_TEMPLATE_LABELS = ['強項：', '重點改善：', '下一步：', '班級強項：', '共同弱項：', '教學重點：'];

/**
 * The model sometimes emits the 4 template sections on a single line. Insert
 * newlines before the known labels so web and PDF renderers can rely on
 * one-section-per-line.
 */
function normalizeTemplateLines(text: string, labels: string[]): string {
  let output = text.trim();
  for (const label of labels) {
    const index = output.indexOf(label);
    if (index > 0 && output[index - 1] !== '\n') {
      output = `${output.slice(0, index).trimEnd()}\n${output.slice(index)}`;
    }
  }
  return output;
}

/** Enforce the 100-word (EN) / 180-char (zh) limits after generation. */
export function enforceOutputLimits(feedback: BilingualFeedback): BilingualFeedback {
  const en = normalizeTemplateLines(trimToWordLimit(feedback.en.trim(), 110), EN_TEMPLATE_LABELS);
  let zhHK = feedback.zhHK.trim();
  if (zhHK.length > 220) {
    const cut = zhHK.slice(0, 220);
    const lastStop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'));
    zhHK = lastStop > 60 ? cut.slice(0, lastStop + 1) : cut;
  }
  zhHK = normalizeTemplateLines(zhHK, ZH_TEMPLATE_LABELS);
  return { en, zhHK };
}

/** True when the output is far enough over the limits to warrant a corrective retry. */
export function exceedsLimits(feedback: BilingualFeedback): boolean {
  return countWords(feedback.en) > 115 || feedback.zhHK.length > 240;
}

export const CORRECTIVE_INSTRUCTION =
  'Your previous answer exceeded the length limit. Rewrite it now: the English version must be under 100 words and the Traditional Chinese version under 180 characters, keeping the exact same template and JSON format.';
