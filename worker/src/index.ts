type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ALLOWED_ORIGIN?: string;
  SESSION_TTL_SECONDS?: string;
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
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
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
    return json({ error: 'Voucher is invalid or has already been used' }, { status: 401 }, origin);
  }

  await env.DB.prepare('INSERT INTO sessions (token, voucher_code, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionToken, code, now, expiresAt)
    .run();

  return json({ sessionToken, expiresAt, voucherCode: code }, undefined, origin);
}

async function getSession(request: Request, env: Env) {
  const auth = request.headers.get('Authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1];
  const row = await env.DB.prepare('SELECT token, expires_at FROM sessions WHERE token = ?')
    .bind(token)
    .first<{ token: string; expires_at: number }>();

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

  const now = Date.now();
  const submissionId = crypto.randomUUID();

  await env.DB.prepare('INSERT INTO submissions (id, session_token, payload, total_score, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(submissionId, session.token, JSON.stringify(payload), totalScore, now)
    .run();

  const stats = await env.DB.prepare(
    'SELECT COUNT(*) as cohortSize, AVG(total_score) as cohortMean, SUM(CASE WHEN total_score <= ? THEN 1 ELSE 0 END) as atOrBelow FROM submissions',
  )
    .bind(totalScore)
    .first<{ cohortSize: number; cohortMean: number | null; atOrBelow: number }>();

  const cohortSize = Number(stats?.cohortSize ?? 1);
  const cohortMean = stats?.cohortMean == null ? null : Math.round(Number(stats.cohortMean) * 10) / 10;
  const percentileRank = cohortSize > 0 ? Math.round((Number(stats?.atOrBelow ?? 1) / cohortSize) * 100) : null;

  return json({ submissionId, percentileRank, cohortSize, cohortMean }, undefined, origin);
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
