// Asynchronous AI feedback via the DeepSeek API.
//
//   POST /api/attempts/:id/ai-feedback     start generation (report credentials)
//   GET  /api/attempts/:id/ai-feedback     poll status / fetch stored feedback
//   POST /api/teacher/class-overview       generate a class overview (quota-limited; ?testCode=01|02|03)
//   GET  /api/teacher/class-overviews      overview history for a paper + remaining shared quota
//
// Job model: a D1-backed state machine on attempt_reports.ai_status
// (none | pending | done | failed). POST atomically claims the job and runs it
// in the background via ctx.waitUntil; the frontend polls GET. Up to 3 silent
// DeepSeek attempts per job (exponential backoff); terminal failure stores
// 'failed' so the UI shows a professional message and re-enables the button.
// Success is permanent: one feedback per attempt (409 on regeneration).
//
// The API key is a Worker secret: `npx wrangler secret put DEEPSEEK_API_KEY`
// (production) / `worker/.dev.vars` (local dev). Never in source or wrangler.toml.

import {
  buildClassUserPrompt,
  buildStudentUserPrompt,
  CLASS_PAPER_LABELS,
  CLASS_SYSTEM_PROMPT,
  CORRECTIVE_INSTRUCTION,
  enforceOutputLimits,
  exceedsLimits,
  STUDENT_SYSTEM_PROMPT,
  type AiFeedbackText,
  type ClassPromptContext,
  type ClassTestCode,
} from './aiPrompts';
import { logAiUsage, type AiUsageContext } from './aiUsageLog';
import { REPORT_STRINGS } from './reportI18n';
import { authorizeAttemptAccess } from './reports';
import type { ReportVariablesV1 } from './reportVariables';

export type AiEnv = {
  DB: D1Database;
  DEEPSEEK_API_KEY?: string;
};

type JsonResponder = (body: unknown, init?: ResponseInit, origin?: string) => Response;

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-v4-flash';
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 45_000;
const BACKOFF_MS = [1_000, 4_000];
/** A 'pending' claim older than this is considered dead (worker eviction) and can be reclaimed. */
const STALE_CLAIM_MS = 3 * 60_000;

