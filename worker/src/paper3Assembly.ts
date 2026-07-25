// AssemblyAI verbatim STT for Paper III speaking responses.
// Upload: raw binary to POST /v2/upload (NOT multipart).
// Create: speech_models array + webhook; local queue retries poll status.

const AAI_BASE = 'https://api.assemblyai.com';
const VERBATIM_PROMPT =
  'Verbatim transcript of an English language exam. Do not correct any grammatical errors. Include all filler words (um, uh), hesitations, false starts, and repetitions exactly as spoken.';

export type AssemblyEnv = {
  ASSEMBLYAI_API_KEY?: string;
  ASSEMBLYAI_WEBHOOK_SECRET?: string;
  /**
   * Public HTTPS origin for AssemblyAI webhook_url (production only).
   * Leave unset locally — Queue consumer polls transcript status instead
   * (AssemblyAI cannot reach localhost).
   */
  ASSEMBLYAI_WEBHOOK_BASE?: string;
};

export type TranscriptResult = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text: string | null;
  words: unknown;
  error: string | null;
};

export async function uploadAudioToAssemblyAI(env: AssemblyEnv, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const key = env.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error('ASSEMBLYAI_API_KEY not configured');

  const response = await fetch(`${AAI_BASE}/v2/upload`, {
    method: 'POST',
    headers: {
      Authorization: key,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: bytes,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AssemblyAI upload failed: ${response.status} ${detail}`);
  }
  const data = (await response.json()) as { upload_url?: string };
  if (!data.upload_url) throw new Error('AssemblyAI upload missing upload_url');
  return data.upload_url;
}

export async function createVerbatimTranscript(
  env: AssemblyEnv,
  audioUrl: string,
  webhookBaseUrl?: string,
): Promise<string> {
  const key = env.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error('ASSEMBLYAI_API_KEY not configured');

  const body: Record<string, unknown> = {
    audio_url: audioUrl,
    speech_models: ['universal-3-5-pro', 'universal-2'],
    prompt: VERBATIM_PROMPT,
  };

  if (webhookBaseUrl && env.ASSEMBLYAI_WEBHOOK_SECRET) {
    const base = webhookBaseUrl.replace(/\/$/, '');
    body.webhook_url = `${base}/api/webhooks/assemblyai`;
    body.webhook_auth_header_name = 'X-Edt-Webhook-Secret';
    body.webhook_auth_header_value = env.ASSEMBLYAI_WEBHOOK_SECRET;
  }

  const response = await fetch(`${AAI_BASE}/v2/transcript`, {
    method: 'POST',
    headers: {
      Authorization: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AssemblyAI transcript create failed: ${response.status} ${detail}`);
  }
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error('AssemblyAI transcript missing id');
  return data.id;
}

export async function fetchTranscript(env: AssemblyEnv, transcriptId: string): Promise<TranscriptResult> {
  const key = env.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error('ASSEMBLYAI_API_KEY not configured');

  const response = await fetch(`${AAI_BASE}/v2/transcript/${transcriptId}`, {
    headers: { Authorization: key },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AssemblyAI fetch failed: ${response.status} ${detail}`);
  }
  const data = (await response.json()) as {
    id: string;
    status: string;
    text?: string | null;
    words?: unknown;
    error?: string | null;
  };
  return {
    id: data.id,
    status: (data.status as TranscriptResult['status']) ?? 'error',
    text: data.text ?? null,
    words: data.words ?? null,
    error: data.error ?? null,
  };
}

export function verifyAssemblyWebhook(request: Request, env: AssemblyEnv): boolean {
  const secret = env.ASSEMBLYAI_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = request.headers.get('X-Edt-Webhook-Secret') ?? '';
  return header === secret;
}
