// Randomization-engine attempts API (Papers I–III).
//
//   POST /api/attempts                { testCode, candidateInfo: { name, id } }   Bearer session
//   POST /api/attempts/:id/answers    { questionCode, selectedOption }            Bearer session (owner)
//   POST /api/attempts/:id/submit                                                 Bearer session (owner)
//   GET  /api/attempts/:id/report     ?voucher= | Bearer | X-Teacher-Key          report credentials
//
// The start endpoint picks ONE random variant per question group, persists the
// served configuration into test_attempt_answers, and never sends correct
// answers or audio transcripts to the client. Scoring happens server-side at
// submit, which also writes attempt_reports (rv1 Papers II/III, rv3 Paper I) and
// consumes one per-test voucher use. Completed student report payloads contain
// variables plus the resolved Paper I feedback rows — no stems, options, or
// correct answers. Teachers may fetch Paper III productions (recordings /
// transcripts / essays) on the class dashboard.

import { consumeVoucherUse, extendSession, getSession } from './index';
import { enqueuePaper3Grade, type Paper3GradeEnv } from './paper3Grading';
import { authorizeAttemptAccess, cacheAttemptPdf, PDF_TTL_MS } from './reports';
import {
  buildPaper1Report,
  loadPaper1Feedback,
  paper1Bands,
  paper1Dimensions,
  PAPER1_REPORT_VARIABLES_VERSION,
  type Paper1BandRow,
} from './paper1Report';
import {
  REPORT_VARIABLES_VERSION,
  type FeedbackItem,
  type LevelKey,
  type ReportVariablesV1,
} from './reportVariables';

type AttemptsEnv = {
  DB: D1Database;
  R2_ASSETS?: R2Bucket;
  DEEPSEEK_API_KEY?: string;
  ASSEMBLYAI_API_KEY?: string;
  ASSEMBLYAI_WEBHOOK_SECRET?: string;
  ASSEMBLYAI_WEBHOOK_BASE?: string;
  PAPER3_GRADE?: Queue;
};

type JsonResponder = (body: unknown, init?: ResponseInit, origin?: string) => Response;

type StartAttemptRequest = {
  testCode?: string;
  candidateInfo?: { name?: string; id?: string };
};

type AnswerRequest = {
  questionCode?: string;
  selectedOption?: string | null;
  textResponse?: string | null;
};

type SubmitRequest = {
  candidateInfo?: { name?: string; id?: string };
  autoSubmitted?: boolean;
};

type ServedRow = {
  group_id: number;
  group_code: string;
  canonical_number: number;
  part_code: string;
  part_skill: string | null;
  shared_resource_id: number | null;
  response_type: string;
  question_id: number;
  question_code: string;
  prompt_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  explanation: string | null;
  dimension_key: string | null;
};

type ResourcePayload =
  | { type: 'audio'; resourceId: number; url: string; title: string | null; metadata?: unknown }
  | { type: 'text'; resourceId: number; title: string | null; content: string; metadata?: unknown };

export type AttemptItem = {
  questionCode: string;
  partCode: string;
  canonicalNumber: number;
  prompt: string;
  options: { A: string; B: string; C: string; D: string };
  resourceId: number | null;
  responseType: 'mcq' | 'speaking' | 'writing';
  meta?: unknown;
  dimensionKey?: string | null;
};

type BandRow = Paper1BandRow & { test_part_id: number | null };

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

// Canonical CEFR ladder used to average the two part bands into an overall band
// (per the client conversion notes: C1+C1 -> C1, both mid-B2 -> high B2, etc.).
const BAND_LEVELS: Record<string, number> = {
  b1Plus: 1,
  lowB2: 2,
  highB2LowC1: 3,
  c1: 4,
  c1PlusNearC2: 5,
  c1PlusC2: 5,
  c2: 5,
};

const OVERALL_BANDS: Array<{ bandKey: string; cefrLabel: string; ielts: string; toefl: string }> = [
  { bandKey: 'b1Plus', cefrLabel: 'B1/B1+', ielts: '~4.0–5.0', toefl: '~40–60 / 120' },
  { bandKey: 'lowB2', cefrLabel: 'Low B2', ielts: '~5.5–6.0', toefl: '~60–75 / 120' },
  { bandKey: 'highB2LowC1', cefrLabel: 'High B2 / Low C1', ielts: '~6.5–7.0', toefl: '~75–90 / 120' },
  { bandKey: 'c1', cefrLabel: 'C1', ielts: '~7.0–8.0', toefl: '~90–105 / 120' },
  { bandKey: 'c1PlusC2', cefrLabel: 'C1+/C2', ielts: '~8.0–9.0', toefl: '~105–120 / 120' },
];

