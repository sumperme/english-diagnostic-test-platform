import { computePercentileStats, handleAdminRequest } from './admin';

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ALLOWED_ORIGIN?: string;
  SESSION_TTL_SECONDS?: string;
  ADMIN_PASSWORD?: string;
};

type VerifyVoucherRequest = {
  code?: string;
};

type SubmissionPayload = {
  scores?: {
    total?: {
      correct?: number;
    };
  };
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
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Password',
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
    'SELECT code, used_at, user_group FROM vouchers WHERE code = ?',
  )
    .bind(code)
    .first<{ code: string; used_at: number | null; user_group: string | null }>();

  if (!voucher) {
    return json({ error: 'NOT_FOUND' }, { status: 401 }, origin);
  }

  if (voucher.used_at != null) {
    return json({ error: 'ALREADY_USED' }, { status: 401 }, origin);
  }

  const now = Date.now();
  const sessionToken = crypto.randomUUID();
  const ttl = Number(env.SESSION_TTL_SECONDS ?? 7200) * 1000;
  const expiresAt = now + ttl;

  const update = await env.DB.prepare(
    'UPDATE vouchers SET used_at = ?, used_by_session = ? WHERE code = ? AND used_at IS NULL',
  )
    .bind(now, sessionToken, code)
    .run();

  if (!update.success || update.meta.changes !== 1) {
    return json({ error: 'ALREADY_USED' }, { status: 401 }, origin);
  }

  await env.DB.prepare('INSERT INTO sessions (token, voucher_code, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionToken, code, now, expiresAt)
    .run();

  const userGroup = voucher.user_group?.trim() || DEFAULT_USER_GROUP;

  return json({ sessionToken, expiresAt, voucherCode: code, userGroup }, undefined, origin);
}

async function getSession(request: Request, env: Env) {
  const auth = request.headers.get('Authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1];
  const row = await env.DB.prepare(
    'SELECT s.token, s.expires_at, s.voucher_code, v.user_group FROM sessions s LEFT JOIN vouchers v ON v.code = s.voucher_code WHERE s.token = ?',
  )
    .bind(token)
    .first<{ token: string; expires_at: number; voucher_code: string; user_group: string | null }>();

  if (!row || row.expires_at <= Date.now()) return null;
  return row;
}

async function submit(request: Request, env: Env, origin?: string) {
  const session = await getSession(request, env);
  if (!session) return unauthorized(origin);

  const payload = await readJson<SubmissionPayload>(request);
  const totalScore = payload.scores?.total?.correct;
  if (typeof totalScore !== 'number') {
    return json({ error: 'Submission payload is missing total score' }, { status: 400 }, origin);
  }

  const userGroup = session.user_group?.trim() || DEFAULT_USER_GROUP;
  const now = Date.now();
  const submissionId = crypto.randomUUID();

  await env.DB.prepare(
    'INSERT INTO submissions (id, session_token, payload, total_score, created_at, user_group) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(submissionId, session.token, JSON.stringify(payload), totalScore, now, userGroup)
    .run();

  const allStats = await env.DB.prepare(
    'SELECT COUNT(*) as cohortSize, AVG(total_score) as cohortMean, SUM(CASE WHEN total_score <= ? THEN 1 ELSE 0 END) as atOrBelow FROM submissions',
  )
    .bind(totalScore)
    .first<{ cohortSize: number; cohortMean: number | null; atOrBelow: number }>();

  const groupStats = await env.DB.prepare(
    'SELECT COUNT(*) as cohortSize, AVG(total_score) as cohortMean, SUM(CASE WHEN total_score <= ? THEN 1 ELSE 0 END) as atOrBelow FROM submissions WHERE user_group = ?',
  )
    .bind(totalScore, userGroup)
    .first<{ cohortSize: number; cohortMean: number | null; atOrBelow: number }>();

  const all = computePercentileStats(allStats);
  const group = computePercentileStats(groupStats);

  return json(
    {
      submissionId,
      userGroup,
      percentileRank: all.percentileRank,
      cohortSize: all.cohortSize,
      cohortMean: all.cohortMean,
      groupPercentileRank: group.percentileRank,
      groupCohortSize: group.cohortSize,
      groupCohortMean: group.cohortMean,
    },
    undefined,
    origin,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

      if (url.pathname === '/api/verify-voucher' && request.method === 'POST') {
        return verifyVoucher(request, env, origin);
      }

      if (url.pathname === '/api/submit' && request.method === 'POST') {
        return submit(request, env, origin);
      }

      return json({ error: 'Not found' }, { status: 404 }, origin);
    } catch (error) {
      console.error(JSON.stringify({ message: 'Unhandled Worker error', error: error instanceof Error ? error.message : String(error) }));
      return json({ error: 'Internal server error' }, { status: 500 }, origin);
    }
  },
};
