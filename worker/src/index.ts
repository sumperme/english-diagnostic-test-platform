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

type TeacherVerifyRequest = {
  key?: string;
};

type SubmissionPayload = {
  scores?: {
    total?: {
      correct?: number;
    };
  };
  dimensions?: Array<{ key: string; score: number }>;
  reportSnapshot?: {
    questionCorrectness?: Record<string, 0 | 1>;
    weakDimensions?: string[];
    recommendation?: string;
  };
  candidateInfo?: {
    name?: string;
    id?: string;
    testDate?: number;
  };
  submittedAt?: number;
  cefrBand?: {
    cefr?: string;
    label?: string;
  };
};

type TeacherSubmissionRow = {
  id: string;
  submitted_at: number;
  total_score: number;
  payload: string;
  dimension_scores: string | null;
  score_dist: string | null;
};

const DEFAULT_USER_GROUP = 'General Learner';

const SCORE_BUCKETS = [
  { label: 'B1 (0–25)', min: 0, max: 25 },
  { label: 'B2 (26–39)', min: 26, max: 39 },
  { label: 'C1 (40–53)', min: 40, max: 53 },
  { label: 'C1+ (54–63)', min: 54, max: 63 },
  { label: 'C2 (64–72)', min: 64, max: 72 },
];

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

  // Build dimension_scores JSON: { key: score, ... }
  let dimensionScoresJson: string | null = null;
  if (Array.isArray(payload.dimensions) && payload.dimensions.length > 0) {
    const dimensionScores: Record<string, number> = {};
    for (const d of payload.dimensions) {
      if (typeof d.key === 'string' && typeof d.score === 'number') {
        dimensionScores[d.key] = d.score;
      }
    }
    dimensionScoresJson = JSON.stringify(dimensionScores);
  }

  // Build score_dist JSON: { questionId: 0|1, ... }
  let scoreDistJson: string | null = null;
  const qc = payload.reportSnapshot?.questionCorrectness;
  if (qc && typeof qc === 'object') {
    scoreDistJson = JSON.stringify(qc);
  }

  await env.DB.prepare(
    'INSERT INTO submissions (id, session_token, payload, total_score, created_at, user_group, dimension_scores, score_dist) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(submissionId, session.token, JSON.stringify(payload), totalScore, now, userGroup, dimensionScoresJson, scoreDistJson)
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
    `SELECT COUNT(*) as total, SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) as used
     FROM vouchers WHERE user_group = ?`,
  )
    .bind(userGroup)
    .first<{ total: number; used: number }>();

  // All submissions for this user_group
  const submissionsResult = await env.DB.prepare(
    `SELECT id, created_at as submitted_at, total_score, payload, dimension_scores, score_dist
     FROM submissions WHERE user_group = ? ORDER BY created_at DESC`,
  )
    .bind(userGroup)
    .all<TeacherSubmissionRow>();

  const rows = submissionsResult.results ?? [];

  // Overall score stats
  const scores = rows.map((r) => r.total_score);
  const { mean: overallMean, median: overallMedian, stdDev: overallStdDev } = computeStats(scores);

  // Score distribution buckets
  const scoreBuckets = SCORE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    min: bucket.min,
    max: bucket.max,
    count: scores.filter((s) => s >= bucket.min && s <= bucket.max).length,
  }));

  // Per-dimension stats — aggregate from dimension_scores column (fallback to payload)
  const DIMENSION_KEYS = [
    { id: 1, key: 'nounsArticles', name: 'Nouns and Articles', short: 'Nouns' },
    { id: 2, key: 'pronouns', name: 'Pronouns', short: 'Pronouns' },
    { id: 3, key: 'verbsTenses', name: 'Verbs and Tenses', short: 'Tenses' },
    { id: 4, key: 'subjectVerbAgreement', name: 'Subject-Verb Agreement', short: 'Agreement' },
    { id: 5, key: 'adjectivesAdverbs', name: 'Adjectives and Adverbs', short: 'Adj/Adv' },
    { id: 6, key: 'prepositions', name: 'Prepositions', short: 'Preps' },
    { id: 7, key: 'conjunctions', name: 'Conjunctions', short: 'Conj.' },
    { id: 8, key: 'sentenceStructure', name: 'Sentence Structure', short: 'Structure' },
    { id: 9, key: 'vocabSynonymsAntonyms', name: 'Vocabulary (Synonyms/Antonyms)', short: 'Vocab I' },
    { id: 10, key: 'vocabContextual', name: 'Vocabulary (Contextual)', short: 'Vocab II' },
    { id: 11, key: 'readingMainIdea', name: 'Reading Comprehension (Main Idea)', short: 'Main Idea' },
    { id: 12, key: 'readingInference', name: 'Reading Comprehension (Inference)', short: 'Inference' },
  ];

  const dimValuesMap: Record<string, number[]> = {};
  for (const dk of DIMENSION_KEYS) dimValuesMap[dk.key] = [];

  // Question correctness aggregation
  const questionCountMap: Record<string, number> = {};
  const questionCorrectMap: Record<string, number> = {};

  for (const row of rows) {
    let dimScores: Record<string, number> | null = null;
    if (row.dimension_scores) {
      try { dimScores = JSON.parse(row.dimension_scores) as Record<string, number>; } catch { /* skip */ }
    }
    if (!dimScores) {
      try {
        const p = JSON.parse(row.payload) as SubmissionPayload;
        if (Array.isArray(p.dimensions)) {
          dimScores = {};
          for (const d of p.dimensions) {
            if (typeof d.key === 'string' && typeof d.score === 'number') {
              dimScores[d.key] = d.score;
            }
          }
        }
      } catch { /* skip */ }
    }
    if (dimScores) {
      for (const dk of DIMENSION_KEYS) {
        const v = dimScores[dk.key];
        if (typeof v === 'number') dimValuesMap[dk.key].push(v);
      }
    }

    // Score dist
    let scoreDist: Record<string, 0 | 1> | null = null;
    if (row.score_dist) {
      try { scoreDist = JSON.parse(row.score_dist) as Record<string, 0 | 1>; } catch { /* skip */ }
    }
    if (!scoreDist) {
      try {
        const p = JSON.parse(row.payload) as SubmissionPayload;
        const qc = (p.reportSnapshot as { questionCorrectness?: Record<string, 0 | 1> })?.questionCorrectness;
        if (qc) scoreDist = qc;
      } catch { /* skip */ }
    }
    if (scoreDist) {
      for (const [qid, correct] of Object.entries(scoreDist)) {
        questionCountMap[qid] = (questionCountMap[qid] ?? 0) + 1;
        questionCorrectMap[qid] = (questionCorrectMap[qid] ?? 0) + correct;
      }
    }
  }

  const dimensionStats = DIMENSION_KEYS.map((dk) => {
    const vals = dimValuesMap[dk.key];
    const { mean, stdDev } = computeStats(vals);
    return { id: dk.id, key: dk.key, name: dk.name, short: dk.short, mean, stdDev };
  });

  // Build question stats
  const ALL_QIDS_ORDERED = [
    ...Array.from({ length: 36 }, (_, i) => `A${i + 1}`),
    ...Array.from({ length: 36 }, (_, i) => `B${i + 1}`),
  ];

  const questionStats = ALL_QIDS_ORDERED.map((qid, idx) => {
    const part = (idx < 36 ? 'A' : 'B') as 'A' | 'B';
    const canonicalNumber = idx < 36 ? idx + 1 : idx - 35;
    const total = questionCountMap[qid] ?? 0;
    const correct = questionCorrectMap[qid] ?? 0;
    return {
      qid,
      part,
      canonicalNumber,
      correctRate: total > 0 ? Math.round((correct / total) * 1000) / 10 : null,
      totalResponses: total,
    };
  });

  // Build submission rows
  const submissionRows = rows.map((row) => {
    let name = 'N/A';
    let candidateId = 'N/A';
    let testDate = row.submitted_at;
    let cefr = 'N/A';
    let cefrLabel = 'N/A';
    let weakDimensions: string[] = [];
    let recommendation = '';

    try {
      const p = JSON.parse(row.payload) as SubmissionPayload;
      name = p.candidateInfo?.name ?? 'N/A';
      candidateId = p.candidateInfo?.id ?? 'N/A';
      testDate = p.candidateInfo?.testDate ?? row.submitted_at;
      cefr = p.cefrBand?.cefr ?? 'N/A';
      cefrLabel = p.cefrBand?.label ?? 'N/A';
      weakDimensions = p.reportSnapshot?.weakDimensions ?? [];
      recommendation = p.reportSnapshot?.recommendation ?? '';
    } catch { /* skip */ }

    return {
      submissionId: row.id,
      submittedAt: row.submitted_at,
      candidateName: name,
      candidateId,
      testDate,
      totalScore: row.total_score,
      cefr,
      cefrLabel,
      weakDimensions,
      recommendation,
    };
  });

  return json(
    {
      userGroup,
      totalVouchers: Number(voucherStats?.total ?? 0),
      usedVouchers: Number(voucherStats?.used ?? 0),
      totalSubmissions: rows.length,
      overallMean,
      overallMedian,
      overallStdDev,
      scoreBuckets,
      dimensionStats,
      submissions: submissionRows,
      questionStats,
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

      if (url.pathname === '/api/teacher/verify' && request.method === 'POST') {
        return teacherVerify(request, env, origin);
      }

      if (url.pathname === '/api/teacher/dashboard' && request.method === 'GET') {
        return teacherDashboard(request, env, origin);
      }

      return json({ error: 'Not found' }, { status: 404 }, origin);
    } catch (error) {
      console.error(JSON.stringify({ message: 'Unhandled Worker error', error: error instanceof Error ? error.message : String(error) }));
      return json({ error: 'Internal server error' }, { status: 500 }, origin);
    }
  },
};
