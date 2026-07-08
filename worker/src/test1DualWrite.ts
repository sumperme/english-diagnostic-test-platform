// Dual-write legacy Test 1 submissions into the unified attempt tables so
// server-side PDF generation and report retrieval work for Paper I.

import { computePercentileStats } from './admin';
import { REPORT_VARIABLES_VERSION, type LevelKey, type ReportVariablesV1 } from './reportVariables';

const TEST1_ID = 1;

export type Test1SubmissionPayload = {
  scores?: {
    partA?: { correct?: number; total?: number };
    partB?: { correct?: number; total?: number };
    total?: { correct?: number; total?: number };
  };
  dimensions?: Array<{ key: string; score: number; levelKey?: LevelKey }>;
  reportSnapshot?: {
    questionCorrectness?: Record<string, 0 | 1>;
    weakDimensions?: string[];
    recommendation?: string;
  };
  candidateInfo?: {
    name?: string;
    id?: string;
    testDate?: number;
    userGroup?: string;
  };
  submittedAt?: number;
  startedAt?: number;
  durationSec?: number;
  autoSubmitted?: boolean;
  answers?: Record<string, string>;
  /** Questions in the exact shuffled sequence the candidate saw. */
  questions?: Array<{ id?: string }>;
  cefrBand?: {
    cefr?: string;
    label?: string;
    ielts?: string;
    toefl?: string;
  };
};

type BankRow = {
  group_id: number;
  legacy_qid: string | null;
  canonical_number: number;
  part_code: string;
  part_skill: string | null;
  dimension_key: string | null;
  dimension_code: string | null;
  question_id: number;
  question_code: string;
};

type BandRow = {
  band_key: string;
  cefr_label: string;
  ielts_indicative: string | null;
  toefl_indicative: string | null;
};

const levelKeyFromScore = (score: number): LevelKey => {
  if (score <= 1) return 'needsWork';
  if (score === 2) return 'developing';
  if (score === 3) return 'good';
  if (score === 4) return 'strong';
  return 'excellent';
};

