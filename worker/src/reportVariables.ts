// Layout-free report variables stored in attempt_reports.variables (version 'rv1').
// See DATABASE_README.md section 7. No HTML, no layout, no locale-baked narrative
// strings — narratives are resolved from i18n tables at render time (HTML or PDF).

export const REPORT_VARIABLES_VERSION = 'rv1';

export type LevelKey = 'needsWork' | 'developing' | 'good' | 'strong' | 'excellent';

export type BandRef = {
  bandKey: string;
  cefrLabel: string;
  ielts: string | null;
  toefl: string | null;
};

export type ReportVariablesV1 = {
  testCode: string;
  candidate: {
    name: string;
    ref: string;
    userGroup: string;
    educationLevel: string | null;
  };
  attempt: {
    attemptId: string;
    startTime: number;
    endTime: number;
    durationSec: number;
    autoSubmitted: boolean;
  };
  scores: {
    overall: { correct: number; total: number };
    parts: Array<{ partCode: string; skill: string; correct: number; total: number }>;
  };
  dimensions: Array<{
    key: string;
    dimensionCode: string;
    partCode: string;
    score: number;
    max: number;
    levelKey: LevelKey;
  }>;
  bands: {
    overall: BandRef | null;
    parts: Array<BandRef & { partCode: string }>;
  };
  weakDimensionKeys: string[];
  cohort: {
    percentileRank: number | null;
    cohortRank: number | null;
    cohortSize: number;
    cohortMean: number | null;
    groupPercentileRank: number | null;
    groupCohortRank: number | null;
    groupCohortSize: number;
    groupCohortMean: number | null;
  } | null;
};

/** Review row for report rendering: served variant content + outcome + labels. */
export type AttemptAnswerRow = {
  question_code: string;
  selected_option: string | null;
  is_correct: number | null;
  /** 1-based served position; NULL for attempts predating randomization. */
  display_order: number | null;
  canonical_number: number;
  part_code: string;
  part_skill: string | null;
  dimension_key: string | null;
  prompt_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
};
