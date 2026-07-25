// Authenticated R2 asset streaming:
//   GET /api/assets/audio/<key>      -> R2 audio/<key>   (prompt / listening clips)
//   GET /api/assets/responses/<key>  -> R2 responses/<key> (Paper III student recordings)
// Access requires an active quiz session (Bearer) or a teacher key.

type AssetsEnv = {
  DB: D1Database;
  R2_ASSETS: R2Bucket;
};

const AUDIO_PREFIX = '/api/assets/audio/';
const RESPONSES_PREFIX = '/api/assets/responses/';

async function hasActiveSession(request: Request, env: AssetsEnv): Promise<boolean> {
  const auth = request.headers.get('Authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token = ?')
    .bind(match[1])
    .first<{ expires_at: number }>();
  return !!row && row.expires_at > Date.now();
}

async function hasTeacherKey(request: Request, env: AssetsEnv): Promise<boolean> {
  const key = (request.headers.get('X-Teacher-Key') ?? '').trim();
  if (!key) return false;
  const row = await env.DB.prepare('SELECT key FROM teacher_credentials WHERE key = ?')
    .bind(key)
    .first<{ key: string }>();
  return !!row;
}

async function streamR2Object(
  request: Request,
  env: AssetsEnv,
  origin: string | undefined,
  json: (body: unknown, init?: ResponseInit, origin?: string) => Response,
  r2Key: string,
  defaultContentType: string,
): Promise<Response> {
  if (r2Key.includes('..')) return json({ error: 'Invalid key' }, { status: 400 }, origin);

  const authorized = (await hasActiveSession(request, env)) || (await hasTeacherKey(request, env));
  if (!authorized) return json({ error: 'Unauthorized' }, { status: 401 }, origin);

  const rangeHeader = request.headers.get('Range');
  const object = rangeHeader
    ? await env.R2_ASSETS.get(r2Key, { range: request.headers })
    : await env.R2_ASSETS.get(r2Key);
  if (!object) return json({ error: 'Not found' }, { status: 404 }, origin);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', headers.get('Content-Type') || defaultContentType);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, no-store');
  if (origin) headers.set('Access-Control-Allow-Origin', origin);

  if (rangeHeader && object.range) {
    const range = object.range as { offset?: number; length?: number };
    const offset = range.offset ?? 0;
    const length = range.length ?? object.size - offset;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}

export async function handleAssetRequest(
  request: Request,
  env: AssetsEnv,
  origin: string | undefined,
  json: (body: unknown, init?: ResponseInit, origin?: string) => Response,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname.startsWith(AUDIO_PREFIX)) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 }, origin);
    const key = `audio/${decodeURIComponent(url.pathname.slice(AUDIO_PREFIX.length))}`;
    return streamR2Object(request, env, origin, json, key, 'audio/mpeg');
  }

  if (url.pathname.startsWith(RESPONSES_PREFIX)) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 }, origin);
    const key = `responses/${decodeURIComponent(url.pathname.slice(RESPONSES_PREFIX.length))}`;
    return streamR2Object(request, env, origin, json, key, 'audio/webm');
  }

  return null;
}
