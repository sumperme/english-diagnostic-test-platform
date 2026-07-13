// Asynchronous AI feedback via the DeepSeek API.
//
//   POST /api/attempts/:id/ai-feedback     start generation (report credentials)
//   GET  /api/attempts/:id/ai-feedback     poll status / fetch stored feedback
//   POST /api/teacher/class-overview       generate a class overview (quota-limited)
//   GET  /api/teacher/class-overviews      overview history + remaining quota
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
  CLASS_SYSTEM_PROMPT,
  CORRECTIVE_INSTRUCTION,
  enforceOutputLimits,
  exceedsLimits,
  STUDENT_SYSTEM_PROMPT,
  type BilingualFeedback,
  type ClassPromptContext,
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
const DEEPSEEK_MODEL = 'deepseek-chat';
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 45_000;
const BACKOFF_MS = [1_000, 4_000];
/** A 'pending' claim older than this is considered dead (worker eviction) and can be reclaimed. */
const STALE_CLAIM_MS = 3 * 60_000;

type AiReportRow = {
  ai_status: string;
  ai_feedback_en: string | null;
  ai_feedback_zh: string | null;
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
    'SELECT ai_status, ai_feedback_en, ai_feedback_zh, ai_generated_at, ai_claimed_at FROM attempt_reports WHERE test_attempt_id = ?',
  )
    .bind(attemptId)
    .first<AiReportRow>();
}

const feedbackOf = (row: AiReportRow): BilingualFeedback | null =>
  row.ai_feedback_en && row.ai_feedback_zh ? { en: row.ai_feedback_en, zhHK: row.ai_feedback_zh } : null;

// ---------------------------------------------------------------------------
// Student feedback job (background)
// ---------------------------------------------------------------------------

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
    const vocabSplit = variables.testCode === '01' ? await loadVocabSplit(env, attemptId) : undefined;

    const userPrompt = buildStudentUserPrompt({
      variables,
      dimensionLabels: REPORT_STRINGS.en.dimensionLabels,
      vocabSplit,
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
       SET ai_status = 'done', ai_feedback_en = ?, ai_feedback_zh = ?, ai_generated_at = ?
       WHERE test_attempt_id = ?`,
    )
      .bind(feedback.en, feedback.zhHK, Date.now(), attemptId)
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

/** Test 1: Part B vocabulary split (common Q61-75 vs specialized Q76-90). */
async function loadVocabSplit(env: AiEnv, attemptId: string) {
  const row = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN g.canonical_number BETWEEN 61 AND 75 AND a.is_correct = 1 THEN 1 ELSE 0 END) AS common_correct,
       SUM(CASE WHEN g.canonical_number BETWEEN 61 AND 75 THEN 1 ELSE 0 END) AS common_total,
       SUM(CASE WHEN g.canonical_number BETWEEN 76 AND 90 AND a.is_correct = 1 THEN 1 ELSE 0 END) AS specialized_correct,
       SUM(CASE WHEN g.canonical_number BETWEEN 76 AND 90 THEN 1 ELSE 0 END) AS specialized_total
     FROM test_attempt_answers a
     JOIN question_groups g ON g.id = a.question_group_id
     WHERE a.test_attempt_id = ?`,
  )
    .bind(attemptId)
    .first<{ common_correct: number; common_total: number; specialized_correct: number; specialized_total: number }>();

  if (!row || Number(row.common_total ?? 0) === 0) return undefined;
  return {
    commonCorrect: Number(row.common_correct ?? 0),
    commonTotal: Number(row.common_total ?? 0),
    specializedCorrect: Number(row.specialized_correct ?? 0),
    specializedTotal: Number(row.specialized_total ?? 0),
  };
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

async function generateClassOverview(request: Request, env: AiEnv, origin: string | undefined, json: JsonResponder) {
  const teacher = await loadTeacher(request, env);
  if (!teacher) return json({ error: 'Unauthorized' }, { status: 401 }, origin);
  if (!env.DEEPSEEK_API_KEY) return json({ error: 'AI_UNAVAILABLE' }, { status: 503 }, origin);

  const context = await buildClassContext(env, teacher.user_group);
  if (!context) return json({ error: 'NO_SUBMISSIONS' }, { status: 400 }, origin);

  // Atomic quota decrement; refunded below on terminal AI failure.
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
    };
    const overview = await generateWithRetries(env, CLASS_SYSTEM_PROMPT, buildClassUserPrompt(context), usageContext);
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO class_overviews (teacher_key, user_group, content_en, content_zh, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(teacher.key, teacher.user_group, overview.en, overview.zhHK, now)
      .run();

    const remaining = Math.max(0, teacher.ai_uses_allowed - (teacher.ai_use_count + 1));
    return json(
      {
        overview: { contentEn: overview.en, contentZh: overview.zhHK, createdAt: now },
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

  const result = await env.DB.prepare(
    'SELECT id, content_en, content_zh, created_at FROM class_overviews WHERE teacher_key = ? ORDER BY created_at DESC LIMIT 50',
  )
    .bind(teacher.key)
    .all<{ id: number; content_en: string; content_zh: string; created_at: number }>();

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
      })),
    },
    undefined,
    origin,
  );
}

/** Aggregate Test 1 class statistics for the prompt (mirrors the teacher dashboard). */
async function buildClassContext(env: AiEnv, userGroup: string): Promise<ClassPromptContext | null> {
  const result = await env.DB.prepare('SELECT total_score, dimension_scores FROM submissions WHERE user_group = ?')
    .bind(userGroup)
    .all<{ total_score: number; dimension_scores: string | null }>();

  const rows = result.results ?? [];
  if (rows.length === 0) return null;

  const scores = rows.map((row) => Number(row.total_score)).sort((a, b) => a - b);
  const n = scores.length;
  const mean = scores.reduce((sum, score) => sum + score, 0) / n;
  const median = n % 2 === 0 ? (scores[n / 2 - 1] + scores[n / 2]) / 2 : scores[Math.floor(n / 2)];
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / n;

  const dimensionSums = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    if (!row.dimension_scores) continue;
    try {
      const parsed = JSON.parse(row.dimension_scores) as Record<string, number>;
      for (const [key, score] of Object.entries(parsed)) {
        const agg = dimensionSums.get(key) ?? { sum: 0, count: 0 };
        agg.sum += Number(score);
        agg.count += 1;
        dimensionSums.set(key, agg);
      }
    } catch {
      // Skip malformed rows.
    }
  }

  const labels = REPORT_STRINGS.en.dimensionLabels;
  const dimensionMeans = [...dimensionSums.entries()]
    .filter(([, agg]) => agg.count > 0)
    .map(([key, agg]) => ({ key, label: labels[key] ?? key, mean: Math.round((agg.sum / agg.count) * 10) / 10 }));

  return {
    userGroup,
    submissionCount: n,
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    dimensionMeans,
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
): Promise<BilingualFeedback> {
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
): Promise<BilingualFeedback> {
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
    throw new Error(`DeepSeek HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned no content');

  const parsed = JSON.parse(content) as { en?: unknown; zhHK?: unknown };
  const en = typeof parsed.en === 'string' ? parsed.en.trim() : '';
  const zhHK = typeof parsed.zhHK === 'string' ? parsed.zhHK.trim() : '';
  if (!en || !zhHK) throw new Error('DeepSeek response missing en/zhHK fields');

  if (usageContext && payload.usage) {
    await logAiUsage(env, DEEPSEEK_MODEL, payload.usage, usageContext);
  }

  return { en, zhHK };
}