const levelKeyForPct = (pct: number): LevelKey => {
  if (pct >= 1) return 'excellent';
  if (pct >= 0.8) return 'strong';
  if (pct >= 0.6) return 'good';
  if (pct >= 0.4) return 'developing';
  return 'needsWork';
};

/** Fisher-Yates; mutates and returns the given array. */
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export async function handleAttemptRequest(
  request: Request,
  env: AttemptsEnv,
  origin: string | undefined,
  json: JsonResponder,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/attempts')) return null;

  if (url.pathname === '/api/attempts' && request.method === 'POST') {
    return startAttempt(request, env, origin, json);
  }

  const answersMatch = url.pathname.match(/^\/api\/attempts\/([0-9a-fA-F-]{8,64})\/answers$/);
  if (answersMatch && request.method === 'POST') {
    return saveAnswer(request, env, origin, json, answersMatch[1]);
  }

  const submitMatch = url.pathname.match(/^\/api\/attempts\/([0-9a-fA-F-]{8,64})\/submit$/);
  if (submitMatch && request.method === 'POST') {
    return submitAttempt(request, env, origin, json, submitMatch[1]);
  }

  const reportMatch = url.pathname.match(/^\/api\/attempts\/([0-9a-fA-F-]{8,64})\/report$/);
  if (reportMatch && request.method === 'GET') {
    return getAttemptReport(request, env, origin, json, reportMatch[1], url);
  }

  return json({ error: 'Not found' }, { status: 404 }, origin);
}

// ---------------------------------------------------------------------------
// POST /api/attempts — create attempt + randomized instance
// ---------------------------------------------------------------------------

