import { handleAdminRequest } from './admin';
import { handleAiRequest } from './aiFeedback';
import { handleAssetRequest } from './assets';
import { handleAttemptRequest } from './attempts';
import { handlePaper3Queue, type GradeJobMessage } from './paper3Grading';
import { handlePaper3Route } from './paper3Routes';
import { handleReportRequest } from './reports';
import type { ReportVariablesV1 } from './reportVariables';

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  R2_ASSETS: R2Bucket;
  PAPER3_GRADE?: Queue;
  ALLOWED_ORIGIN?: string;
  SESSION_TTL_SECONDS?: string;
  ADMIN_PASSWORD?: string;
  /** Secret: `npx wrangler secret put DEEPSEEK_API_KEY` / worker/.dev.vars locally. */
  DEEPSEEK_API_KEY?: string;
  /** Secret: `npx wrangler secret put ASSEMBLYAI_API_KEY` */
  ASSEMBLYAI_API_KEY?: string;
  /** Secret: webhook auth header value for AssemblyAI callbacks (X-Edt-Webhook-Secret) */
  ASSEMBLYAI_WEBHOOK_SECRET?: string;
  /**
   * Public HTTPS origin for AssemblyAI webhook_url (production only).
   * Unset locally — grading queue polls transcript status instead.
   */
  ASSEMBLYAI_WEBHOOK_BASE?: string;
};

type VerifyVoucherRequest = {
  code?: string;
};

type TeacherVerifyRequest = {
  key?: string;
};

const DEFAULT_USER_GROUP = 'General Learner';

const json = (body: unknown, init: ResponseInit = {}, origin?: string) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      ...corsHeaders(origin),
      ...init.headers,
    },
  });

const corsHeaders = (origin?: string) => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Password,X-Teacher-Key',
});

const normalizeCode = (code: string) => code.trim().toUpperCase();

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function getAllowedOrigin(request: Request, env: Env) {
  const requestOrigin = request.headers.get('Origin');
  const configured = env.ALLOWED_ORIGIN;
  if (!requestOrigin) return configured;
  if (!configured || configured === '*' || configured === requestOrigin) return requestOrigin;
  return configured;
}

function unauthorized(origin?: string) {
  return json({ error: 'Unauthorized' }, { status: 401 }, origin);
}