type AiReportRow = {
  ai_status: string;
  ai_feedback_en: string | null;
  ai_generated_at: number | null;
  ai_claimed_at: number | null;
};

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export async function handleAiRequest(
  request: Request,
  env: AiEnv,
  ctx: ExecutionContext,
  origin: string | undefined,
  json: JsonResponder,
): Promise<Response | null> {
  const url = new URL(request.url);

  const feedbackMatch = url.pathname.match(/^\/api\/attempts\/([0-9a-fA-F-]{8,64})\/ai-feedback$/);
  if (feedbackMatch) {
    if (request.method === 'POST') return startStudentFeedback(request, env, ctx, origin, json, feedbackMatch[1], url);
    if (request.method === 'GET') return getStudentFeedback(request, env, origin, json, feedbackMatch[1], url);
    return json({ error: 'Method not allowed' }, { status: 405 }, origin);
  }

  if (url.pathname === '/api/teacher/class-overview' && request.method === 'POST') {
    return generateClassOverview(request, env, origin, json);
  }
  if (url.pathname === '/api/teacher/class-overviews' && request.method === 'GET') {
    return listClassOverviews(request, env, origin, json);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Student feedback endpoints
// ---------------------------------------------------------------------------

async function startStudentFeedback(
  request: Request,
  env: AiEnv,
  ctx: ExecutionContext,
  origin: string | undefined,
  json: JsonResponder,
  attemptId: string,
  url: URL,
) {
  const { attempt, authorized } = await authorizeAttemptAccess(request, env, attemptId, url);
  if (!attempt) return json({ error: 'Not found' }, { status: 404 }, origin);
  if (!authorized) return json({ error: 'Unauthorized' }, { status: 401 }, origin);
  if (attempt.status !== 'completed') return json({ error: 'ATTEMPT_NOT_COMPLETED' }, { status: 409 }, origin);
  if (!env.DEEPSEEK_API_KEY) return json({ error: 'AI_UNAVAILABLE' }, { status: 503 }, origin);

  const row = await readAiRow(env, attemptId);
  if (!row) return json({ error: 'Report not ready' }, { status: 404 }, origin);
  if (row.ai_status === 'done') {
    return json({ error: 'ALREADY_GENERATED', status: 'done', feedback: feedbackOf(row) }, { status: 409 }, origin);
  }

  // Atomic claim: only one live job per attempt. A stale 'pending' row (dead
  // isolate) can be reclaimed after STALE_CLAIM_MS.
  const now = Date.now();
  const claim = await env.DB.prepare(
    `UPDATE attempt_reports
     SET ai_status = 'pending', ai_claimed_at = ?, ai_attempt_count = ai_attempt_count + 1
     WHERE test_attempt_id = ?
       AND (ai_status IN ('none', 'failed') OR (ai_status = 'pending' AND COALESCE(ai_claimed_at, 0) < ?))`,
  )
    .bind(now, attemptId, now - STALE_CLAIM_MS)
    .run();

  if (!claim.success || claim.meta.changes !== 1) {
    const current = await readAiRow(env, attemptId);
    if (current?.ai_status === 'done') {
      return json({ error: 'ALREADY_GENERATED', status: 'done', feedback: feedbackOf(current) }, { status: 409 }, origin);
    }
    return json({ status: 'pending' }, { status: 202 }, origin);
  }

  ctx.waitUntil(runStudentFeedbackJob(env, attemptId));
  return json({ status: 'pending' }, { status: 202 }, origin);
}

async function getStudentFeedback(
  request: Request,
  env: AiEnv,
  origin: string | undefined,
  json: JsonResponder,
  attemptId: string,
  url: URL,
) {
  const { attempt, authorized } = await authorizeAttemptAccess(request, env, attemptId, url);
  if (!attempt) return json({ error: 'Not found' }, { status: 404 }, origin);
  if (!authorized) return json({ error: 'Unauthorized' }, { status: 401 }, origin);

  const row = await readAiRow(env, attemptId);
  if (!row) return json({ status: 'none', feedback: null }, undefined, origin);

  // Surface a dead claim as failed so the client stops polling and can retry.
  let status = row.ai_status;
  if (status === 'pending' && Date.now() - Number(row.ai_claimed_at ?? 0) > STALE_CLAIM_MS) {
    status = 'failed';
  }

  return json(
    {
      status,
      feedback: status === 'done' ? feedbackOf(row) : null,
      generatedAt: row.ai_generated_at,
    },
    undefined,
    origin,
  );
}

async function readAiRow(env: AiEnv, attemptId: string): Promise<AiReportRow | null> {
  return env.DB.prepare(
    'SELECT ai_status, ai_feedback_en, ai_generated_at, ai_claimed_at FROM attempt_reports WHERE test_attempt_id = ?',
  )
    .bind(attemptId)
    .first<AiReportRow>();
}

const feedbackOf = (row: AiReportRow): AiFeedbackText | null =>
  row.ai_feedback_en ? { en: row.ai_feedback_en } : null;

// ---------------------------------------------------------------------------
// Student feedback job (background)
// ---------------------------------------------------------------------------

/** Count answered vs unanswered rows for AI prompt context. */
async function loadAnswerStats(env: AiEnv, attemptId: string) {
  // MCQ: selected_option. Paper III: text_response and/or saved speaking audio.
  const row = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE
         WHEN selected_option IS NOT NULL THEN 1
         WHEN text_response IS NOT NULL AND TRIM(text_response) != '' THEN 1
         WHEN audio_r2_key IS NOT NULL AND audio_r2_key != '' THEN 1
         ELSE 0
       END) AS answered
     FROM test_attempt_answers
     WHERE test_attempt_id = ?`,
  )
    .bind(attemptId)
    .first<{ total: number; answered: number }>();

  const total = Number(row?.total ?? 0);
  const answered = Number(row?.answered ?? 0);
  return { total, answered, unanswered: Math.max(0, total - answered) };
}

async function runStudentFeedbackJob(env: AiEnv, attemptId: string): Promise<void> {
  try {
    const meta = await env.DB.prepare(
      `SELECT a.id, t.test_code, u.external_ref AS voucher_code
       FROM test_attempts a
       JOIN tests t ON t.id = a.test_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.id = ?`,
    )
      .bind(attemptId)
      .first<{ id: string; test_code: string; voucher_code: string | null }>();

    const report = await env.DB.prepare('SELECT variables FROM attempt_reports WHERE test_attempt_id = ?')
      .bind(attemptId)
      .first<{ variables: string }>();
    if (!report) throw new Error('report row missing');

    const variables = JSON.parse(report.variables) as ReportVariablesV1;
    const answerStats = await loadAnswerStats(env, attemptId);

    const userPrompt = buildStudentUserPrompt({
      variables,
      dimensionLabels: REPORT_STRINGS.dimensionLabels,
      answerStats,
    });

    const usageContext: AiUsageContext = {
      featureType: 'student_feedback',
      attemptId,
      testCode: meta?.test_code ?? variables.testCode,
      voucherCode: meta?.voucher_code ?? null,
    };

    const feedback = await generateWithRetries(env, STUDENT_SYSTEM_PROMPT, userPrompt, usageContext);

    await env.DB.prepare(
      `UPDATE attempt_reports
       SET ai_status = 'done', ai_feedback_en = ?, ai_generated_at = ?
       WHERE test_attempt_id = ?`,
    )
      .bind(feedback.en, Date.now(), attemptId)
      .run();
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'AI feedback job failed',
        attemptId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    await env.DB.prepare("UPDATE attempt_reports SET ai_status = 'failed' WHERE test_attempt_id = ? AND ai_status = 'pending'")
      .bind(attemptId)
      .run();
  }
}

// ---------------------------------------------------------------------------
// Teacher class overview
// ---------------------------------------------------------------------------

type TeacherRow = { key: string; user_group: string; ai_uses_allowed: number; ai_use_count: number };

async function loadTeacher(request: Request, env: AiEnv): Promise<TeacherRow | null> {
  const key = (request.headers.get('X-Teacher-Key') ?? '').trim();
  if (!key) return null;
  return env.DB.prepare('SELECT key, user_group, ai_uses_allowed, ai_use_count FROM teacher_credentials WHERE key = ?')
    .bind(key)
    .first<TeacherRow>();
}

function parseClassTestCode(raw: unknown): ClassTestCode | null {
  if (raw === '01' || raw === '02' || raw === '03') return raw;
  return null;
}

/** Resolve testCode from query string and/or JSON body (POST). Defaults to Paper I. */
async function resolveClassTestCode(request: Request, url: URL): Promise<ClassTestCode | null> {
  const rawQuery = url.searchParams.get('testCode');
  if (rawQuery != null && rawQuery !== '') {
    return parseClassTestCode(rawQuery);
  }

  if (request.method === 'POST') {
    try {
      const body = (await request.clone().json()) as { testCode?: unknown };
      if (body?.testCode != null && body.testCode !== '') {
        return parseClassTestCode(body.testCode);
      }
    } catch {
      // Empty / non-JSON body — fall through to default.
    }
  }

  return '01';
}

async function generateClassOverview(request: Request, env: AiEnv, origin: string | undefined, json: JsonResponder) {
  const teacher = await loadTeacher(request, env);
  if (!teacher) return json({ error: 'Unauthorized' }, { status: 401 }, origin);
  if (!env.DEEPSEEK_API_KEY) return json({ error: 'AI_UNAVAILABLE' }, { status: 503 }, origin);

  const url = new URL(request.url);
  const testCode = await resolveClassTestCode(request, url);
  if (!testCode) return json({ error: 'INVALID_TEST_CODE' }, { status: 400 }, origin);

  const context = await buildClassContext(env, teacher.user_group, testCode);
  if (!context) return json({ error: 'NO_SUBMISSIONS' }, { status: 400 }, origin);

  // Atomic quota decrement; refunded below on terminal AI failure.
  // Shared pool across all papers (ai_use_count / ai_uses_allowed).
  const decrement = await env.DB.prepare(
    'UPDATE teacher_credentials SET ai_use_count = ai_use_count + 1 WHERE key = ? AND ai_use_count < ai_uses_allowed',
  )
    .bind(teacher.key)
    .run();
  if (!decrement.success || decrement.meta.changes !== 1) {
    return json({ error: 'NO_QUOTA' }, { status: 409 }, origin);
  }

  try {
    // Synchronous generation: DeepSeek latency is I/O wall-clock, which the
    // paid Workers plan does not bill or cap as CPU time.
    const usageContext: AiUsageContext = {
      featureType: 'class_overview',
      teacherKey: teacher.key,
      testCode,
    };
    const overview = await generateWithRetries(env, CLASS_SYSTEM_PROMPT, buildClassUserPrompt(context), usageContext);
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO class_overviews (teacher_key, user_group, content_en, content_zh, created_at, test_code) VALUES (?, ?, ?, '', ?, ?)",
    )
      .bind(teacher.key, teacher.user_group, overview.en, now, testCode)
      .run();

    const remaining = Math.max(0, teacher.ai_uses_allowed - (teacher.ai_use_count + 1));
    return json(
      {
        overview: {
          contentEn: overview.en,
          contentZh: '',
          createdAt: now,
          testCode,
        },
        quota: { allowed: teacher.ai_uses_allowed, used: teacher.ai_use_count + 1, remaining },
      },
      undefined,
      origin,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'Class overview generation failed',
        teacherKey: teacher.key,
        testCode,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    await env.DB.prepare('UPDATE teacher_credentials SET ai_use_count = MAX(0, ai_use_count - 1) WHERE key = ?')
      .bind(teacher.key)
      .run();
    return json({ error: 'AI_FAILED' }, { status: 502 }, origin);
  }
}

async function listClassOverviews(request: Request, env: AiEnv, origin: string | undefined, json: JsonResponder) {
  const teacher = await loadTeacher(request, env);
  if (!teacher) return json({ error: 'Unauthorized' }, { status: 401 }, origin);

  const url = new URL(request.url);
  const testCode = await resolveClassTestCode(request, url);
  if (!testCode) return json({ error: 'INVALID_TEST_CODE' }, { status: 400 }, origin);

  const result = await env.DB.prepare(
    `SELECT id, content_en, content_zh, created_at, test_code
     FROM class_overviews
     WHERE teacher_key = ? AND test_code = ?
     ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(teacher.key, testCode)
    .all<{ id: number; content_en: string; content_zh: string; created_at: number; test_code: string }>();

  return json(
    {
      quota: {
        allowed: teacher.ai_uses_allowed,
        used: teacher.ai_use_count,
        remaining: Math.max(0, teacher.ai_uses_allowed - teacher.ai_use_count),
      },
      overviews: (result.results ?? []).map((row) => ({
        id: row.id,
        contentEn: row.content_en,
        contentZh: row.content_zh,
        createdAt: row.created_at,
        testCode: row.test_code,
      })),
    },
    undefined,
    origin,
  );
}

/** Aggregate class statistics for the prompt, scoped to one paper. */
async function buildClassContext(
  env: AiEnv,
  userGroup: string,
  testCode: ClassTestCode,
): Promise<ClassPromptContext | null> {
  return buildAttemptClassContext(env, userGroup, testCode);
}

const PART_LABELS_BY_TEST: Record<ClassTestCode, Record<string, string>> = {
  '01': { '01': 'Part A Applied Grammar', '02': 'Part B Vocabulary' },
  '02': { '01': 'Part A Listening', '02': 'Part B Reading' },
  '03': { '01': 'Part A Speaking', '02': 'Part B Writing' },
};

/** Completed attempts + attempt_reports.variables for the teacher group. */
async function buildAttemptClassContext(
  env: AiEnv,
  userGroup: string,
  testCode: ClassTestCode,
): Promise<ClassPromptContext | null> {
  const result = await env.DB.prepare(
    `SELECT ar.variables
     FROM test_attempts a
     JOIN tests t ON t.id = a.test_id
     LEFT JOIN users u ON u.id = a.user_id
     JOIN attempt_reports ar ON ar.test_attempt_id = a.id
     WHERE a.status = 'completed'
       AND t.test_code = ?
       AND (u.user_group = ? OR a.session_token IN (
         SELECT token FROM sessions s JOIN vouchers v ON v.code = s.voucher_code WHERE v.user_group = ?
       ))`,
  )
    .bind(testCode, userGroup, userGroup)
    .all<{ variables: string }>();

  const rows = result.results ?? [];
  if (rows.length === 0) return null;

  const overallBandMap = new Map<string, number>();
  const partBandMap = new Map<string, number>();
  const dimensionSums = new Map<string, { sum: number; count: number; max: number }>();
  const overallScores: number[] = [];
  let scoreMax = 0;

  for (const row of rows) {
    let vars: ReportVariablesV1;
    try {
      vars = JSON.parse(row.variables) as ReportVariablesV1;
    } catch {
      continue;
    }

    if (vars.bands?.overall?.cefrLabel) {
      const label = vars.bands.overall.cefrLabel;
      overallBandMap.set(label, (overallBandMap.get(label) ?? 0) + 1);
    }

    for (const part of vars.bands?.parts ?? []) {
      if (!part.cefrLabel) continue;
      const key = `${part.partCode}\0${part.cefrLabel}`;
      partBandMap.set(key, (partBandMap.get(key) ?? 0) + 1);
    }

    if (testCode === '01') {
      const partA = vars.scores?.parts?.find((part) => part.partCode === '01');
      if (partA && partA.total > 0) {
        overallScores.push(partA.correct);
        scoreMax = Math.max(scoreMax, partA.total);
      }
    } else if (testCode === '02' && vars.scores?.overall?.total > 0) {
      overallScores.push(vars.scores.overall.correct);
      scoreMax = Math.max(scoreMax, vars.scores.overall.total);
    }

    for (const dim of vars.dimensions ?? []) {
      const agg = dimensionSums.get(dim.key) ?? { sum: 0, count: 0, max: dim.max };
      agg.sum += Number(dim.score);
      agg.count += 1;
      agg.max = dim.max;
      dimensionSums.set(dim.key, agg);
    }
  }

  const n = rows.length;
  let mean: number | null = null;
  let median: number | null = null;
  let stdDev: number | null = null;
  if (overallScores.length > 0) {
    const sorted = [...overallScores].sort((a, b) => a - b);
    const m = sorted.length;
    const avg = sorted.reduce((sum, score) => sum + score, 0) / m;
    mean = Math.round(avg * 10) / 10;
    median =
      m % 2 === 0
        ? Math.round(((sorted[m / 2 - 1] + sorted[m / 2]) / 2) * 10) / 10
        : sorted[Math.floor(m / 2)];
    const variance = sorted.reduce((sum, score) => sum + (score - avg) ** 2, 0) / m;
    stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
  }

  const labels = REPORT_STRINGS.dimensionLabels;
  const partLabels = PART_LABELS_BY_TEST[testCode];

  return {
    testCode,
    paperLabel: CLASS_PAPER_LABELS[testCode],
    userGroup,
    submissionCount: n,
    mean,
    median,
    stdDev,
    scoreMax: scoreMax > 0 ? scoreMax : undefined,
    dimensionMeans: [...dimensionSums.entries()]
      .filter(([, agg]) => agg.count > 0)
      .map(([key, agg]) => ({
        key,
        label: labels[key] ?? key,
        mean: Math.round((agg.sum / agg.count) * 10) / 10,
        max: agg.max,
      })),
    overallBandCounts: [...overallBandMap.entries()]
      .map(([cefrLabel, count]) => ({ cefrLabel, count }))
      .sort((a, b) => b.count - a.count),
    partBandCounts: [...partBandMap.entries()]
      .map(([compound, count]) => {
        const [partCode, cefrLabel] = compound.split('\0');
        return {
          partCode,
          partLabel: partLabels[partCode] ?? `Part ${partCode}`,
          cefrLabel,
          count,
        };
      })
      .sort((a, b) => a.partCode.localeCompare(b.partCode) || b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// DeepSeek client with silent retries
// ---------------------------------------------------------------------------

async function generateWithRetries(
  env: AiEnv,
  systemPrompt: string,
  userPrompt: string,
  usageContext?: AiUsageContext,
): Promise<AiFeedbackText> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]));
    }
    try {
      let feedback = await callDeepSeek(
        env,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        usageContext,
      );
      if (exceedsLimits(feedback)) {
        // One corrective re-prompt, then a deterministic sentence-boundary trim.
        feedback = await callDeepSeek(
          env,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: JSON.stringify(feedback) },
            { role: 'user', content: CORRECTIVE_INSTRUCTION },
          ],
          usageContext,
        );
      }
      return enforceOutputLimits(feedback);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'DeepSeek call failed'));
}

async function callDeepSeek(
  env: AiEnv,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  usageContext?: AiUsageContext,
): Promise<AiFeedbackText> {
  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.5,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`DeepSeek HTTP ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned no content');

  const parsed = JSON.parse(content) as { en?: unknown };
  const en = typeof parsed.en === 'string' ? parsed.en.trim() : '';
  if (!en) throw new Error('DeepSeek response missing the en field');

  if (usageContext && payload.usage) {
    await logAiUsage(env, DEEPSEEK_MODEL, payload.usage, usageContext);
  }

  return { en };
}
