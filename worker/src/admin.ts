export type AdminEnv = {
  DB: D1Database;
  ADMIN_PASSWORD?: string;
};

type JsonResponder = (body: unknown, init?: ResponseInit, origin?: string) => Response;

type VoucherRow = {
  code: string;
  used_at: number | null;
  used_by_session: string | null;
  user_group: string;
  education_level: string | null;
  remark: string | null;
  sold_to: string | null;
};

const DEFAULT_USER_GROUP = 'General Learner';

export function isAdminAuthorized(request: Request, env: AdminEnv) {
  const password = request.headers.get('X-Admin-Password') ?? '';
  const expected = env.ADMIN_PASSWORD ?? 'EDT-Aa2026!';
  return password.length > 0 && password === expected;
}

export function adminUnauthorized(origin: string | undefined, json: JsonResponder) {
  return json({ error: 'Unauthorized' }, { status: 401 }, origin);
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function mapVoucher(row: VoucherRow) {
  return {
    code: row.code,
    used: row.used_at != null,
    usedAt: row.used_at,
    userGroup: row.user_group || DEFAULT_USER_GROUP,
    educationLevel: row.education_level,
    remark: row.remark,
    soldTo: row.sold_to,
  };
}

export async function adminSummary(_request: Request, env: AdminEnv, origin: string | undefined, json: JsonResponder) {
  const row = await env.DB.prepare(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS used,
      SUM(CASE WHEN used_at IS NULL THEN 1 ELSE 0 END) AS available,
      SUM(CASE WHEN sold_to IS NOT NULL AND sold_to != '' THEN 1 ELSE 0 END) AS assigned
    FROM vouchers`,
  ).first<{ total: number; used: number; available: number; assigned: number }>();

  return json(
    {
      total: Number(row?.total ?? 0),
      used: Number(row?.used ?? 0),
      available: Number(row?.available ?? 0),
      assigned: Number(row?.assigned ?? 0),
    },
    undefined,
    origin,
  );
}

export async function adminListVouchers(request: Request, env: AdminEnv, origin: string | undefined, json: JsonResponder) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().toUpperCase();
  const status = url.searchParams.get('status') ?? 'all';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);

  let sql = 'SELECT code, used_at, used_by_session, user_group, education_level, remark, sold_to FROM vouchers WHERE 1=1';
  const binds: Array<string | number> = [];

  if (q) {
    sql += ' AND code LIKE ?';
    binds.push(`%${q}%`);
  }
  if (status === 'used') {
    sql += ' AND used_at IS NOT NULL';
  } else if (status === 'available') {
    sql += ' AND used_at IS NULL';
  }

  sql += ' ORDER BY code ASC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const result = await env.DB.prepare(sql)
    .bind(...binds)
    .all<VoucherRow>();

  return json(
    {
      vouchers: (result.results ?? []).map(mapVoucher),
      limit,
      offset,
    },
    undefined,
    origin,
  );
}

export async function adminCreateVoucher(request: Request, env: AdminEnv, origin: string | undefined, json: JsonResponder) {
  const body = (await request.json()) as {
    code?: string;
    userGroup?: string;
    educationLevel?: string | null;
    remark?: string | null;
    soldTo?: string | null;
  };

  const code = body.code ? normalizeCode(body.code) : '';
  if (!code) {
    return json({ error: 'Voucher code is required' }, { status: 400 }, origin);
  }

  const userGroup = (body.userGroup ?? DEFAULT_USER_GROUP).trim() || DEFAULT_USER_GROUP;

  try {
    await env.DB.prepare(
      'INSERT INTO vouchers (code, user_group, education_level, remark, sold_to) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(code, userGroup, body.educationLevel ?? null, body.remark ?? null, body.soldTo ?? null)
      .run();
  } catch {
    return json({ error: 'Voucher code already exists' }, { status: 409 }, origin);
  }

  const row = await env.DB.prepare(
    'SELECT code, used_at, used_by_session, user_group, education_level, remark, sold_to FROM vouchers WHERE code = ?',
  )
    .bind(code)
    .first<VoucherRow>();

  return json({ voucher: row ? mapVoucher(row) : null }, { status: 201 }, origin);
}

export async function adminUpdateVoucher(request: Request, env: AdminEnv, codeParam: string, origin: string | undefined, json: JsonResponder) {
  const code = normalizeCode(codeParam);
  const body = (await request.json()) as {
    userGroup?: string;
    educationLevel?: string | null;
    remark?: string | null;
    soldTo?: string | null;
  };

  const existing = await env.DB.prepare('SELECT code FROM vouchers WHERE code = ?').bind(code).first();
  if (!existing) {
    return json({ error: 'Voucher not found' }, { status: 404 }, origin);
  }

  const userGroup = (body.userGroup ?? DEFAULT_USER_GROUP).trim() || DEFAULT_USER_GROUP;

  await env.DB.prepare(
    'UPDATE vouchers SET user_group = ?, education_level = ?, remark = ?, sold_to = ? WHERE code = ?',
  )
    .bind(userGroup, body.educationLevel ?? null, body.remark ?? null, body.soldTo ?? null, code)
    .run();

  const row = await env.DB.prepare(
    'SELECT code, used_at, used_by_session, user_group, education_level, remark, sold_to FROM vouchers WHERE code = ?',
  )
    .bind(code)
    .first<VoucherRow>();

  return json({ voucher: row ? mapVoucher(row) : null }, undefined, origin);
}

export async function handleAdminRequest(
  request: Request,
  env: AdminEnv,
  origin: string | undefined,
  json: JsonResponder,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/admin/')) {
    return null;
  }

  if (!isAdminAuthorized(request, env)) {
    return adminUnauthorized(origin, json);
  }

  if (url.pathname === '/api/admin/summary' && request.method === 'GET') {
    return adminSummary(request, env, origin, json);
  }

  if (url.pathname === '/api/admin/vouchers' && request.method === 'GET') {
    return adminListVouchers(request, env, origin, json);
  }

  if (url.pathname === '/api/admin/vouchers' && request.method === 'POST') {
    return adminCreateVoucher(request, env, origin, json);
  }

  const patchMatch = url.pathname.match(/^\/api\/admin\/vouchers\/([^/]+)$/);
  if (patchMatch && request.method === 'PATCH') {
    return adminUpdateVoucher(request, env, decodeURIComponent(patchMatch[1]), origin, json);
  }

  return json({ error: 'Not found' }, { status: 404 }, origin);
}

export function computePercentileStats(
  stats: { cohortSize: number; cohortMean: number | null; atOrBelow: number } | null,
) {
  const cohortSize = Number(stats?.cohortSize ?? 1);
  const cohortMean = stats?.cohortMean == null ? null : Math.round(Number(stats.cohortMean) * 10) / 10;
  const percentileRank =
    cohortSize > 0 ? Math.round((Number(stats?.atOrBelow ?? 1) / cohortSize) * 100) : null;
  return { cohortSize, cohortMean, percentileRank };
}
