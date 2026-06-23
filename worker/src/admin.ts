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
  uses_allowed: number;
  use_count: number;
};

type TeacherCredentialRow = {
  key: string;
  user_group: string;
  remark: string | null;
  created_at: number;
  voucher_count: number;
  total_use_count: number;
  total_uses_allowed: number;
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

function normalizeUserGroup(userGroup: string | null | undefined) {
  return userGroup?.trim() || DEFAULT_USER_GROUP;
}

/** Reclassify all submissions for a voucher when its user group changes. */
async function syncSubmissionsUserGroupForVoucher(env: AdminEnv, voucherCode: string, userGroup: string) {
  await env.DB.prepare(
    `UPDATE submissions
     SET user_group = ?
     WHERE session_token IN (SELECT token FROM sessions WHERE voucher_code = ?)`,
  )
    .bind(userGroup, voucherCode)
    .run();

  const result = await env.DB.prepare(
    `SELECT id, payload FROM submissions
     WHERE session_token IN (SELECT token FROM sessions WHERE voucher_code = ?)`,
  )
    .bind(voucherCode)
    .all<{ id: string; payload: string }>();

  const updates = (result.results ?? [])
    .map((row) => {
      try {
        const payload = JSON.parse(row.payload) as {
          candidateInfo?: { userGroup?: string; [key: string]: unknown };
          [key: string]: unknown;
        };
        if (!payload.candidateInfo || typeof payload.candidateInfo !== 'object') {
          return null;
        }
        payload.candidateInfo.userGroup = userGroup;
        return env.DB.prepare('UPDATE submissions SET payload = ? WHERE id = ?').bind(
          JSON.stringify(payload),
          row.id,
        );
      } catch {
        return null;
      }
    })
    .filter((stmt): stmt is D1PreparedStatement => stmt != null);

  if (updates.length > 0) {
    await env.DB.batch(updates);
  }
}

function mapVoucher(row: VoucherRow) {
  const usesAllowed = Number(row.uses_allowed ?? 1);
  const useCount = Number(row.use_count ?? 0);
  return {
    code: row.code,
    used: useCount >= usesAllowed,
    usedAt: row.used_at,
    usesAllowed,
    useCount,
    userGroup: row.user_group || DEFAULT_USER_GROUP,
    educationLevel: row.education_level,
    remark: row.remark,
    soldTo: row.sold_to,
  };
}

function mapTeacherCredential(row: TeacherCredentialRow) {
  return {
    key: row.key,
    userGroup: row.user_group,
    remark: row.remark,
    createdAt: row.created_at,
    voucherCount: Number(row.voucher_count ?? 0),
    totalUseCount: Number(row.total_use_count ?? 0),
    totalUsesAllowed: Number(row.total_uses_allowed ?? 0),
  };
}

export async function adminSummary(_request: Request, env: AdminEnv, origin: string | undefined, json: JsonResponder) {
  const row = await env.DB.prepare(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN use_count >= uses_allowed THEN 1 ELSE 0 END) AS used,
      SUM(CASE WHEN use_count < uses_allowed THEN 1 ELSE 0 END) AS available,
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

  let sql = 'SELECT code, used_at, used_by_session, user_group, education_level, remark, sold_to, uses_allowed, use_count FROM vouchers WHERE 1=1';
  const binds: Array<string | number> = [];

  if (q) {
    sql += ' AND code LIKE ?';
    binds.push(`%${q}%`);
  }
  if (status === 'used') {
    sql += ' AND use_count >= uses_allowed';
  } else if (status === 'available') {
    sql += ' AND use_count < uses_allowed';
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
    'SELECT code, used_at, used_by_session, user_group, education_level, remark, sold_to, uses_allowed, use_count FROM vouchers WHERE code = ?',
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
    usesAllowed?: number;
  };

  const existing = await env.DB.prepare(
    'SELECT code, use_count, user_group FROM vouchers WHERE code = ?',
  ).bind(code).first<{ code: string; use_count: number; user_group: string | null }>();
  if (!existing) {
    return json({ error: 'Voucher not found' }, { status: 404 }, origin);
  }

  const previousUserGroup = normalizeUserGroup(existing.user_group);
  const userGroup = normalizeUserGroup(body.userGroup);

  let usesAllowed: number | undefined;
  if (body.usesAllowed != null) {
    usesAllowed = Math.floor(Number(body.usesAllowed));
    if (!Number.isFinite(usesAllowed) || usesAllowed < 1) {
      return json({ error: 'Uses allowed must be an integer of at least 1' }, { status: 400 }, origin);
    }
    if (usesAllowed < Number(existing.use_count ?? 0)) {
      return json(
        { error: `Uses allowed cannot be less than current use count (${existing.use_count})` },
        { status: 400 },
        origin,
      );
    }
  }

  if (usesAllowed != null) {
    await env.DB.prepare(
      'UPDATE vouchers SET user_group = ?, education_level = ?, remark = ?, sold_to = ?, uses_allowed = ? WHERE code = ?',
    )
      .bind(userGroup, body.educationLevel ?? null, body.remark ?? null, body.soldTo ?? null, usesAllowed, code)
      .run();
  } else {
    await env.DB.prepare(
      'UPDATE vouchers SET user_group = ?, education_level = ?, remark = ?, sold_to = ? WHERE code = ?',
    )
      .bind(userGroup, body.educationLevel ?? null, body.remark ?? null, body.soldTo ?? null, code)
      .run();
  }

  if (userGroup !== previousUserGroup) {
    await syncSubmissionsUserGroupForVoucher(env, code, userGroup);
  }

  const row = await env.DB.prepare(
    'SELECT code, used_at, used_by_session, user_group, education_level, remark, sold_to, uses_allowed, use_count FROM vouchers WHERE code = ?',
  )
    .bind(code)
    .first<VoucherRow>();

  return json({ voucher: row ? mapVoucher(row) : null }, undefined, origin);
}

// --- Teacher Credential handlers ---

export async function adminListTeacherCredentials(_request: Request, env: AdminEnv, origin: string | undefined, json: JsonResponder) {
  const result = await env.DB.prepare(
    `SELECT
       tc.key,
       tc.user_group,
       tc.remark,
       tc.created_at,
       COUNT(v.code) AS voucher_count,
       COALESCE(SUM(v.use_count), 0) AS total_use_count,
       COALESCE(SUM(v.uses_allowed), 0) AS total_uses_allowed
     FROM teacher_credentials tc
     LEFT JOIN vouchers v ON v.user_group = tc.user_group
     GROUP BY tc.key, tc.user_group, tc.remark, tc.created_at
     ORDER BY tc.user_group ASC`,
  ).all<TeacherCredentialRow>();

  return json({ credentials: (result.results ?? []).map(mapTeacherCredential) }, undefined, origin);
}

export async function adminCreateTeacherCredential(request: Request, env: AdminEnv, origin: string | undefined, json: JsonResponder) {
  const body = (await request.json()) as {
    key?: string;
    userGroup?: string;
    remark?: string | null;
  };

  const key = (body.key ?? '').trim();
  if (!key) {
    return json({ error: 'Teacher key is required' }, { status: 400 }, origin);
  }

  const userGroup = (body.userGroup ?? '').trim().slice(0, 30);
  if (!userGroup) {
    return json({ error: 'User group is required' }, { status: 400 }, origin);
  }

  const now = Date.now();
  try {
    const existingGroup = await env.DB.prepare('SELECT key FROM teacher_credentials WHERE user_group = ?').bind(userGroup).first<{ key: string }>();
    if (existingGroup) {
      return json({ error: `User group '${userGroup}' is already linked to teacher key '${existingGroup.key}'. Please modify the existing key in the table below.` }, { status: 409 }, origin);
    }

    await env.DB.prepare(
      'INSERT INTO teacher_credentials (key, user_group, remark, created_at) VALUES (?, ?, ?, ?)',
    )
      .bind(key, userGroup, body.remark ?? null, now)
      .run();
  } catch {
    return json({ error: 'Teacher key already exists' }, { status: 409 }, origin);
  }

  const row = await env.DB.prepare(
    `SELECT tc.key, tc.user_group, tc.remark, tc.created_at,
       COUNT(v.code) AS voucher_count,
       COALESCE(SUM(v.use_count), 0) AS total_use_count,
       COALESCE(SUM(v.uses_allowed), 0) AS total_uses_allowed
     FROM teacher_credentials tc
     LEFT JOIN vouchers v ON v.user_group = tc.user_group
     WHERE tc.key = ?
     GROUP BY tc.key`,
  )
    .bind(key)
    .first<TeacherCredentialRow>();

  return json({ credential: row ? mapTeacherCredential(row) : null }, { status: 201 }, origin);
}

export async function adminUpdateTeacherCredential(request: Request, env: AdminEnv, keyParam: string, origin: string | undefined, json: JsonResponder) {
  const key = keyParam.trim();
  const body = (await request.json()) as { remark?: string | null };

  const existing = await env.DB.prepare('SELECT key FROM teacher_credentials WHERE key = ?').bind(key).first();
  if (!existing) {
    return json({ error: 'Teacher credential not found' }, { status: 404 }, origin);
  }

  await env.DB.prepare('UPDATE teacher_credentials SET remark = ? WHERE key = ?')
    .bind(body.remark ?? null, key)
    .run();

  const row = await env.DB.prepare(
    `SELECT tc.key, tc.user_group, tc.remark, tc.created_at,
       COUNT(v.code) AS voucher_count,
       COALESCE(SUM(v.use_count), 0) AS total_use_count,
       COALESCE(SUM(v.uses_allowed), 0) AS total_uses_allowed
     FROM teacher_credentials tc
     LEFT JOIN vouchers v ON v.user_group = tc.user_group
     WHERE tc.key = ?
     GROUP BY tc.key`,
  )
    .bind(key)
    .first<TeacherCredentialRow>();

  return json({ credential: row ? mapTeacherCredential(row) : null }, undefined, origin);
}

export async function adminDeleteTeacherCredential(_request: Request, env: AdminEnv, keyParam: string, origin: string | undefined, json: JsonResponder) {
  const key = keyParam.trim();

  const existing = await env.DB.prepare(
    'SELECT key, user_group FROM teacher_credentials WHERE key = ?',
  ).bind(key).first<{ key: string; user_group: string }>();

  if (!existing) {
    return json({ error: 'Teacher credential not found' }, { status: 404 }, origin);
  }

  // Reassign all vouchers under this group back to the default before removing the credential.
  await env.DB.prepare(
    'UPDATE vouchers SET user_group = ? WHERE user_group = ?',
  ).bind(DEFAULT_USER_GROUP, existing.user_group).run();

  await env.DB.prepare('DELETE FROM teacher_credentials WHERE key = ?').bind(key).run();

  return json({ ok: true }, undefined, origin);
}

export async function adminListUserGroups(_request: Request, env: AdminEnv, origin: string | undefined, json: JsonResponder) {
  // Union user groups from both teacher_credentials (defined groups) and vouchers
  // (groups already in use), so the dropdown is always complete.
  const result = await env.DB.prepare(
    `SELECT DISTINCT user_group FROM (
       SELECT user_group FROM teacher_credentials
       UNION
       SELECT user_group FROM vouchers WHERE user_group IS NOT NULL AND user_group != ''
     ) ORDER BY user_group ASC`,
  ).all<{ user_group: string }>();

  const groups = (result.results ?? []).map((r) => r.user_group);
  // DEFAULT_USER_GROUP always appears first
  const withDefault = [DEFAULT_USER_GROUP, ...groups.filter((g) => g !== DEFAULT_USER_GROUP)];

  return json({ userGroups: withDefault }, undefined, origin);
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

  const patchVoucherMatch = url.pathname.match(/^\/api\/admin\/vouchers\/([^/]+)$/);
  if (patchVoucherMatch && request.method === 'PATCH') {
    return adminUpdateVoucher(request, env, decodeURIComponent(patchVoucherMatch[1]), origin, json);
  }

  // Teacher credential routes
  if (url.pathname === '/api/admin/teacher-credentials' && request.method === 'GET') {
    return adminListTeacherCredentials(request, env, origin, json);
  }

  if (url.pathname === '/api/admin/teacher-credentials' && request.method === 'POST') {
    return adminCreateTeacherCredential(request, env, origin, json);
  }

  const teacherKeyMatch = url.pathname.match(/^\/api\/admin\/teacher-credentials\/([^/]+)$/);
  if (teacherKeyMatch) {
    const keyParam = decodeURIComponent(teacherKeyMatch[1]);
    if (request.method === 'PATCH') {
      return adminUpdateTeacherCredential(request, env, keyParam, origin, json);
    }
    if (request.method === 'DELETE') {
      return adminDeleteTeacherCredential(request, env, keyParam, origin, json);
    }
  }

  // User groups list for admin UI dropdowns
  if (url.pathname === '/api/admin/user-groups' && request.method === 'GET') {
    return adminListUserGroups(request, env, origin, json);
  }

  return json({ error: 'Not found' }, { status: 404 }, origin);
}

export function computePercentileStats(
  stats: { cohortSize: number; cohortMean: number | null; strictlyAbove: number } | null,
) {
  const cohortSize = Number(stats?.cohortSize ?? 0);
  const cohortMean = stats?.cohortMean == null ? null : Math.round(Number(stats.cohortMean) * 10) / 10;
  const strictlyAbove = Number(stats?.strictlyAbove ?? 0);
  const cohortRank = cohortSize > 0 ? strictlyAbove + 1 : null;
  const percentileRank =
    cohortSize >= 2 && cohortRank != null
      ? Math.round(((cohortSize - cohortRank) / (cohortSize - 1)) * 100)
      : null;
  return { cohortSize, cohortMean, cohortRank, percentileRank };
}
