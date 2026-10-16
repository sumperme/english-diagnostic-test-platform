// Layout-free report variables stored in attempt_reports.variables.
// See docs/DATABASE_README.md section 7. No HTML, no layout, no rendered narrative — report
// copy is resolved at render time (i18n labels + feedback_items rows keyed by feedback code).
//
// rv1  — Papers II / III.
// rv3  — Paper I (Oct 2026 scheme): area labels, feedback codes, Part A / Part B / overall CEFR ladder.

export const REPORT_VARIABLES_VERSION = 'rv1';
export const PAPER1_REPORT_VARIABLES_VERSION = 'rv3';

export type LegacyLevelKey = 'needsWork' | 'developing' | 'good' | 'strong' | 'excellent';
/** Paper I area label from the score scheme: 0–1 Foundation … 5 Proficient. */
export type Paper1AreaLabelKey = 'foundation' | 'emerging' | 'approaching' | 'advanced' | 'proficient';
export type LevelKey = LegacyLevelKey | Paper1AreaLabelKey;

export type Paper1VocabLevel = 'B1' | 'B2' | 'C1' | 'C2';
/** Part B placement: the highest level whose threshold is met with every lower level met. */
export type Paper1PlacementLevel = 'A2' | Paper1VocabLevel;
export type Paper1AdditionalKey = 'uneven' | 'closeToNext' | 'weakerAtTop' | 'even';

export type BandRef = {
  bandKey: string;
  cefrLabel: string;
  ielts: string | null;
  toefl: string | null;
};

/** A row of the Paper I CEFR ladder (A2 or below = 0 … C2 = 7). */
export type Paper1LadderBand = BandRef & { step: number; levelLabel: string };

export type ReportDimension = {
  key: string;
  dimensionCode: string;
  partCode: string;
  score: number;
  max: number;
  levelKey: LevelKey;
};

export type Paper1Area = {
  key: string;
  dimensionCode: string;
  score: number;
  max: number;
  labelKey: Paper1AreaLabelKey;
  /** Score of 3 or below. */
  priority: boolean;
  /** feedback_items code of the area overview for this score band (01-01-SS-000-00-AA). */
  overviewCode: string;
  /** Served variants answered wrongly or left blank, in category A–E order. */
  missedQuestionCodes: string[];
};

export type Paper1PartBLevel = {
  level: Paper1VocabLevel;
  correct: number;
  total: number;
  threshold: number;
  met: boolean;
  percent: number;
};

export type Paper1Report = {
  overall: { correct: number; total: number; percent: number; band: Paper1LadderBand };
  partA: {
    correct: number;
    total: number;
    band: Paper1LadderBand;
    areas: Paper1Area[];
    /** Score 4–5, by score descending then area number. */
    strengthKeys: string[];
    /** Score 0–3, by score ascending then area number. */
    growthKeys: string[];
    concludingCode: string;
  };
  partB: {
    correct: number;
    total: number;
    /** Counts are scoring inputs only — reports show the percentages. */
    levels: Paper1PartBLevel[];
    placement: Paper1PlacementLevel;
    band: Paper1LadderBand;
    placementCode: string;
    additional: { key: Paper1AdditionalKey; code: string; level: Paper1PlacementLevel | null } | null;
    roadmapCode: string;
  };
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
  dimensions: ReportDimension[];
  bands: {
    overall: BandRef | null;
    parts: Array<BandRef & { partCode: string }>;
  };
  weakDimensionKeys: string[];
  /** Paper I rv3 only. */
  paper1?: Paper1Report;
};

/** feedback_items row as sent to renderers. */
export type FeedbackItem = {
  code: string;
  kind: string;
  typeRef: string | null;
  heading: string | null;
  body: string;
  fields: unknown;
};
