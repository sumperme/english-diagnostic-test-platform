import type { OptionKey } from '../data/questions';
import type { Answers, DimensionScore } from '../types';

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

export const TOTAL_SECS = 3600;

export const getDimensionLevel = (score: number): Pick<DimensionScore, 'level' | 'levelKey'> => {
  if (score <= 1) return { level: 1, levelKey: 'needsWork' };
  if (score === 2) return { level: 2, levelKey: 'developing' };
  if (score === 3) return { level: 3, levelKey: 'good' };
  if (score === 4) return { level: 4, levelKey: 'strong' };
  return { level: 5, levelKey: 'excellent' };
};

export const scoreBarColor = (score: number, max: number) => {
  const ratio = max > 0 ? score / max : 0;
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
