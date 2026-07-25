// Paper III HTTP routes: audio upload + AssemblyAI webhook.

import { getSession } from './index';
import {
  createVerbatimTranscript,
  uploadAudioToAssemblyAI,
  fetchTranscript,
  verifyAssemblyWebhook,
  type AssemblyEnv,
} from './paper3Assembly';
import { enqueuePaper3Grade, type Paper3GradeEnv } from './paper3Grading';

type JsonResponder = (body: unknown, init?: ResponseInit, origin?: string) => Response;

type Paper3RouteEnv = AssemblyEnv &
  Paper3GradeEnv & {
    DB: D1Database;
    R2_ASSETS: R2Bucket;
  };

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function handlePaper3Route(
  request: Request,
  env: Paper3RouteEnv,
  ctx: ExecutionContext,
  origin: string | undefined,
  json: JsonResponder,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === '/api/webhooks/assemblyai' && request.method === 'POST') {
    return handleAssemblyWebhook(request, env, origin, json);
  }

  const audioMatch = url.pathname.match(/^\/api\/attempts\/([0-9a-fA-F-]{8,64})\/audio$/);
  if (audioMatch && request.method === 'POST') {
    return handleAudioUpload(request, env, ctx, origin, json, audioMatch[1]);
  }

  return null;
}

async function startAssemblyAiInBackground(
  env: Paper3RouteEnv,
  attemptId: string,
  questionCode: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  try {
    if (!env.ASSEMBLYAI_API_KEY) {
      await env.DB.prepare(
        `UPDATE test_attempt_answers SET transcript_status = 'error', transcript_text = ?
         WHERE test_attempt_id = ? AND question_code = ?`,
      )
        .bind('ASSEMBLYAI_API_KEY not configured', attemptId, questionCode)
        .run();
      return;
    }

    const uploadUrl = await uploadAudioToAssemblyAI(env, bytes, contentType);
    const webhookBase =
      env.ASSEMBLYAI_WEBHOOK_BASE && env.ASSEMBLYAI_WEBHOOK_BASE.startsWith('http')
        ? env.ASSEMBLYAI_WEBHOOK_BASE
        : undefined;
    const transcriptId = await createVerbatimTranscript(env, uploadUrl, webhookBase);
    await env.DB.prepare(
      `UPDATE test_attempt_answers
       SET assemblyai_transcript_id = ?, transcript_status = 'queued'
       WHERE test_attempt_id = ? AND question_code = ?`,
    )
      .bind(transcriptId, attemptId, questionCode)
      .run();
  } catch (error) {
    console.error('AssemblyAI start failed', error);
    await env.DB.prepare(
      `UPDATE test_attempt_answers SET transcript_status = 'error', transcript_text = ?
       WHERE test_attempt_id = ? AND question_code = ?`,
    )
      .bind(error instanceof Error ? error.message : 'STT failed', attemptId, questionCode)
      .run();
  }
}

