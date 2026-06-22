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
};

export type Session = {
  sessionToken: string;
  expiresAt: number;
  voucherCode?: string;
  userGroup: string;
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
  userGroup: string;
  percentileRank: number | null;
  cohortSize: number;
  cohortMean: number | null;
  groupPercentileRank: number | null;
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

export type AdminSummary = {
  total: number;
  used: number;
  available: number;
  assigned: number;
};

export type AdminVoucher = {
  code: string;
  used: boolean;
  usedAt: number | null;
  usesAllowed: number;
  useCount: number;
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
  usedVoucherCount: number;
};

export type AdminTeacherCredentialList = {
  credentials: AdminTeacherCredential[];
};