async function verifyVoucher(request: Request, env: Env, origin?: string) {
  const body = await readJson<VerifyVoucherRequest>(request);
  const code = body.code ? normalizeCode(body.code) : '';
  if (!code) {
    return json({ error: 'Voucher code is required' }, { status: 400 }, origin);
  }

  const voucher = await env.DB.prepare(
    'SELECT code, used_at, user_group, uses_allowed, use_count FROM vouchers WHERE code = ?',
  )
    .bind(code)
    .first<{
      code: string;
      used_at: number | null;
      user_group: string | null;
      uses_allowed: number;
      use_count: number;
    }>();

  if (!voucher) {
    return json({ error: 'NOT_FOUND' }, { status: 401 }, origin);
  }

  const usesAllowed = Number(voucher.uses_allowed ?? 1);

  const tests = await getTestAvailability(env.DB, code, usesAllowed);

  if (tests.length > 0 && tests.every((test) => test.remainingUses <= 0)) {
    return json({ error: 'ALREADY_USED' }, { status: 401 }, origin);
  }

  const now = Date.now();
  const sessionToken = crypto.randomUUID();
  const ttl = Number(env.SESSION_TTL_SECONDS ?? 7200) * 1000;
  const expiresAt = now + ttl;

  await env.DB.prepare(
    'UPDATE vouchers SET used_at = COALESCE(used_at, ?), used_by_session = ? WHERE code = ?',
  )
    .bind(now, sessionToken, code)
    .run();

  await env.DB.prepare('INSERT INTO sessions (token, voucher_code, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionToken, code, now, expiresAt)
    .run();

  const userGroup = voucher.user_group?.trim() || DEFAULT_USER_GROUP;

  return json({ sessionToken, expiresAt, voucherCode: code, userGroup, tests }, undefined, origin);
}

/**
 * Per-test remaining uses for a voucher: uses_allowed applies to EACH active
 * test separately. Usage is consumed at submit time, not at login.
 */
async function getTestAvailability(db: D1Database, voucherCode: string, usesAllowed: number) {
  const testsResult = await db
    .prepare(
      `SELECT t.test_code AS testCode, t.name, COALESCE(vtu.use_count, 0) AS used
       FROM tests t
       LEFT JOIN voucher_test_usage vtu ON vtu.voucher_code = ? AND vtu.test_id = t.id
       WHERE t.status = 'active'
       ORDER BY t.test_code`,
    )
    .bind(voucherCode)
    .all<{ testCode: string; name: string; used: number }>();

  return (testsResult.results ?? []).map((row) => ({
    testCode: row.testCode,
    name: row.name,
    remainingUses: Math.max(0, usesAllowed - Number(row.used ?? 0)),
  }));
}

/** Fresh per-test availability for the active session (InfoScreen refresh). */
async function sessionTests(request: Request, env: Env, origin?: string) {
  const session = await getSession(request, env);
  if (!session) return unauthorized(origin);

  const usesAllowed = Number(session.uses_allowed ?? 1);
  const tests = await getTestAvailability(env.DB, session.voucher_code, usesAllowed);
  return json({ tests }, undefined, origin);
}

/**
 * Consume one voucher use for a specific test. Returns false when the per-test
 * limit is already reached. vouchers.use_count keeps the cross-test total.
 */
export async function consumeVoucherUse(
  db: D1Database,
  voucherCode: string,
  testId: number,
  usesAllowed: number,
  sessionToken: string,
): Promise<boolean> {
  const now = Date.now();
  await db
    .prepare('INSERT OR IGNORE INTO voucher_test_usage (voucher_code, test_id, use_count) VALUES (?, ?, 0)')
    .bind(voucherCode, testId)
    .run();

  const update = await db
    .prepare(
      'UPDATE voucher_test_usage SET use_count = use_count + 1 WHERE voucher_code = ? AND test_id = ? AND use_count < ?',
    )
    .bind(voucherCode, testId, usesAllowed)
    .run();

  if (!update.success || update.meta.changes !== 1) return false;

  await db
    .prepare(
      'UPDATE vouchers SET use_count = use_count + 1, used_at = COALESCE(used_at, ?), used_by_session = ? WHERE code = ?',
    )
    .bind(now, sessionToken, voucherCode)
    .run();
  return true;
}

export async function getSession(request: Request, env: { DB: D1Database }) {
  const auth = request.headers.get('Authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1];
  const row = await env.DB.prepare(
    'SELECT s.token, s.expires_at, s.voucher_code, v.user_group, v.uses_allowed, v.use_count FROM sessions s LEFT JOIN vouchers v ON v.code = s.voucher_code WHERE s.token = ?',
  )
    .bind(token)
    .first<{
      token: string;
      expires_at: number;
      voucher_code: string;
      user_group: string | null;
      uses_allowed: number | null;
      use_count: number | null;
    }>();

  if (!row || row.expires_at <= Date.now()) return null;
  return row;
}

async function teacherVerify(request: Request, env: Env, origin?: string) {
  const body = await readJson<TeacherVerifyRequest>(request);
  const key = (body.key ?? '').trim();
  if (!key) {
    return json({ error: 'Teacher key is required' }, { status: 400 }, origin);
  }

  const row = await env.DB.prepare(
    'SELECT key, user_group FROM teacher_credentials WHERE key = ?',
  )
    .bind(key)
    .first<{ key: string; user_group: string }>();

  if (!row) {
    return json({ error: 'INVALID_KEY' }, { status: 401 }, origin);
  }

  return json({ userGroup: row.user_group }, undefined, origin);
}

function computeStats(values: number[]): { mean: number | null; median: number | null; stdDev: number | null } {
  if (values.length === 0) return { mean: null, median: null, stdDev: null };
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sorted = [...values].sort((a, b) => a - b);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
  };
}

async function teacherDashboard(request: Request, env: Env, origin?: string) {
  const teacherKey = (request.headers.get('X-Teacher-Key') ?? '').trim();
  if (!teacherKey) return unauthorized(origin);

  const credRow = await env.DB.prepare(
    'SELECT key, user_group FROM teacher_credentials WHERE key = ?',
  )
    .bind(teacherKey)
    .first<{ key: string; user_group: string }>();

  if (!credRow) return unauthorized(origin);

  const userGroup = credRow.user_group;

  // Voucher counts
  const voucherStats = await env.DB.prepare(
    `SELECT COUNT(*) as total, SUM(CASE WHEN use_count > 0 THEN 1 ELSE 0 END) as used
     FROM vouchers WHERE user_group = ?`,
  )
    .bind(userGroup)
    .first<{ total: number; used: number }>();

  const attemptsResult = await env.DB.prepare(
    `SELECT a.id AS attempt_id, a.end_time, ar.variables, ar.ai_status, ar.ai_feedback_en
     FROM test_attempts a
     JOIN tests t ON t.id = a.test_id
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN attempt_reports ar ON ar.test_attempt_id = a.id
     WHERE a.status = 'completed' AND t.test_code = '01'
       AND (u.user_group = ? OR a.session_token IN (
         SELECT token FROM sessions s JOIN vouchers v ON v.code = s.voucher_code WHERE v.user_group = ?
       ))
     ORDER BY a.end_time DESC`,
  )
    .bind(userGroup, userGroup)
    .all<{
      attempt_id: string;
      end_time: number | null;
      variables: string | null;
      ai_status: string | null;
      ai_feedback_en: string | null;
    }>();

  const attemptRows = attemptsResult.results ?? [];

  const dimensionResult = await env.DB.prepare(
    `SELECT d.id, d.key, d.name, d.short
     FROM dimensions d
     JOIN test_parts p ON p.id = d.test_part_id
     JOIN tests t ON t.id = p.test_id
     WHERE t.test_code = '01' AND p.part_code = '01'
     ORDER BY d.sort_order`,
  ).all<{ id: number; key: string; name: string; short: string | null }>();
  const DIMENSION_KEYS = dimensionResult.results ?? [];

  const bucketResult = await env.DB.prepare(
    `SELECT b.min_correct, b.max_correct, b.cefr_label
     FROM score_conversion_bands b
     JOIN test_parts p ON p.id = b.test_part_id
     JOIN tests t ON t.id = b.test_id
     WHERE t.test_code = '01' AND p.part_code = '01'
     ORDER BY b.min_correct`,
  ).all<{ min_correct: number; max_correct: number; cefr_label: string }>();
  const SCORE_BUCKETS = (bucketResult.results ?? []).map((band) => ({
    label: `${band.cefr_label} (${band.min_correct}–${band.max_correct})`,
    min: band.min_correct,
    max: band.max_correct,
  }));

  const dimValuesMap: Record<string, number[]> = {};
  for (const dk of DIMENSION_KEYS) dimValuesMap[dk.key] = [];
  const partAScores: number[] = [];
  const partBScores: number[] = [];

  const submissionRows = attemptRows.map((row) => {
    let name = 'N/A';
    let candidateId = 'N/A';
    let partAScore: number | null = null;
    let partBScore: number | null = null;
    let cefr = 'N/A';
    let cefrLabel = 'N/A';
    let overallPercent: number | null = null;
    let weakDimensions: string[] = [];
    try {
      if (row.variables) {
        const v = JSON.parse(row.variables) as ReportVariablesV1;
        name = v.candidate?.name ?? 'N/A';
        candidateId = v.candidate?.ref ?? 'N/A';
        const partA = v.scores?.parts?.find((part) => part.partCode === '01');
        const partB = v.scores?.parts?.find((part) => part.partCode === '02');
        partAScore = partA?.correct ?? null;
        partBScore = partB?.correct ?? null;
        if (typeof partAScore === 'number') partAScores.push(partAScore);
        if (typeof partBScore === 'number') partBScores.push(partBScore);
        const overallBand = v.paper1?.overall.band;
        cefr = overallBand?.cefrLabel ?? 'N/A';
        cefrLabel = overallBand?.levelLabel ?? 'N/A';
        overallPercent = v.paper1?.overall.percent ?? null;
        weakDimensions = v.paper1?.partA.growthKeys ?? v.weakDimensionKeys ?? [];
        for (const dim of v.dimensions ?? []) {
          if (typeof dim.score === 'number' && dimValuesMap[dim.key]) dimValuesMap[dim.key].push(dim.score);
        }
      }
    } catch {
      /* skip */
    }
    return {
      submissionId: row.attempt_id,
      attemptId: row.attempt_id,
      submittedAt: row.end_time ?? 0,
      candidateName: name,
      candidateId,
      testDate: row.end_time ?? 0,
      totalScore: partAScore ?? 0,
      partAScore,
      partATotal: 60,
      partBScore,
      partBTotal: 30,
      overallPercent,
      cefr,
      cefrLabel,
      weakDimensions,
      recommendation: '',
      aiFeedback: row.ai_status === 'done' ? row.ai_feedback_en : null,
    };
  });

  const { mean: overallMean, median: overallMedian, stdDev: overallStdDev } = computeStats(partAScores);
  const { mean: partBMean } = computeStats(partBScores);

  const scoreBuckets = SCORE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    min: bucket.min,
    max: bucket.max,
    count: partAScores.filter((s) => s >= bucket.min && s <= bucket.max).length,
  }));

  const dimensionStats = DIMENSION_KEYS.map((dk) => {
    const vals = dimValuesMap[dk.key];
    const { mean, stdDev } = computeStats(vals);
    return { id: dk.id, key: dk.key, name: dk.name, short: dk.short ?? '', mean, stdDev };
  });

  const questionAgg = await env.DB.prepare(
    `SELECT g.legacy_qid AS qid, g.canonical_number, p.part_code,
            COUNT(*) AS total, SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS correct
     FROM test_attempt_answers a
     JOIN test_attempts ta ON ta.id = a.test_attempt_id
     JOIN tests t ON t.id = ta.test_id
     JOIN question_groups g ON g.id = a.question_group_id
     JOIN test_parts p ON p.id = g.test_part_id
     LEFT JOIN users u ON u.id = ta.user_id
     WHERE ta.status = 'completed' AND t.test_code = '01'
       AND (u.user_group = ? OR ta.session_token IN (
         SELECT token FROM sessions s JOIN vouchers v ON v.code = s.voucher_code WHERE v.user_group = ?
       ))
     GROUP BY g.id, g.legacy_qid, g.canonical_number, p.part_code
     ORDER BY g.canonical_number`,
  )
    .bind(userGroup, userGroup)
    .all<{ qid: string | null; canonical_number: number; part_code: string; total: number; correct: number }>();

  const questionStats = (questionAgg.results ?? []).map((row) => ({
    qid: row.qid || `Q${row.canonical_number}`,
    part: (row.part_code === '01' ? 'A' : 'B') as 'A' | 'B',
    canonicalNumber: row.canonical_number,
    correctRate: Number(row.total) > 0 ? Math.round((Number(row.correct) / Number(row.total)) * 1000) / 10 : null,
    totalResponses: Number(row.total),
  }));

  return json(
    {
      userGroup,
      totalVouchers: Number(voucherStats?.total ?? 0),
      usedVouchers: Number(voucherStats?.used ?? 0),
      totalSubmissions: attemptRows.length,
      overallMean,
      overallMedian,
      overallStdDev,
      partBMean,
      scoreBuckets,
      dimensionStats,
      submissions: submissionRows,
      questionStats,
      paperAttempts: await loadTeacherPaperAttempts(env, userGroup),
    },
    undefined,
    origin,
  );
}

