// Paper III async grading: Queue consumer + DeepSeek rubric marks + rv1 report.

import { computePercentileStats } from './admin';
import { logAiUsage, type AiUsageContext } from './aiUsageLog';
import {
  BAND_LEVELS_P3,
  MARK_SYSTEM_PROMPT,
  OVERALL_FROM_LEVEL,
  SPEAKING_GENERAL,
  SPEAKING_TASK_RUBRICS,
  WRITING_GENERAL,
  WRITING_TASK_RUBRICS,
  type Paper3Mark,
} from './paper3Rubrics';
import { fetchTranscript } from './paper3Assembly';
import { REPORT_VARIABLES_VERSION, type BandRef, type ReportVariablesV1 } from './reportVariables';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-v4-flash';

export type Paper3GradeEnv = {
  DB: D1Database;
  R2_ASSETS: R2Bucket;
  DEEPSEEK_API_KEY?: string;
  ASSEMBLYAI_API_KEY?: string;
  ASSEMBLYAI_WEBHOOK_SECRET?: string;
  ASSEMBLYAI_WEBHOOK_BASE?: string;
  PAPER3_GRADE?: Queue;
};

export type GradeJobMessage = {
  attemptId: string;
  autoSubmitted?: boolean;
};

type AnswerGradeRow = {
  question_code: string;
  text_response: string | null;
  transcript_text: string | null;
  transcript_status: string;
  assemblyai_transcript_id: string | null;
  ai_mark_json: string | null;
  response_type: string;
  dimension_key: string | null;
  part_code: string;
  part_skill: string | null;
  prompt_text: string;
  canonical_number: number;
};

type UnansweredMark = { unanswered: true; questionCode: string };

function isUnansweredMark(mark: unknown): mark is UnansweredMark {
  return Boolean(mark && typeof mark === 'object' && (mark as UnansweredMark).unanswered === true);
}

function unansweredMark(questionCode: string): UnansweredMark {
  return { unanswered: true, questionCode };
}

function averageBandKey(keys: string[]): BandRef | null {
  if (keys.length === 0) return null;
  const levels = keys.map((k) => BAND_LEVELS_P3[k] ?? 1);
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  const level = Math.min(3, Math.max(1, Math.round(avg)));
  const found = OVERALL_FROM_LEVEL.find((b) => b.level === level) ?? OVERALL_FROM_LEVEL[0];
  return {
    bandKey: found.bandKey,
    cefrLabel: found.cefrLabel,
    ielts: found.ielts,
    toefl: found.toefl,
  };
}