export async function dualWriteTest1Attempt(
  env: { DB: D1Database },
  params: {
    sessionToken: string;
    voucherCode: string;
    userGroup: string;
    payload: Test1SubmissionPayload;
    totalScore: number;
    cohortAll: ReturnType<typeof computePercentileStats>;
    cohortGroup: ReturnType<typeof computePercentileStats>;
  },
): Promise<string> {
  const { sessionToken, voucherCode, userGroup, payload, totalScore, cohortAll, cohortGroup } = params;
  const attemptId = crypto.randomUUID();
  const endTime = payload.submittedAt ?? Date.now();
  const startTime = payload.startedAt ?? endTime - (payload.durationSec ?? 0) * 1000;
  const displayName = (payload.candidateInfo?.name ?? '').trim() || 'Anonymous Candidate';

  await env.DB.prepare(
    `INSERT INTO users (external_ref, display_name, user_group, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(external_ref) DO UPDATE SET display_name = excluded.display_name, user_group = excluded.user_group`,
  )
    .bind(voucherCode, displayName, userGroup, endTime)
    .run();

  const user = await env.DB.prepare('SELECT id FROM users WHERE external_ref = ?')
    .bind(voucherCode)
    .first<{ id: number }>();
  if (!user) throw new Error('Failed to upsert user for Test 1 dual-write');

  const bankResult = await env.DB.prepare(
    `SELECT g.id AS group_id, g.legacy_qid, g.canonical_number,
            p.part_code, p.skill AS part_skill,
            d.key AS dimension_key, d.dimension_code,
            q.id AS question_id, q.question_code
     FROM question_groups g
     JOIN test_parts p ON p.id = g.test_part_id
     JOIN questions q ON q.question_group_id = g.id AND q.variant_code = '01'
     LEFT JOIN dimensions d ON d.id = g.dimension_id
     WHERE g.test_id = ?
     ORDER BY g.canonical_number`,
  )
    .bind(TEST1_ID)
    .all<BankRow>();

  const bankRows = bankResult.results ?? [];
  const dimCodeByKey = new Map<string, string>();
  for (const row of bankRows) {
    if (row.dimension_key && row.dimension_code) {
      dimCodeByKey.set(row.dimension_key, row.dimension_code);
    }
  }
  const answers = payload.answers ?? {};
  const correctness = payload.reportSnapshot?.questionCorrectness ?? {};

  // Candidate's shuffled on-screen sequence -> 1-based display_order, so the
  // server-rendered PDF numbers questions exactly as the candidate saw them.
  const orderByQid = new Map<string, number>();
  (payload.questions ?? []).forEach((question, index) => {
    if (question && typeof question.id === 'string' && !orderByQid.has(question.id)) {
      orderByQid.set(question.id, index + 1);
    }
  });

  await env.DB.prepare(
    `INSERT INTO test_attempts (id, user_id, test_id, session_token, start_time, end_time, status, overall_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
  )
    .bind(attemptId, user.id, TEST1_ID, sessionToken, startTime, endTime, totalScore, endTime)
    .run();

  const answerStatements = bankRows
    .filter((row) => row.legacy_qid)
    .map((row) => {
      const qid = row.legacy_qid as string;
      const selected = answers[qid] ?? null;
      const isCorrect =
        qid in correctness ? (correctness[qid] === 1 ? 1 : 0) : selected ? 0 : null;
      return env.DB.prepare(
        `INSERT INTO test_attempt_answers
         (test_attempt_id, question_group_id, question_id, question_code, selected_option, is_correct, answered_at, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        attemptId,
        row.group_id,
        row.question_id,
        row.question_code,
        selected,
        isCorrect,
        endTime,
        orderByQid.get(qid) ?? null,
      );
    });

  if (answerStatements.length > 0) {
    await env.DB.batch(answerStatements);
  }

  const partACorrect = payload.scores?.partA?.correct ?? 0;
  const partATotal = payload.scores?.partA?.total ?? 60;
  const partBCorrect = payload.scores?.partB?.correct ?? 0;
  const partBTotal = payload.scores?.partB?.total ?? 30;
  const overallTotal = payload.scores?.total?.total ?? 90;

  const dimensions = (payload.dimensions ?? []).map((dim) => ({
    key: dim.key,
    dimensionCode: dimCodeByKey.get(dim.key) ?? '00',
    partCode: '01',
    score: dim.score,
    max: 5,
    levelKey: dim.levelKey ?? levelKeyFromScore(dim.score),
  }));

  const weakDimensionKeys = dimensions
    .filter((dim) => dim.levelKey === 'needsWork' || dim.levelKey === 'developing')
    .map((dim) => dim.key);

  const bandRow = await env.DB.prepare(
    `SELECT band_key, cefr_label, ielts_indicative, toefl_indicative
     FROM score_conversion_bands
     WHERE test_id = ? AND test_part_id IS NULL AND ? BETWEEN min_correct AND max_correct`,
  )
    .bind(TEST1_ID, totalScore)
    .first<BandRow>();

  const cefr = payload.cefrBand;
  const overallBand = bandRow
    ? {
        bandKey: bandRow.band_key,
        cefrLabel: bandRow.cefr_label,
        ielts: bandRow.ielts_indicative ?? cefr?.ielts ?? null,
        toefl: bandRow.toefl_indicative ?? cefr?.toefl ?? null,
      }
    : cefr?.cefr
      ? {
          bandKey: 'custom',
          cefrLabel: cefr.cefr,
          ielts: cefr.ielts ?? null,
          toefl: cefr.toefl ?? null,
        }
      : null;

  const variables: ReportVariablesV1 = {
    testCode: '01',
    candidate: {
      name: displayName,
      ref: (payload.candidateInfo?.id ?? '').trim() || 'N/A',
      userGroup,
      educationLevel: null,
    },
    attempt: {
      attemptId,
      startTime,
      endTime,
      durationSec: payload.durationSec ?? Math.max(0, Math.round((endTime - startTime) / 1000)),
      autoSubmitted: payload.autoSubmitted === true,
    },
    scores: {
      overall: { correct: totalScore, total: overallTotal },
      parts: [
        { partCode: '01', skill: 'grammar', correct: partACorrect, total: partATotal },
        { partCode: '02', skill: 'vocabulary', correct: partBCorrect, total: partBTotal },
      ],
    },
    dimensions: dimensions,
    bands: {
      overall: overallBand,
      parts: [],
    },
    weakDimensionKeys,
    cohort: {
      percentileRank: cohortAll.percentileRank,
      cohortRank: cohortAll.cohortRank,
      cohortSize: cohortAll.cohortSize,
      cohortMean: cohortAll.cohortMean,
      groupPercentileRank: cohortGroup.percentileRank,
      groupCohortRank: cohortGroup.cohortRank,
      groupCohortSize: cohortGroup.cohortSize,
      groupCohortMean: cohortGroup.cohortMean,
    },
  };

  await env.DB.prepare(
    'INSERT OR REPLACE INTO attempt_reports (test_attempt_id, report_version, variables, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(attemptId, REPORT_VARIABLES_VERSION, JSON.stringify(variables), endTime)
    .run();

  return attemptId;
}
