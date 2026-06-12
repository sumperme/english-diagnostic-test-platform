import { CEFR_BANDS } from '../data/cefr';
import { DIMENSIONS, OVERALL_ONLY_QIDS } from '../data/dimensions';
import { ALL_QUESTIONS, ANSWER_KEY, PART_A, PART_B, type OptionKey, type Question } from '../data/questions';
import type { Answers, CandidateInfo, DimensionScore, ReportResult } from '../types';

const VALID_OPTION_KEYS = new Set<OptionKey>(['A', 'B', 'C', 'D']);

/** Keep only ASCII option keys so locale/UI strings never enter the submission payload. */
export function sanitizeAnswers(answers: Answers): Answers {
  const sanitized: Answers = {};
  for (const [questionId, value] of Object.entries(answers)) {
    if (value && VALID_OPTION_KEYS.has(value)) {
      sanitized[questionId] = value;
    }
  }
  return sanitized;
}
import { percent } from './format';

export const APP_VERSION = '2.0.0';
export const TOTAL_SECS = 3600;

const getCEFRBand = (total: number) =>
  CEFR_BANDS.find((band) => total >= band.min && total <= band.max) ?? CEFR_BANDS[0];

export const getDimensionLevel = (score: number): Pick<DimensionScore, 'level' | 'levelKey'> => {
  if (score <= 1) return { level: 1, levelKey: 'needsWork' };
  if (score === 2) return { level: 2, levelKey: 'developing' };
  if (score === 3) return { level: 3, levelKey: 'good' };
  if (score === 4) return { level: 4, levelKey: 'strong' };
  return { level: 5, levelKey: 'excellent' };
};

export const scoreBarColor = (score: number, max: number) => {
  const ratio = score / max;
  if (ratio >= 0.85) return 'bg-emerald-500';
  if (ratio >= 0.67) return 'bg-sky-500';
  if (ratio >= 0.34) return 'bg-amber-400';
  return 'bg-rose-400';
};

export const levelBadgeClass = (level: number) => {
  if (level >= 5) return 'bg-emerald-100 text-emerald-700';
  if (level === 4) return 'bg-teal-100 text-teal-700';
  if (level === 3) return 'bg-sky-100 text-sky-700';
  if (level === 2) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
};

function buildQuestionCorrectness(
  answers: Answers,
  questions: Question[],
): Record<string, 0 | 1> {
  const result: Record<string, 0 | 1> = {};
  for (const q of questions) {
    result[q.id] = answers[q.id] === ANSWER_KEY[q.id] ? 1 : 0;
  }
  return result;
}

export function computeReport(
  answers: Answers,
  candidateInfo: CandidateInfo,
  startedAt: number,
  autoSubmitted: boolean,
  questions = ALL_QUESTIONS,
): ReportResult {
  const safeAnswers = sanitizeAnswers(answers);
  const now = Date.now();
  const durationSec = Math.round((now - startedAt) / 1000);
  const partACorrect = PART_A.filter((q) => safeAnswers[q.id] === ANSWER_KEY[q.id]).length;
  const partBCorrect = PART_B.filter((q) => safeAnswers[q.id] === ANSWER_KEY[q.id]).length;
  const total = partACorrect + partBCorrect;

  const dimensions = DIMENSIONS.map((dimension) => {
    const score = dimension.qids.filter((qid) => safeAnswers[qid] === ANSWER_KEY[qid]).length;
    return {
      ...dimension,
      score,
      ...getDimensionLevel(score),
    };
  });

  const cefrBand = getCEFRBand(total);
  const weakDimensions = dimensions
    .filter((dimension) => dimension.level <= 2)
    .map((dimension) => dimension.name);

  const questionCorrectness = buildQuestionCorrectness(safeAnswers, questions);

  return {
    reportVersion: APP_VERSION,
    candidateInfo,
    submittedAt: now,
    startedAt,
    durationSec,
    autoSubmitted,
    answers: safeAnswers,
    questions,
    scores: {
      partA: { correct: partACorrect, total: 36, pct: percent(partACorrect, 36) },
      partB: { correct: partBCorrect, total: 36, pct: percent(partBCorrect, 36) },
      total: { correct: total, total: 72, pct: percent(total, 72) },
    },
    dimensions,
    cefrBand,
    reportSnapshot: {
      generatedAt: now,
      weakDimensions,
      recommendation: cefrBand.recommendation,
      overallOnlyQids: OVERALL_ONLY_QIDS,
      questionCorrectness,
    },
  };
}