async function startAttempt(request: Request, env: AttemptsEnv, origin: string | undefined, json: JsonResponder) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'Unauthorized' }, { status: 401 }, origin);

  const body = await request.json<StartAttemptRequest>().catch(() => ({}) as StartAttemptRequest);
  const testCode = (body.testCode ?? '').trim();

  const test = await env.DB.prepare(
    "SELECT id, test_code, name, time_limit_seconds FROM tests WHERE test_code = ? AND status = 'active'",
  )
    .bind(testCode)
    .first<{ id: number; test_code: string; name: string; time_limit_seconds: number | null }>();
  if (!test) return json({ error: 'TEST_NOT_FOUND' }, { status: 404 }, origin);

  // Gate on remaining per-test uses (consumed at submit).
  const usesAllowed = Number(session.uses_allowed ?? 1);
  const usage = await env.DB.prepare(
    'SELECT use_count FROM voucher_test_usage WHERE voucher_code = ? AND test_id = ?',
  )
    .bind(session.voucher_code, test.id)
    .first<{ use_count: number }>();
  if (Number(usage?.use_count ?? 0) >= usesAllowed) {
    return json({ error: 'NO_REMAINING_USES' }, { status: 409 }, origin);
  }

  // Upsert the user from voucher identity.
  const now = Date.now();
  const displayName = (body.candidateInfo?.name ?? '').trim() || 'Anonymous Candidate';
  const userGroup = session.user_group?.trim() || 'General Learner';
  await env.DB.prepare(
    `INSERT INTO users (external_ref, display_name, user_group, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(external_ref) DO UPDATE SET display_name = excluded.display_name, user_group = excluded.user_group`,
  )
    .bind(session.voucher_code, displayName, userGroup, now)
    .run();
  const user = await env.DB.prepare('SELECT id FROM users WHERE external_ref = ?')
    .bind(session.voucher_code)
    .first<{ id: number }>();

  // Load all variants for the test and pick one at random per group.
  const rowsResult = await env.DB.prepare(
    `SELECT g.id AS group_id, g.group_code, g.canonical_number, g.shared_resource_id,
            COALESCE(g.response_type, 'mcq') AS response_type,
            p.part_code, p.skill AS part_skill,
            q.id AS question_id, q.question_code, q.prompt_text,
            q.option_a, q.option_b, q.option_c, q.option_d, q.explanation,
            d.key AS dimension_key
     FROM question_groups g
     JOIN test_parts p ON p.id = g.test_part_id
     JOIN questions q ON q.question_group_id = g.id
     LEFT JOIN dimensions d ON d.id = g.dimension_id
     WHERE g.test_id = ?
     ORDER BY g.canonical_number`,
  )
    .bind(test.id)
    .all<ServedRow>();

  const byGroup = new Map<number, ServedRow[]>();
  for (const row of rowsResult.results ?? []) {
    const list = byGroup.get(row.group_id) ?? [];
    list.push(row);
    byGroup.set(row.group_id, list);
  }
  if (byGroup.size === 0) return json({ error: 'TEST_EMPTY' }, { status: 500 }, origin);

  // One random variant per group: every attempt covers every question group
  // exactly once, whichever variants exist.
  const chosen: ServedRow[] = [...byGroup.values()].map(
    (variants) => variants[Math.floor(Math.random() * variants.length)],
  );

  // Serving order. Parts keep their sequence (Part A before Part B).
  // Paper III: fixed canonical order — no shuffle.
  // Paper II Part A: shuffle; Part B: canonical passage order.
  const partCodes = [...new Set(chosen.map((row) => row.part_code))].sort();
  const served: ServedRow[] = [];
  const isPaper3 = test.test_code === '03';
  if (isPaper3) {
    served.push(...chosen.sort((a, b) => a.canonical_number - b.canonical_number));
  } else {
    for (const partCode of partCodes) {
      const clusters = new Map<string, ServedRow[]>();
      for (const row of chosen) {
        if (row.part_code !== partCode) continue;
        const key = row.shared_resource_id != null ? `resource:${row.shared_resource_id}` : `group:${row.group_id}`;
        const cluster = clusters.get(key) ?? [];
        cluster.push(row);
        clusters.set(key, cluster);
      }
      const clusterList = [...clusters.values()];
      if (partCode === '02') {
        clusterList.sort(
          (a, b) => Math.min(...a.map((r) => r.canonical_number)) - Math.min(...b.map((r) => r.canonical_number)),
        );
        for (const cluster of clusterList) {
          cluster.sort((a, b) => a.canonical_number - b.canonical_number);
          served.push(...cluster);
        }
      } else {
        for (const cluster of shuffleInPlace(clusterList)) {
          served.push(...shuffleInPlace(cluster));
        }
      }
    }
  }

  const attemptId = crypto.randomUUID();
  const statements = [
    env.DB.prepare(
      `INSERT INTO test_attempts (id, user_id, test_id, session_token, start_time, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'in-progress', ?)`,
    ).bind(attemptId, user?.id ?? null, test.id, session.token, now, now),
    ...served.map((row, index) =>
      env.DB.prepare(
        `INSERT INTO test_attempt_answers (test_attempt_id, question_group_id, question_id, question_code, selected_option, is_correct, answered_at, display_order)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?)`,
      ).bind(attemptId, row.group_id, row.question_id, row.question_code, index + 1),
    ),
  ];
  await env.DB.batch(statements);

  // Resource payloads: audio never includes the transcript (text_content stays server-side).
  const resourceIds = [...new Set(served.map((row) => row.shared_resource_id).filter((id): id is number => id != null))];
  const resources: Record<number, ResourcePayload> = {};
  if (resourceIds.length > 0) {
    const placeholders = resourceIds.map(() => '?').join(',');
    const resourceRows = await env.DB.prepare(
      `SELECT id, resource_type, title, content_url, text_content, metadata FROM shared_resources WHERE id IN (${placeholders})`,
    )
      .bind(...resourceIds)
      .all<{
        id: number;
        resource_type: string;
        title: string | null;
        content_url: string | null;
        text_content: string | null;
        metadata: string | null;
      }>();
    for (const resource of resourceRows.results ?? []) {
      let meta: unknown;
      try {
        meta = resource.metadata ? JSON.parse(resource.metadata) : undefined;
      } catch {
        meta = undefined;
      }
      if (resource.resource_type === 'audio' && resource.content_url) {
        resources[resource.id] = {
          type: 'audio',
          resourceId: resource.id,
          url: resource.content_url,
          title: resource.title,
          metadata: meta,
        };
      } else if (resource.resource_type === 'text' && resource.text_content) {
        resources[resource.id] = {
          type: 'text',
          resourceId: resource.id,
          title: resource.title,
          content: resource.text_content,
          metadata: meta,
        };
      }
    }
  }

  const items: AttemptItem[] = served.map((row) => {
    let meta: unknown;
    try {
      meta = row.explanation ? JSON.parse(row.explanation) : undefined;
    } catch {
      meta = undefined;
    }
    const responseType = (row.response_type === 'speaking' || row.response_type === 'writing'
      ? row.response_type
      : 'mcq') as AttemptItem['responseType'];
    return {
      questionCode: row.question_code,
      partCode: row.part_code,
      canonicalNumber: row.canonical_number,
      prompt: row.prompt_text,
      options: { A: row.option_a, B: row.option_b, C: row.option_c, D: row.option_d },
      resourceId: row.shared_resource_id,
      responseType,
      meta,
      dimensionKey: row.dimension_key,
    };
  });

  const timeLimitSeconds = test.time_limit_seconds ?? 3600;
  await extendSession(env.DB, session.token, now + timeLimitSeconds * 1000 + PDF_TTL_MS);

  return json(
    {
      attemptId,
      testCode: test.test_code,
      testName: test.name,
      timeLimitSeconds,
      items,
      resources,
    },
    undefined,
    origin,
  );
}

