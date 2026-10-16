import type { OptionKey } from './data/questions';

export type Language = 'en' | 'zh-HK';

/** The three audience tabs offered in the marketing nav. */
export type AudiencePage = 'learners' | 'teachers' | 'universities';

/** Every page rendered by MarketingPageLayout. `about` is footer-only, not a tab. */
export type MarketingPage = AudiencePage | 'about';

export type Answers = Record<string, OptionKey | undefined>;

export type CandidateInfo = {
  name: string;
  id: string;
  testDate: number;
  mode: string;
  userGroup: string;
  /** '01' = Paper I (legacy flow), '02' = Paper II. Absent means Paper I. */
  testCode?: string;
};

export type TestAvailability = {
  testCode: string;
  name: string;
  remainingUses: number;
};

export type Session = {
  sessionToken: string;
  expiresAt: number;
  voucherCode?: string;
  userGroup: string;
  tests?: TestAvailability[];
};

export type DimensionScore = {
  id: number;
  key: string;
  name: string;
  short: string;
  qids: string[];
  canonicalNumbers: number[];
  score: number;
  level: 1 | 2 | 3 | 4 | 5;
  levelKey: 'needsWork' | 'developing' | 'good' | 'strong' | 'excellent';
};

// --- Attempts API (DB-backed tests, e.g. Paper II) ---

export type AttemptOptions = { A: string; B: string; C: string; D: string };

export type AttemptResource =
  | { type: 'audio'; resourceId: number; url: string; title: string | null; metadata?: unknown }
  | { type: 'text'; resourceId: number; title: string | null; content: string; metadata?: unknown };

export type AttemptItem = {
  questionCode: string;
  partCode: string;
  canonicalNumber: number;
  prompt: string;
  options: AttemptOptions;
  resourceId: number | null;
  responseType?: 'mcq' | 'speaking' | 'writing';
  meta?: {
    responseType?: string;
    maxSeconds?: number;
    prepSeconds?: number;
    overlay?: unknown;
    instructions?: string;
    wordMin?: number;
    wordMax?: number;
    guidelines?: string;
  };
  dimensionKey?: string | null;
};

export type AttemptInstance = {
  attemptId: string;
  testCode: string;
  testName: string;
  timeLimitSeconds: number;
  items: AttemptItem[];
  resources: Record<number, AttemptResource>;
};

export type BandRef = {
  bandKey: string;
  cefrLabel: string;
  ielts: string | null;
  toefl: string | null;
};

/** Paper I area label from the score scheme: 0–1 Foundation … 5 Proficient. */
export type Paper1AreaLabelKey = 'foundation' | 'emerging' | 'approaching' | 'advanced' | 'proficient';
export type ReportLevelKey = 'needsWork' | 'developing' | 'good' | 'strong' | 'excellent' | Paper1AreaLabelKey;

export type Paper1VocabLevel = 'B1' | 'B2' | 'C1' | 'C2';
export type Paper1PlacementLevel = 'A2' | Paper1VocabLevel;
export type Paper1AdditionalKey = 'uneven' | 'closeToNext' | 'weakerAtTop' | 'even';

/** A row of the Paper I CEFR ladder (A2 or below = 0 … C2 = 7). */
export type Paper1LadderBand = BandRef & { step: number; levelLabel: string };

