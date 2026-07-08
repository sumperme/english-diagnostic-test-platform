import type { OptionKey, Question } from './data/questions';
import type { CefrBand } from './data/cefr';

export type Language = 'en' | 'zh-HK';

export type MarketingPage = 'learners' | 'schools' | 'universities' | 'collaboration';

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

export type BackendData = {
  submissionId: string;
  attemptId?: string | null;
  userGroup: string;
  percentileRank: number | null;
  cohortRank: number | null;
  cohortSize: number;
  cohortMean: number | null;
  groupPercentileRank: number | null;
  groupCohortRank: number | null;
  groupCohortSize: number;
  groupCohortMean: number | null;
};

export type ReportResult = {
  reportVersion: string;
  candidateInfo: CandidateInfo;
  submittedAt: number;
  startedAt: number;
  durationSec: number;
  autoSubmitted: boolean;
  answers: Answers;
  questions: Question[];
  scores: {
    partA: { correct: number; total: number; pct: number };
    partB: { correct: number; total: number; pct: number };
    partBVocabI: { correct: number; total: number; pct: number };
    partBVocabII: { correct: number; total: number; pct: number };
    total: { correct: number; total: number; pct: number };
  };
  dimensions: DimensionScore[];
  cefrBand: CefrBand;
  reportSnapshot: {
    generatedAt: number;
    weakDimensions: string[];
    recommendation: string;
    overallOnlyQids: string[];
    questionCorrectness: Record<string, 0 | 1>;
  };
  backendData?: BackendData;
  backendError?: boolean;
};

// --- Attempts API (DB-backed tests, e.g. Paper II) ---

export type AttemptOptions = { A: string; B: string; C: string; D: string };

export type AttemptResource =
  | { type: 'audio'; resourceId: number; url: string; title: string | null }
  | { type: 'text'; resourceId: number; title: string | null; content: string };

export type AttemptItem = {
  questionCode: string;
  partCode: string;
  canonicalNumber: number;
  prompt: string;
  options: AttemptOptions;
  resourceId: number | null;
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

export type ReportLevelKey = 'needsWork' | 'developing' | 'good' | 'strong' | 'excellent';

/** Mirror of the Worker's rv1 report variables (worker/src/reportVariables.ts). */
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

export type AttemptReviewRow = {
  questionCode: string;
  partCode: string;
  canonicalNumber: number;
  /** 1-based served position; null for attempts predating randomization. */
  displayOrder: number | null;
  prompt: string;
  options: AttemptOptions;
  correctAnswer: string;
  selectedOption: string | null;
  isCorrect: number | null;
};

export type AttemptReportPayload = {
  variables: ReportVariables | null;
  review: AttemptReviewRow[];
};

export type Test2Result = AttemptReportPayload & { attemptId: string };

export type AdminSummary = {
  total: number;
  used: number;
  available: number;
  assigned: number;
  usedTest1: number;
  usedTest2: number;
  submissionsTest1: number;
  submissionsTest2: number;
};

export type AdminVoucher = {
  code: string;
  used: boolean;
  usedAt: number | null;
  usesAllowed: number;
  useCount: number;
  useCountTest1: number;
  useCountTest2: number;
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

export type TeacherSession = {
  teacherKey: string;
  userGroup: string;
};

export type TeacherSubmissionRow = {
  submissionId: string;
  submittedAt: number;
  candidateName: string;
  candidateId: string;
  testDate: number;
  totalScore: number;
  cefr: string;
  cefrLabel: string;
  weakDimensions: string[];
  recommendation: string;
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

export type TeacherDashboardData = {
  userGroup: string;
  totalVouchers: number;
  usedVouchers: number;
  totalSubmissions: number;
  overallMean: number | null;
  overallMedian: number | null;
  overallStdDev: number | null;
  scoreBuckets: { label: string; min: number; max: number; count: number }[];
  dimensionStats: TeacherDimensionStat[];
  submissions: TeacherSubmissionRow[];
  questionStats: TeacherQuestionStat[];
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
};

export type AdminTeacherCredentialList = {
  credentials: AdminTeacherCredential[];
};