// ---------------------------------------------------------------------------
// POST /api/attempts/:id/answers — incremental save
// ---------------------------------------------------------------------------

async function loadOwnedAttempt(request: Request, env: AttemptsEnv, attemptId: string) {
  const session = await getSession(request, env);
  if (!session) return null;
  const attempt = await env.DB.prepare(
    'SELECT id, test_id, session_token, status FROM test_attempts WHERE id = ?',
  )
    .bind(attemptId)
    .first<{ id: string; test_id: number; session_token: string | null; status: string }>();
  if (!attempt || attempt.session_token !== session.token) return null;
  return { session, attempt };
}

async function saveAnswer(
  request: Request,
  env: AttemptsEnv,
  origin: string | undefined,
  json: JsonResponder,
  attemptId: string,
) {
  const owned = await loadOwnedAttempt(request, env, attemptId);
  if (!owned) return json({ error: 'Unauthorized' }, { status: 401 }, origin);
  if (owned.attempt.status !== 'in-progress') {
    return json({ error: 'ATTEMPT_COMPLETED' }, { status: 409 }, origin);
  }

  const body = await request.json<AnswerRequest>().catch(() => ({}) as AnswerRequest);
  const questionCode = (body.questionCode ?? '').trim();
  if (!questionCode) {
    return json({ error: 'Invalid answer payload' }, { status: 400 }, origin);
  }

  // Writing / constructed text save
  if (body.textResponse !== undefined) {
    const text = body.textResponse == null ? null : String(body.textResponse);
    const update = await env.DB.prepare(
      `UPDATE test_attempt_answers SET text_response = ?, answered_at = ?
       WHERE test_attempt_id = ? AND question_code = ?`,
    )
      .bind(text, Date.now(), attemptId, questionCode)
      .run();
    if (!update.success || update.meta.changes !== 1) {
      return json({ error: 'QUESTION_NOT_IN_ATTEMPT' }, { status: 404 }, origin);
    }
    return json({ ok: true }, undefined, origin);
  }

  const selected = body.selectedOption == null ? null : String(body.selectedOption).trim().toUpperCase();
  if (selected !== null && !OPTION_KEYS.includes(selected)) {
    return json({ error: 'Invalid answer payload' }, { status: 400 }, origin);
  }

  const update = await env.DB.prepare(
    'UPDATE test_attempt_answers SET selected_option = ?, answered_at = ? WHERE test_attempt_id = ? AND question_code = ?',
  )
    .bind(selected, Date.now(), attemptId, questionCode)
    .run();
  if (!update.success || update.meta.changes !== 1) {
    return json({ error: 'QUESTION_NOT_IN_ATTEMPT' }, { status: 404 }, origin);
  }
  return json({ ok: true }, undefined, origin);
}

// ---------------------------------------------------------------------------
// POST /api/attempts/:id/submit — server-side scoring + report variables
// ---------------------------------------------------------------------------