async function loadTeacherPaperAttempts(env: Env, userGroup: string) {
  const result = await env.DB.prepare(
    `SELECT a.id AS attempt_id, a.end_time, a.grading_status, t.test_code, t.name AS test_name,
            u.display_name, u.external_ref, ar.variables
     FROM test_attempts a
     JOIN tests t ON t.id = a.test_id
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN attempt_reports ar ON ar.test_attempt_id = a.id
     WHERE a.status = 'completed' AND t.test_code IN ('02', '03')
       AND (u.user_group = ? OR a.session_token IN (
         SELECT token FROM sessions s JOIN vouchers v ON v.code = s.voucher_code WHERE v.user_group = ?
       ))
     ORDER BY a.end_time DESC`,
  )
    .bind(userGroup, userGroup)
    .all<{
      attempt_id: string;
      end_time: number | null;
      grading_status: string;
      test_code: string;
      test_name: string;
      display_name: string | null;
      external_ref: string | null;
      variables: string | null;
    }>();

  return (result.results ?? []).map((row) => {
    let overallBand: string | null = null;
    let partBands: Array<{ partCode: string; cefrLabel: string }> = [];
    try {
      if (row.variables) {
        const v = JSON.parse(row.variables) as {
          bands?: { overall?: { cefrLabel?: string }; parts?: Array<{ partCode: string; cefrLabel: string }> };
        };
        overallBand = v.bands?.overall?.cefrLabel ?? null;
        partBands = v.bands?.parts ?? [];
      }
    } catch {
      /* ignore */
    }
    return {
      attemptId: row.attempt_id,
      testCode: row.test_code,
      testName: row.test_name,
      candidateName: row.display_name ?? 'Candidate',
      candidateRef: row.external_ref ?? '',
      submittedAt: row.end_time,
      gradingStatus: row.grading_status,
      overallBand,
      partBands,
    };
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = getAllowedOrigin(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return json({ ok: true }, undefined, origin);
      }

      const adminResponse = await handleAdminRequest(request, env, origin, json);
      if (adminResponse) {
        return adminResponse;
      }

      const assetResponse = await handleAssetRequest(request, env, origin, json);
      if (assetResponse) {
        return assetResponse;
      }

      const paper3Response = await handlePaper3Route(request, env, ctx, origin, json);
      if (paper3Response) {
        return paper3Response;
      }

      // Before the attempts router: it owns /api/attempts/:id/ai-feedback,
      // which handleAttemptRequest would otherwise 404.
      const aiResponse = await handleAiRequest(request, env, ctx, origin, json);
      if (aiResponse) {
        return aiResponse;
      }

      const attemptResponse = await handleAttemptRequest(request, env, origin, json);
      if (attemptResponse) {
        return attemptResponse;
      }

      const reportResponse = await handleReportRequest(request, env, origin, json);
      if (reportResponse) {
        return reportResponse;
      }

      // Awaited so handler rejections (e.g. malformed JSON bodies) are caught
      // below and become JSON 500s instead of unhandled Worker exceptions.
      if (url.pathname === '/api/verify-voucher' && request.method === 'POST') {
        return await verifyVoucher(request, env, origin);
      }

      if (url.pathname === '/api/submit' && request.method === 'POST') {
        return json(
          {
            error: 'RETIRED',
            message: 'Paper I uses POST /api/attempts. Client-scored /api/submit is retired.',
          },
          { status: 410 },
          origin,
        );
      }

      if (url.pathname === '/api/session/tests' && request.method === 'GET') {
        return await sessionTests(request, env, origin);
      }

      if (url.pathname === '/api/teacher/verify' && request.method === 'POST') {
        return await teacherVerify(request, env, origin);
      }

      if (url.pathname === '/api/teacher/dashboard' && request.method === 'GET') {
        return await teacherDashboard(request, env, origin);
      }

      return json({ error: 'Not found' }, { status: 404 }, origin);
    } catch (error) {
      console.error(JSON.stringify({ message: 'Unhandled Worker error', error: error instanceof Error ? error.message : String(error) }));
      return json({ error: 'Internal server error' }, { status: 500 }, origin);
    }
  },

  async queue(batch: MessageBatch<GradeJobMessage>, env: Env): Promise<void> {
    await handlePaper3Queue(batch, env);
  },
};