async function callDeepSeekMark(
  env: Paper3GradeEnv,
  system: string,
  user: string,
  usageContext?: AiUsageContext,
): Promise<Paper3Mark> {
  if (!env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`DeepSeek mark failed: ${response.status} ${detail}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  if (usageContext && payload.usage) {
    await logAiUsage(env, DEEPSEEK_MODEL, payload.usage, usageContext).catch(() => undefined);
  }
  const raw = payload.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Paper3Mark;
  if (!parsed.bandKey || !['b1b2', 'c1', 'c2'].includes(parsed.bandKey)) {
    parsed.bandKey = 'b1b2';
  }
  parsed.cefrLabel = parsed.bandKey === 'c2' ? 'C2' : parsed.bandKey === 'c1' ? 'C1' : 'B1/B2';
  return parsed;
}

async function markSpeaking(env: Paper3GradeEnv, row: AnswerGradeRow, attemptId: string): Promise<Paper3Mark> {
  const dimKey = row.dimension_key ?? '';
  const taskRubric = SPEAKING_TASK_RUBRICS[dimKey] ?? '';
  const system = `${MARK_SYSTEM_PROMPT}\n\n${SPEAKING_GENERAL}\n\n${taskRubric}`;
  const user = `Question code: ${row.question_code}
Task prompt (authoritative):
${row.prompt_text}

<student_transcript>
${row.transcript_text ?? ''}
</student_transcript>

Return JSON: {"questionCode":"...","bandKey":"b1b2|c1|c2","cefrLabel":"...","criteria":{"fluency":"...","coherence":"...","lexis":"...","grammar":"...","pronunciation":"..."},"strengths":[],"improvements":[],"rationale":"..."}`;
  return callDeepSeekMark(env, system, user, {
    featureType: 'student_feedback',
    attemptId,
    testCode: '03',
  });
}

async function markWriting(env: Paper3GradeEnv, row: AnswerGradeRow, attemptId: string): Promise<Paper3Mark> {
  const dimKey = row.dimension_key ?? '';
  const taskRubric = WRITING_TASK_RUBRICS[dimKey] ?? '';
  const system = `${MARK_SYSTEM_PROMPT}\n\n${WRITING_GENERAL}\n\n${taskRubric}`;
  const user = `Question code: ${row.question_code}
Task prompt (authoritative):
${row.prompt_text}

<student_essay>
${row.text_response ?? ''}
</student_essay>

Return JSON: {"questionCode":"...","bandKey":"b1b2|c1|c2","cefrLabel":"...","criteria":{"taskAchievement":"...","coherence":"...","lexis":"...","grammar":"...","register":"..."},"strengths":[],"improvements":[],"rationale":"..."}`;
  return callDeepSeekMark(env, system, user, {
    featureType: 'student_feedback',
    attemptId,
    testCode: '03',
  });
}

export async function enqueuePaper3Grade(
  env: Paper3GradeEnv,
  attemptId: string,
  autoSubmitted = false,
): Promise<void> {
  if (env.PAPER3_GRADE) {
    await env.PAPER3_GRADE.send({ attemptId, autoSubmitted } satisfies GradeJobMessage);
    return;
  }
  await gradePaper3Attempt(env, attemptId, autoSubmitted);
}

export async function syncPendingTranscripts(env: Paper3GradeEnv, attemptId: string): Promise<boolean> {
  const pending = await env.DB.prepare(
    `SELECT question_code, assemblyai_transcript_id, transcript_status
     FROM test_attempt_answers
     WHERE test_attempt_id = ? AND assemblyai_transcript_id IS NOT NULL
       AND transcript_status IN ('queued', 'processing')`,
  )
    .bind(attemptId)
    .all<{ question_code: string; assemblyai_transcript_id: string; transcript_status: string }>();

  let allReady = true;
  for (const row of pending.results ?? []) {
    try {
      const t = await fetchTranscript(env, row.assemblyai_transcript_id);
      if (t.status === 'completed') {
        await env.DB.prepare(
          `UPDATE test_attempt_answers
           SET transcript_status = 'completed', transcript_text = ?, transcript_words_json = ?
           WHERE test_attempt_id = ? AND question_code = ?`,
        )
          .bind(t.text ?? '', JSON.stringify(t.words ?? null), attemptId, row.question_code)
          .run();
      } else if (t.status === 'error') {
        await env.DB.prepare(
          `UPDATE test_attempt_answers SET transcript_status = 'error', transcript_text = ?
           WHERE test_attempt_id = ? AND question_code = ?`,
        )
          .bind(t.error ?? 'transcription error', attemptId, row.question_code)
          .run();
      } else {
        allReady = false;
      }
    } catch {
      allReady = false;
    }
  }
  return allReady;
}

export async function gradePaper3Attempt(
  env: Paper3GradeEnv,
  attemptId: string,
  autoSubmitted = false,
): Promise<'pending' | 'done' | 'failed'> {
  const attempt = await env.DB.prepare(
    `SELECT a.id, a.status, a.grading_status, a.start_time, a.end_time, a.test_id,
            t.test_code, u.display_name, u.external_ref, u.user_group, u.education_level
     FROM test_attempts a
     JOIN tests t ON t.id = a.test_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.id = ?`,
  )
    .bind(attemptId)
    .first<{
      id: string;
      status: string;
      grading_status: string;
      start_time: number | null;
      end_time: number | null;
      test_id: number;
      test_code: string;
      display_name: string | null;
      external_ref: string | null;
      user_group: string | null;
      education_level: string | null;
    }>();

  if (!attempt || attempt.test_code !== '03') return 'failed';
  if (attempt.grading_status === 'done') return 'done';

  await syncPendingTranscripts(env, attemptId);

  const rows = await env.DB.prepare(
    `SELECT a.question_code, a.text_response, a.transcript_text, a.transcript_status,
            a.assemblyai_transcript_id, a.ai_mark_json,
            g.response_type, d.key AS dimension_key, p.part_code, p.skill AS part_skill,
            q.prompt_text, g.canonical_number
     FROM test_attempt_answers a
     JOIN question_groups g ON g.id = a.question_group_id
     JOIN questions q ON q.id = a.question_id
     JOIN test_parts p ON p.id = g.test_part_id
     LEFT JOIN dimensions d ON d.id = g.dimension_id
     WHERE a.test_attempt_id = ?
     ORDER BY g.canonical_number`,
  )
    .bind(attemptId)
    .all<AnswerGradeRow>();

  const answers = rows.results ?? [];
  const speaking = answers.filter((r) => r.response_type === 'speaking');
  const writing = answers.filter((r) => r.response_type === 'writing');

  for (const row of speaking) {
    if (
      row.assemblyai_transcript_id &&
      (row.transcript_status === 'queued' || row.transcript_status === 'processing')
    ) {
      return 'pending';
    }
  }

  try {
    for (const row of speaking) {
      if (row.ai_mark_json) continue;
      const transcriptOk =
        row.transcript_status === 'completed' && (row.transcript_text ?? '').trim().length > 0;
      if (!transcriptOk) {
        await env.DB.prepare(
          `UPDATE test_attempt_answers SET ai_mark_json = ?, ai_band_key = NULL WHERE test_attempt_id = ? AND question_code = ?`,
        )
          .bind(JSON.stringify(unansweredMark(row.question_code)), attemptId, row.question_code)
          .run();
        continue;
      }
      const mark = await markSpeaking(env, row, attemptId);
      mark.questionCode = row.question_code;
      await env.DB.prepare(
        `UPDATE test_attempt_answers SET ai_mark_json = ?, ai_band_key = ? WHERE test_attempt_id = ? AND question_code = ?`,
      )
        .bind(JSON.stringify(mark), mark.bandKey, attemptId, row.question_code)
        .run();
    }

    for (const row of writing) {
      if (row.ai_mark_json) continue;
      const hasText = (row.text_response ?? '').trim().length > 0;
      if (!hasText) {
        await env.DB.prepare(
          `UPDATE test_attempt_answers SET ai_mark_json = ?, ai_band_key = NULL WHERE test_attempt_id = ? AND question_code = ?`,
        )
          .bind(JSON.stringify(unansweredMark(row.question_code)), attemptId, row.question_code)
          .run();
        continue;
      }
      const mark = await markWriting(env, row, attemptId);
      mark.questionCode = row.question_code;
      await env.DB.prepare(
        `UPDATE test_attempt_answers SET ai_mark_json = ?, ai_band_key = ? WHERE test_attempt_id = ? AND question_code = ?`,
      )
        .bind(JSON.stringify(mark), mark.bandKey, attemptId, row.question_code)
        .run();
    }

    const refreshed = await env.DB.prepare(
      `SELECT a.question_code, a.ai_band_key, a.ai_mark_json, g.response_type, d.key AS dimension_key,
              p.part_code, p.skill AS part_skill, g.canonical_number
       FROM test_attempt_answers a
       JOIN question_groups g ON g.id = a.question_group_id
       JOIN test_parts p ON p.id = g.test_part_id
       LEFT JOIN dimensions d ON d.id = g.dimension_id
       WHERE a.test_attempt_id = ?
       ORDER BY g.canonical_number`,
    )
      .bind(attemptId)
      .all<{
        question_code: string;
        ai_band_key: string | null;
        ai_mark_json: string | null;
        response_type: string;
        dimension_key: string | null;
        part_code: string;
        part_skill: string | null;
        canonical_number: number;
      }>();

    const all = refreshed.results ?? [];
    const parseMark = (raw: string | null): unknown => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };
    const isAnswered = (r: (typeof all)[0]) => {
      if (!r.ai_band_key) return false;
      return !isUnansweredMark(parseMark(r.ai_mark_json));
    };

    const speakAnswered = all.filter((r) => r.response_type === 'speaking' && isAnswered(r));
    const writeAnswered = all.filter((r) => r.response_type === 'writing' && isAnswered(r));
    const speakBands = speakAnswered.map((r) => r.ai_band_key!).filter(Boolean);
    const writeBands = writeAnswered.map((r) => r.ai_band_key!).filter(Boolean);
    const partA = averageBandKey(speakBands);
    const partB = averageBandKey(writeBands);
    const overall = averageBandKey([...speakBands, ...writeBands]);

    const speakTotal = all.filter((r) => r.response_type === 'speaking').length;
    const writeTotal = all.filter((r) => r.response_type === 'writing').length;
    const answeredCount = speakAnswered.length + writeAnswered.length;

    const overallScoreProxy = all.reduce((sum, r) => {
      if (!isAnswered(r) || !r.ai_band_key) return sum;
      return sum + (BAND_LEVELS_P3[r.ai_band_key] ?? 0);
    }, 0);

    const userGroup = attempt.user_group ?? 'General Learner';
    const allStats = await env.DB.prepare(
      `SELECT COUNT(*) as cohortSize, AVG(overall_score) as cohortMean,
              SUM(CASE WHEN overall_score > ? THEN 1 ELSE 0 END) as strictlyAbove
       FROM test_attempts WHERE test_id = ? AND status = 'completed' AND id != ?`,
    )
      .bind(overallScoreProxy, attempt.test_id, attemptId)
      .first<{ cohortSize: number; cohortMean: number | null; strictlyAbove: number }>();
    const groupStats = await env.DB.prepare(
      `SELECT COUNT(*) as cohortSize, AVG(a.overall_score) as cohortMean,
              SUM(CASE WHEN a.overall_score > ? THEN 1 ELSE 0 END) as strictlyAbove
       FROM test_attempts a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.test_id = ? AND a.status = 'completed' AND a.id != ? AND u.user_group = ?`,
    )
      .bind(overallScoreProxy, attempt.test_id, attemptId, userGroup)
      .first<{ cohortSize: number; cohortMean: number | null; strictlyAbove: number }>();

    await env.DB.prepare(`UPDATE test_attempts SET overall_score = ? WHERE id = ?`)
      .bind(overallScoreProxy, attemptId)
      .run();

    const cohortAll = computePercentileStats({
      cohortSize: Number(allStats?.cohortSize ?? 0) + 1,
      cohortMean: allStats?.cohortMean ?? null,
      strictlyAbove: Number(allStats?.strictlyAbove ?? 0),
    });
    const cohortGroup = computePercentileStats({
      cohortSize: Number(groupStats?.cohortSize ?? 0) + 1,
      cohortMean: groupStats?.cohortMean ?? null,
      strictlyAbove: Number(groupStats?.strictlyAbove ?? 0),
    });

    const endTime = attempt.end_time ?? Date.now();
    const startTime = attempt.start_time ?? endTime;
    const partBands: Array<BandRef & { partCode: string }> = [];
    if (partA) partBands.push({ partCode: '01', ...partA });
    if (partB) partBands.push({ partCode: '02', ...partB });

    const variables: ReportVariablesV1 = {
      testCode: '03',
      candidate: {
        name: attempt.display_name ?? 'Candidate',
        ref: attempt.external_ref ?? '',
        userGroup,
        educationLevel: attempt.education_level,
      },
      attempt: {
        attemptId,
        startTime,
        endTime,
        durationSec: Math.max(0, Math.round((endTime - startTime) / 1000)),
        autoSubmitted,
      },
      scores: {
        overall: { correct: answeredCount, total: all.length },
        parts: [
          { partCode: '01', skill: 'speaking', correct: speakAnswered.length, total: speakTotal },
          { partCode: '02', skill: 'writing', correct: writeAnswered.length, total: writeTotal },
        ],
      },
      dimensions: [],
      bands: {
        overall,
        parts: partBands,
      },
      weakDimensionKeys: [],
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

    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO attempt_reports (test_attempt_id, report_version, variables, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(test_attempt_id) DO UPDATE SET report_version = excluded.report_version, variables = excluded.variables`,
    )
      .bind(attemptId, REPORT_VARIABLES_VERSION, JSON.stringify(variables), now)
      .run();

    await env.DB.prepare(`UPDATE test_attempts SET grading_status = 'done' WHERE id = ?`).bind(attemptId).run();
    return 'done';
  } catch (error) {
    console.error('Paper3 grading failed', error);
    await env.DB.prepare(`UPDATE test_attempts SET grading_status = 'failed' WHERE id = ?`).bind(attemptId).run();
    return 'failed';
  }
}

export async function handlePaper3Queue(batch: MessageBatch<GradeJobMessage>, env: Paper3GradeEnv): Promise<void> {
  for (const message of batch.messages) {
    const attemptId = message.body?.attemptId;
    if (!attemptId) {
      message.ack();
      continue;
    }
    const result = await gradePaper3Attempt(env, attemptId, message.body.autoSubmitted === true);
    if (result === 'pending') {
      message.retry({ delaySeconds: 15 });
    } else {
      message.ack();
    }
  }
}