async function submitAttempt(
  request: Request,
  env: AttemptsEnv,
  origin: string | undefined,
  json: JsonResponder,
  attemptId: string,
) {
  const owned = await loadOwnedAttempt(request, env, attemptId);
  if (!owned) return json({ error: 'Unauthorized' }, { status: 401 }, origin);
  const { session, attempt } = owned;

  const body = await request.json<SubmitRequest>().catch(() => ({}) as SubmitRequest);

  const testRow = await env.DB.prepare('SELECT test_code FROM tests WHERE id = ?')
    .bind(attempt.test_id)
    .first<{ test_code: string }>();

  // Idempotency: return the stored report if already completed.
  // Paper III: nudge grading again on retry when still pending/failed (e.g. lost queue message),
  // or when done but speaking audio is stuck on STT config errors (recoverable).
  if (attempt.status === 'completed') {
    if (testRow?.test_code === '03') {
      const gradeRow = await env.DB.prepare('SELECT grading_status FROM test_attempts WHERE id = ?')
        .bind(attemptId)
        .first<{ grading_status: string }>();
      let gradingStatus = gradeRow?.grading_status ?? 'none';
      if (gradingStatus === 'done') {
        const stuck = await env.DB.prepare(
          `SELECT COUNT(*) AS n FROM test_attempt_answers
           WHERE test_attempt_id = ? AND audio_r2_key IS NOT NULL AND audio_r2_key != ''
             AND (
               assemblyai_transcript_id IS NULL
               OR transcript_text LIKE '%ASSEMBLYAI_API_KEY not configured%'
               OR (ai_mark_json LIKE '%"unanswered"%' AND (transcript_status = 'error' OR transcript_status = 'none' OR transcript_status = 'queued'))
             )`,
        )
          .bind(attemptId)
          .first<{ n: number }>();
        if ((stuck?.n ?? 0) > 0) {
          await env.DB.prepare(`UPDATE test_attempts SET grading_status = 'pending' WHERE id = ?`)
            .bind(attemptId)
            .run();
          gradingStatus = 'pending';
        }
      }
      if (gradingStatus === 'pending' || gradingStatus === 'failed') {
        try {
          if (gradingStatus === 'failed') {
            await env.DB.prepare(`UPDATE test_attempts SET grading_status = 'pending' WHERE id = ?`)
              .bind(attemptId)
              .run();
          }
          await enqueuePaper3Grade(env as Paper3GradeEnv, attemptId, body.autoSubmitted === true);
        } catch (error) {
          console.error('Paper3 re-enqueue on idempotent submit failed', error);
        }
      }
    }
    return json(await buildReportPayload(env, attemptId), undefined, origin);
  }

  const usesAllowed = Number(session.uses_allowed ?? 1);
  const consumed = await consumeVoucherUse(env.DB, session.voucher_code, attempt.test_id, usesAllowed, session.token);
  if (!consumed) {
    return json({ error: 'NO_REMAINING_USES' }, { status: 409 }, origin);
  }

  // Paper III: consume voucher, mark completed, enqueue async grading (no MCQ score).
  if (testRow?.test_code === '03') {
    const now = Date.now();
    await env.DB.prepare(
      "UPDATE test_attempts SET end_time = ?, status = 'completed', grading_status = 'pending', overall_score = 0 WHERE id = ?",
    )
      .bind(now, attemptId)
      .run();
    // Attempt is already completed — do not fail the HTTP response if the queue nudge throws.
    try {
      await enqueuePaper3Grade(env as Paper3GradeEnv, attemptId, body.autoSubmitted === true);
    } catch (error) {
      console.error('Paper3 enqueue after submit failed', error);
    }
    await extendSession(env.DB, session.token, now + PDF_TTL_MS);
    return json(
      {
        variables: null,
        review: [],
        gradingStatus: 'pending',
        attemptId,
        testCode: '03',
      },
      undefined,
      origin,
    );
  }

  // Score in place against the served variants.
  await env.DB.prepare(
    `UPDATE test_attempt_answers
     SET is_correct = (
       SELECT CASE WHEN q.correct_answer = test_attempt_answers.selected_option THEN 1 ELSE 0 END
       FROM questions q WHERE q.id = test_attempt_answers.question_id
     )
     WHERE test_attempt_id = ?`,
  )
    .bind(attemptId)
    .run();

  const scored = await env.DB.prepare(
    `SELECT a.question_code, a.selected_option, a.is_correct,
            g.canonical_number, g.cefr_level, p.part_code, p.skill AS part_skill,
            d.key AS dimension_key, d.dimension_code
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
      selected_option: string | null;
      is_correct: number | null;
      canonical_number: number;
      cefr_level: string | null;
      part_code: string;
      part_skill: string | null;
      dimension_key: string | null;
      dimension_code: string | null;
    }>();
  const rows = scored.results ?? [];

  // Part scores.
  const partAgg = new Map<string, { skill: string; correct: number; total: number }>();
  for (const row of rows) {
    const agg = partAgg.get(row.part_code) ?? { skill: row.part_skill ?? '', correct: 0, total: 0 };
    agg.total += 1;
    agg.correct += row.is_correct === 1 ? 1 : 0;
    partAgg.set(row.part_code, agg);
  }
  const parts = [...partAgg.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([partCode, agg]) => ({ partCode, skill: agg.skill, correct: agg.correct, total: agg.total }));
  const overallCorrect = parts.reduce((sum, part) => sum + part.correct, 0);
  const overallTotal = parts.reduce((sum, part) => sum + part.total, 0);

  // Difficulty-dimension breakdown (B2 vs C1/C2 for Test 2).
  const dimAgg = new Map<string, { dimensionCode: string; partCode: string; correct: number; total: number }>();
  for (const row of rows) {
    if (!row.dimension_key || !row.dimension_code) continue;
    const agg = dimAgg.get(row.dimension_key) ?? {
      dimensionCode: row.dimension_code,
      partCode: row.part_code,
      correct: 0,
      total: 0,
    };
    agg.total += 1;
    agg.correct += row.is_correct === 1 ? 1 : 0;
    dimAgg.set(row.dimension_key, agg);
  }
  let dimensions = [...dimAgg.entries()].map(([key, agg]) => ({
    key,
    dimensionCode: agg.dimensionCode,
    partCode: agg.partCode,
    score: agg.correct,
    max: agg.total,
    levelKey: levelKeyForPct(agg.total > 0 ? agg.correct / agg.total : 0),
  }));
  let weakDimensionKeys = dimensions
    .filter((dim) => dim.levelKey === 'needsWork' || dim.levelKey === 'developing')
    .map((dim) => dim.key);

  // Bands from score_conversion_bands.
  const bandsResult = await env.DB.prepare(
    'SELECT test_part_id, min_correct, max_correct, band_key, cefr_label, level_label, ielts_indicative, toefl_indicative FROM score_conversion_bands WHERE test_id = ? ORDER BY sort_order',
  )
    .bind(attempt.test_id)
    .all<BandRow>();
  const bandRows = bandsResult.results ?? [];

  const partIdByCode = await env.DB.prepare('SELECT id, part_code FROM test_parts WHERE test_id = ?')
    .bind(attempt.test_id)
    .all<{ id: number; part_code: string }>();
  const partIds = new Map((partIdByCode.results ?? []).map((row) => [row.part_code, row.id]));

  const findBand = (partId: number | null, score: number) =>
    bandRows.find(
      (band) => band.test_part_id === partId && score >= band.min_correct && score <= band.max_correct,
    ) ?? null;

  const partBands = parts
    .map((part) => {
      const band = findBand(partIds.get(part.partCode) ?? -1, part.correct);
      return band
        ? {
            partCode: part.partCode,
            bandKey: band.band_key,
            cefrLabel: band.cefr_label,
            ielts: band.ielts_indicative,
            toefl: band.toefl_indicative,
          }
        : null;
    })
    .filter((band): band is NonNullable<typeof band> => band !== null);

  // Overall band: Paper I uses its own CEFR ladder (below). Otherwise the overall
  // grid when present, else average the part-band levels (Test 2 conversion rule).
  let overallBand: { bandKey: string; cefrLabel: string; ielts: string | null; toefl: string | null } | null = null;
  const isPaper1 = testRow?.test_code === '01';
  if (!isPaper1) {
    const overallGrid = findBand(null, overallCorrect);
    if (overallGrid) {
      overallBand = {
        bandKey: overallGrid.band_key,
        cefrLabel: overallGrid.cefr_label,
        ielts: overallGrid.ielts_indicative,
        toefl: overallGrid.toefl_indicative,
      };
    } else if (partBands.length > 0) {
      const levels = partBands.map((band) => BAND_LEVELS[band.bandKey] ?? 1);
      const avg = levels.reduce((sum, level) => sum + level, 0) / levels.length;
      // Round half DOWN — the conversion notes ask for a slightly strict mapping.
      const level = Math.min(5, Math.max(1, Math.ceil(avg - 0.5)));
      const overall = OVERALL_BANDS[level - 1];
      overallBand = { bandKey: overall.bandKey, cefrLabel: overall.cefrLabel, ielts: overall.ielts, toefl: overall.toefl };
    }
  }

  let paper1: ReportVariablesV1['paper1'] = undefined;
  let bands: ReportVariablesV1['bands'] = { overall: overallBand, parts: partBands };
  if (isPaper1) {
    const partAId = partIds.get('01') ?? -1;
    const partBId = partIds.get('02') ?? -1;
    paper1 = buildPaper1Report(rows, {
      partA: bandRows.filter((band) => band.test_part_id === partAId),
      partB: bandRows.filter((band) => band.test_part_id === partBId),
      overall: bandRows.filter((band) => band.test_part_id === null),
    });
    dimensions = paper1Dimensions(paper1);
    weakDimensionKeys = paper1.partA.growthKeys;
    bands = paper1Bands(paper1);
  }

  const userRow = attempt
    ? await env.DB.prepare(
        'SELECT u.external_ref, u.display_name, u.user_group, u.education_level FROM test_attempts a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?',
      )
        .bind(attemptId)
        .first<{ external_ref: string | null; display_name: string | null; user_group: string | null; education_level: string | null }>()
    : null;
  const userGroup = userRow?.user_group ?? 'General Learner';

  const now = Date.now();

  const startRow = await env.DB.prepare('SELECT start_time FROM test_attempts WHERE id = ?')
    .bind(attemptId)
    .first<{ start_time: number | null }>();
  const startTime = startRow?.start_time ?? now;

  await env.DB.prepare(
    "UPDATE test_attempts SET end_time = ?, status = 'completed', overall_score = ? WHERE id = ?",
  )
    .bind(now, overallCorrect, attemptId)
    .run();

  const variables: ReportVariablesV1 = {
    testCode: testRow?.test_code ?? '',
    candidate: {
      name: (body.candidateInfo?.name ?? '').trim() || userRow?.display_name || 'Anonymous Candidate',
      ref: (body.candidateInfo?.id ?? '').trim() || 'N/A',
      userGroup,
      educationLevel: userRow?.education_level ?? null,
    },
    attempt: {
      attemptId,
      startTime,
      endTime: now,
      durationSec: Math.max(0, Math.round((now - startTime) / 1000)),
      autoSubmitted: body.autoSubmitted === true,
    },
    scores: {
      overall: { correct: overallCorrect, total: overallTotal },
      parts,
    },
    dimensions,
    bands,
    weakDimensionKeys,
    paper1,
  };

  await env.DB.prepare(
    'INSERT OR REPLACE INTO attempt_reports (test_attempt_id, report_version, variables, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(
      attemptId,
      isPaper1 ? PAPER1_REPORT_VARIABLES_VERSION : REPORT_VARIABLES_VERSION,
      JSON.stringify(variables),
      now,
    )
    .run();

  await extendSession(env.DB, session.token, now + PDF_TTL_MS);
  if (env.R2_ASSETS) {
    try {
      await cacheAttemptPdf({ DB: env.DB, R2_ASSETS: env.R2_ASSETS }, attemptId);
    } catch (error) {
      console.error('PDF cache at submit failed', error);
    }
  }

  return json(await buildReportPayload(env, attemptId), undefined, origin);
}

// ---------------------------------------------------------------------------
// GET /api/attempts/:id/report — re-view with report credentials
// ---------------------------------------------------------------------------

async function getAttemptReport(
  request: Request,
  env: AttemptsEnv,
  origin: string | undefined,
  json: JsonResponder,
  attemptId: string,
  url: URL,
) {
  const { attempt, authorized } = await authorizeAttemptAccess(request, env, attemptId, url);
  if (!attempt) return json({ error: 'Not found' }, { status: 404 }, origin);
  if (!authorized) return json({ error: 'Unauthorized' }, { status: 401 }, origin);
  if (attempt.status !== 'completed') return json({ error: 'Report not ready' }, { status: 404 }, origin);

  const gradeRow = await env.DB.prepare('SELECT grading_status FROM test_attempts WHERE id = ?')
    .bind(attemptId)
    .first<{ grading_status: string }>();
  const gradingStatus = gradeRow?.grading_status ?? 'none';
  if (gradingStatus === 'pending') {
    return json({ variables: null, review: [], gradingStatus: 'pending', attemptId }, undefined, origin);
  }
  if (gradingStatus === 'failed') {
    return json({ variables: null, review: [], gradingStatus: 'failed', attemptId }, undefined, origin);
  }

  const teacherKey = (request.headers.get('X-Teacher-Key') ?? '').trim();
  return json(await buildReportPayload(env, attemptId, { includeProductions: Boolean(teacherKey) }), undefined, origin);
}

/**
 * Student payload: variables plus (Paper I) the feedback rows they reference — never stems,
 * options, or correct answers.
 */
async function buildReportPayload(
  env: AttemptsEnv,
  attemptId: string,
  options: { includeProductions?: boolean } = {},
) {
  const report = await env.DB.prepare(
    'SELECT report_version, variables FROM attempt_reports WHERE test_attempt_id = ?',
  )
    .bind(attemptId)
    .first<{ report_version: string; variables: string }>();

  const gradeRow = await env.DB.prepare('SELECT grading_status, test_id FROM test_attempts WHERE id = ?')
    .bind(attemptId)
    .first<{ grading_status: string; test_id: number }>();

  let variables: ReportVariablesV1 | null = null;
  if (report) {
    try {
      variables = JSON.parse(report.variables) as ReportVariablesV1;
    } catch {
      variables = null;
    }
  }
  const feedback: Record<string, FeedbackItem> = variables?.paper1
    ? await loadPaper1Feedback(env.DB, variables.paper1)
    : {};

  if (!options.includeProductions) {
    return {
      variables,
      feedback,
      gradingStatus: gradeRow?.grading_status ?? 'none',
      review: [],
    };
  }

  // Teacher Paper III dashboard: recordings / transcripts / essays, never MCQ keys.
  const productionResult = await env.DB.prepare(
    `SELECT a.question_code, a.display_order, a.text_response, a.audio_r2_key, a.transcript_text,
            a.ai_mark_json, a.ai_band_key, g.canonical_number, g.response_type, p.part_code,
            d.key AS dimension_key
     FROM test_attempt_answers a
     JOIN question_groups g ON g.id = a.question_group_id
     JOIN test_parts p ON p.id = g.test_part_id
     LEFT JOIN dimensions d ON d.id = g.dimension_id
     WHERE a.test_attempt_id = ?
       AND g.response_type IN ('speaking', 'writing')
     ORDER BY COALESCE(a.display_order, g.canonical_number)`,
  )
    .bind(attemptId)
    .all<{
      question_code: string;
      display_order: number | null;
      text_response: string | null;
      audio_r2_key: string | null;
      transcript_text: string | null;
      ai_mark_json: string | null;
      ai_band_key: string | null;
      canonical_number: number;
      response_type: string;
      part_code: string;
      dimension_key: string | null;
    }>();

  return {
    variables,
    feedback,
    gradingStatus: gradeRow?.grading_status ?? 'none',
    review: (productionResult.results ?? []).map((row) => {
      let aiMark: unknown = null;
      try {
        aiMark = row.ai_mark_json ? JSON.parse(row.ai_mark_json) : null;
      } catch {
        aiMark = null;
      }
      return {
        questionCode: row.question_code,
        partCode: row.part_code,
        canonicalNumber: row.canonical_number,
        displayOrder: row.display_order,
        responseType: row.response_type,
        dimensionKey: row.dimension_key,
        textResponse: row.text_response,
        audioUrl: row.audio_r2_key ? `/api/assets/responses/${row.audio_r2_key.replace(/^responses\//, '')}` : null,
        transcriptText: row.transcript_text,
        aiBandKey: row.ai_band_key,
        aiMark,
      };
    }),
  };
}