async function handleAudioUpload(
  request: Request,
  env: Paper3RouteEnv,
  ctx: ExecutionContext,
  origin: string | undefined,
  json: JsonResponder,
  attemptId: string,
) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'Unauthorized' }, { status: 401 }, origin);

  const attempt = await env.DB.prepare(
    `SELECT a.id, a.session_token, a.status, t.test_code
     FROM test_attempts a JOIN tests t ON t.id = a.test_id WHERE a.id = ?`,
  )
    .bind(attemptId)
    .first<{ id: string; session_token: string | null; status: string; test_code: string }>();

  if (!attempt || attempt.session_token !== session.token) {
    return json({ error: 'Unauthorized' }, { status: 401 }, origin);
  }
  if (attempt.test_code !== '03') return json({ error: 'NOT_PAPER3' }, { status: 400 }, origin);
  if (attempt.status !== 'in-progress') return json({ error: 'ATTEMPT_COMPLETED' }, { status: 409 }, origin);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Invalid multipart body' }, { status: 400 }, origin);
  }

  const questionCode = String(form.get('questionCode') ?? '').trim();
  const fileEntry = form.get('file');
  const file =
    fileEntry && typeof fileEntry === 'object' && 'arrayBuffer' in fileEntry
      ? (fileEntry as Blob)
      : null;
  if (!questionCode || !file) {
    return json({ error: 'questionCode and file are required' }, { status: 400 }, origin);
  }

  const answer = await env.DB.prepare(
    `SELECT a.audio_r2_key, a.recording_status, g.response_type
     FROM test_attempt_answers a
     JOIN question_groups g ON g.id = a.question_group_id
     WHERE a.test_attempt_id = ? AND a.question_code = ?`,
  )
    .bind(attemptId, questionCode)
    .first<{ audio_r2_key: string | null; recording_status: string; response_type: string }>();

  if (!answer || answer.response_type !== 'speaking') {
    return json({ error: 'QUESTION_NOT_IN_ATTEMPT' }, { status: 404 }, origin);
  }
  if (answer.audio_r2_key || answer.recording_status === 'saved') {
    return json({ error: 'ALREADY_RECORDED' }, { status: 409 }, origin);
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AUDIO_BYTES) {
    return json({ error: 'Invalid audio size' }, { status: 400 }, origin);
  }

  const contentType = (file as Blob).type || 'audio/webm';
  const r2Key = `responses/test-03/${attemptId}/${questionCode}.webm`;
  await env.R2_ASSETS.put(r2Key, bytes, { httpMetadata: { contentType } });

  await env.DB.prepare(
    `UPDATE test_attempt_answers
     SET audio_r2_key = ?, audio_content_type = ?, audio_bytes = ?, recording_status = 'saved',
         transcript_status = 'queued', answered_at = ?
     WHERE test_attempt_id = ? AND question_code = ?`,
  )
    .bind(r2Key, contentType, bytes.byteLength, Date.now(), attemptId, questionCode)
    .run();

  // Return immediately after R2 save so the quiz UI can unlock. AssemblyAI is
  // slow/can hang — never block the student on STT startup.
  ctx.waitUntil(startAssemblyAiInBackground(env, attemptId, questionCode, bytes, contentType));
  return json({ ok: true, saved: true, transcriptStatus: 'queued' }, undefined, origin);
}

async function handleAssemblyWebhook(
  request: Request,
  env: Paper3RouteEnv,
  origin: string | undefined,
  json: JsonResponder,
) {
  if (!verifyAssemblyWebhook(request, env)) {
    return json({ error: 'Unauthorized' }, { status: 401 }, origin);
  }

  const body = (await request.json().catch(() => ({}))) as {
    transcript_id?: string;
    status?: string;
  };
  const transcriptId = body.transcript_id ?? '';
  if (!transcriptId) return json({ ok: true }, undefined, origin);

  const row = await env.DB.prepare(
    `SELECT test_attempt_id, question_code FROM test_attempt_answers WHERE assemblyai_transcript_id = ?`,
  )
    .bind(transcriptId)
    .first<{ test_attempt_id: string; question_code: string }>();

  if (!row) return json({ ok: true }, undefined, origin);

  try {
    const t = await fetchTranscript(env, transcriptId);
    if (t.status === 'completed') {
      await env.DB.prepare(
        `UPDATE test_attempt_answers
         SET transcript_status = 'completed', transcript_text = ?, transcript_words_json = ?
         WHERE assemblyai_transcript_id = ?`,
      )
        .bind(t.text ?? '', JSON.stringify(t.words ?? null), transcriptId)
        .run();
    } else if (t.status === 'error') {
      await env.DB.prepare(
        `UPDATE test_attempt_answers SET transcript_status = 'error', transcript_text = ?
         WHERE assemblyai_transcript_id = ?`,
      )
        .bind(t.error ?? 'error', transcriptId)
        .run();
    }
    await enqueuePaper3Grade(env, row.test_attempt_id);
  } catch (error) {
    console.error('Webhook transcript fetch failed', error);
  }

  return json({ ok: true }, undefined, origin);
}