export type Paper1Area = {
  key: string;
  dimensionCode: string;
  score: number;
  max: number;
  labelKey: Paper1AreaLabelKey;
  priority: boolean;
  overviewCode: string;
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

/** Mirror of the Worker's rv3 Paper I report (worker/src/reportVariables.ts). */
export type Paper1Report = {
  overall: { correct: number; total: number; percent: number; band: Paper1LadderBand };
  partA: {
    correct: number;
    total: number;
    band: Paper1LadderBand;
    areas: Paper1Area[];
    strengthKeys: string[];
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

/** feedback_items row resolved by the report payload. */
export type FeedbackItem = {
  code: string;
  kind: string;
  typeRef: string | null;
  heading: string | null;
  body: string;
  fields: unknown;
};

/** Mirror of the Worker's report variables (worker/src/reportVariables.ts). */
export type ReportVariables = {
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
    levelKey: ReportLevelKey;
  }>;
  bands: {
    overall: BandRef | null;
    parts: Array<BandRef & { partCode: string }>;
  };
  weakDimensionKeys: string[];
  /** Paper I rv3 only. */
  paper1?: Paper1Report;
};

export type AttemptReviewRow = {
  questionCode: string;
  partCode: string;
  canonicalNumber: number;
  /** 1-based served position; null for attempts predating randomization. */
  displayOrder: number | null;
  prompt?: string;
  options?: AttemptOptions;
  correctAnswer?: string;
  selectedOption?: string | null;
  isCorrect?: number | null;
  responseType?: string;
  dimensionKey?: string | null;
  textResponse?: string | null;
  audioUrl?: string | null;
  transcriptText?: string | null;
  aiBandKey?: string | null;
  aiMark?: {
    unanswered?: boolean;
    bandKey?: string;
    cefrLabel?: string;
    strengths?: string[];
    improvements?: string[];
    rationale?: string;
    criteria?: Record<string, string>;
  } | null;
};

export type AttemptReportPayload = {
  variables: ReportVariables | null;
  /** Paper I feedback_items rows keyed by feedback code. */
  feedback?: Record<string, FeedbackItem>;
  review: AttemptReviewRow[];
  gradingStatus?: string;
  attemptId?: string;
  testCode?: string;
};

// --- AI feedback (DeepSeek) ---

export type AiFeedback = { en: string };

export type AiFeedbackStatus = 'none' | 'pending' | 'done' | 'failed';

export type AiFeedbackResponse = {
  status: AiFeedbackStatus;
  feedback: AiFeedback | null;
  generatedAt?: number | null;
};

export type ClassOverview = {
  id: number;
  contentEn: string;
  contentZh: string;
  createdAt: number;
  testCode?: '01' | '02' | '03' | string;
};

export type AiQuota = { allowed: number; used: number; remaining: number };

export type ClassOverviewList = {
  quota: AiQuota;
  overviews: ClassOverview[];
};

export type Test2Result = AttemptReportPayload & { attemptId: string };

export type AdminSummary = {
  total: number;
  used: number;
  available: number;
  assigned: number;
  usedTest1: number;
  usedTest2: number;
  usedTest3: number;
  submissionsTest1: number;
  submissionsTest2: number;
  submissionsTest3: number;
};

export type AdminVoucher = {
  code: string;
  used: boolean;
  usedAt: number | null;
  usesAllowed: number;
  useCount: number;
  useCountTest1: number;
  useCountTest2: number;
  useCountTest3: number;
  userGroup: string;
  educationLevel: string | null;
  remark: string | null;
  soldTo: string | null;
};

export type AdminVoucherList = {
  vouchers: AdminVoucher[];
  limit: number;
  offset: number;
};

export type AiUsageLogEntry = {
  id: number;
  createdAt: number;
  featureType: 'student_feedback' | 'class_overview';
  voucherCode: string | null;
  teacherKey: string | null;
  testCode: string | null;
  attemptId: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

export type AdminAiUsage = {
  totalCalls: number;
  totalSpendingUsd: number;
  logs: AiUsageLogEntry[];
  limit: number;
  offset: number;
};

export type TeacherSession = {
  teacherKey: string;
  userGroup: string;
};

export type TeacherSubmissionRow = {
  submissionId: string;
  attemptId?: string | null;
  submittedAt: number;
  candidateName: string;
  candidateId: string;
  testDate: number;
  totalScore: number;
  partAScore?: number | null;
  partATotal?: number | null;
  partBScore?: number | null;
  partBTotal?: number | null;
  overallPercent?: number | null;
  cefr: string;
  cefrLabel: string;
  weakDimensions: string[];
  recommendation: string;
  /** Generated AI feedback (English), or null when none exists. */
  aiFeedback: string | null;
};

export type TeacherDimensionStat = {
  id: number;
  key: string;
  name: string;
  short: string;
  mean: number | null;
  stdDev: number | null;
};

export type TeacherQuestionStat = {
  qid: string;
  part: 'A' | 'B';
  canonicalNumber: number;
  correctRate: number | null;
  totalResponses: number;
};

export type TeacherPaperAttemptRow = {
  attemptId: string;
  testCode: string;
  testName: string;
  candidateName: string;
  candidateRef: string;
  submittedAt: number | null;
  gradingStatus: string;
  overallBand: string | null;
  partBands: Array<{ partCode: string; cefrLabel: string }>;
};

export type TeacherDashboardData = {
  userGroup: string;
  totalVouchers: number;
  usedVouchers: number;
  totalSubmissions: number;
  overallMean: number | null;
  overallMedian: number | null;
  overallStdDev: number | null;
  partBMean?: number | null;
  scoreBuckets: { label: string; min: number; max: number; count: number }[];
  dimensionStats: TeacherDimensionStat[];
  submissions: TeacherSubmissionRow[];
  questionStats: TeacherQuestionStat[];
  paperAttempts?: TeacherPaperAttemptRow[];
};

export type AdminTeacherCredential = {
  key: string;
  userGroup: string;
  remark: string | null;
  createdAt: number;
  voucherCount: number;
  totalUseCount: number;
  totalUsesAllowed: number;
  totalUseCountTest1: number;
  totalUseCountTest2: number;
  totalUseCountTest3: number;
  aiUsesAllowed: number;
  aiUseCount: number;
};

export type AdminTeacherCredentialList = {
  credentials: AdminTeacherCredential[];
};
