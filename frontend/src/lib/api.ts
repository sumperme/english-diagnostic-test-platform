import type {
  AdminAiUsage,
  AdminSummary,
  AdminTeacherCredential,
  AdminTeacherCredentialList,
  AdminVoucher,
  AdminVoucherList,
  AiFeedbackResponse,
  AttemptInstance,
  AttemptReportPayload,
  BackendData,
  ClassOverview,
  ClassOverviewList,
  AiQuota,
  ReportResult,
  Session,
  TeacherDashboardData,
  TeacherSession,
  TestAvailability,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const ADMIN_PASSWORD_KEY = 'edt.adminPassword';
const TEACHER_SESSION_KEY = 'edt.teacherSession';

export class ApiError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new ApiError(json.error ?? 'Request failed', json.error ?? 'Request failed');
  }
  return json;
}

// --- Admin password helpers ---

export function saveAdminPassword(password: string) {
  sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
}

export function loadAdminPassword() {
  return sessionStorage.getItem(ADMIN_PASSWORD_KEY) ?? '';
}

export function clearAdminPassword() {
  sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
}

// --- Teacher session helpers ---

export function saveTeacherSession(session: TeacherSession) {
  sessionStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(session));
}

export function loadTeacherSession(): TeacherSession | null {
  try {
    const raw = sessionStorage.getItem(TEACHER_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TeacherSession;
  } catch {
    return null;
  }
}

export function clearTeacherSession() {
  sessionStorage.removeItem(TEACHER_SESSION_KEY);
}

// --- Generic fetch helpers ---

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const password = loadAdminPassword();
  return parseJson<T>(
    await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': password,
        ...(init.headers ?? {}),
      },
    }),
  );
}

async function teacherFetch<T>(path: string, teacherKey: string, init: RequestInit = {}): Promise<T> {
  return parseJson<T>(
    await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Teacher-Key': teacherKey,
        ...(init.headers ?? {}),
      },
    }),
  );
}

// --- Student API ---

export async function verifyVoucher(code: string): Promise<Session> {
  return parseJson<Session>(
    await fetch(`${API_BASE}/api/verify-voucher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }),
  );
}

/** Fresh per-test remaining uses for the active session (voucher-scoped). */
export async function fetchTestAvailability(sessionToken: string): Promise<TestAvailability[]> {
  const data = await parseJson<{ tests: TestAvailability[] }>(
    await fetch(`${API_BASE}/api/session/tests`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }),
  );
  return data.tests;
}

export async function submitReport(result: ReportResult, sessionToken: string): Promise<BackendData> {
  return parseJson<BackendData>(
    await fetch(`${API_BASE}/api/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    }),
  );
}

// --- Attempts API (DB-backed tests, e.g. Paper II) ---

function bearerHeaders(sessionToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  };
}

export async function startAttempt(
  testCode: string,
  candidateInfo: { name: string; id: string },
  sessionToken: string,
): Promise<AttemptInstance> {
  return parseJson<AttemptInstance>(
    await fetch(`${API_BASE}/api/attempts`, {
      method: 'POST',
      headers: bearerHeaders(sessionToken),
      body: JSON.stringify({ testCode, candidateInfo }),
    }),
  );
}

export async function saveAttemptAnswer(
  attemptId: string,
  questionCode: string,
  selectedOption: string | null,
  sessionToken: string,
): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`${API_BASE}/api/attempts/${encodeURIComponent(attemptId)}/answers`, {
      method: 'POST',
      headers: bearerHeaders(sessionToken),
      body: JSON.stringify({ questionCode, selectedOption }),
    }),
  );
}

export async function submitAttempt(
  attemptId: string,
  candidateInfo: { name: string; id: string },
  autoSubmitted: boolean,
  sessionToken: string,
): Promise<AttemptReportPayload> {
  return parseJson<AttemptReportPayload>(
    await fetch(`${API_BASE}/api/attempts/${encodeURIComponent(attemptId)}/submit`, {
      method: 'POST',
      headers: bearerHeaders(sessionToken),
      body: JSON.stringify({ candidateInfo, autoSubmitted }),
    }),
  );
}

export async function fetchAttemptReport(attemptId: string, sessionToken: string): Promise<AttemptReportPayload> {
  return parseJson<AttemptReportPayload>(
    await fetch(`${API_BASE}/api/attempts/${encodeURIComponent(attemptId)}/report`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }),
  );
}

/**
 * Audio elements cannot send Authorization headers, so protected clips are
 * fetched as blobs with the session token and played from an object URL.
 */
export async function fetchAudioBlob(url: string, sessionToken: string): Promise<string> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new ApiError('AUDIO_FETCH_FAILED', `Audio request failed (${response.status})`);
  }
  return URL.createObjectURL(await response.blob());
}

/** Server-rendered report PDF: fetch as blob with credentials, then trigger a download. */
export async function downloadServerReportPdf(
  attemptId: string,
  lang: 'en' | 'zh-HK',
  sessionToken: string,
  fallbackFilename?: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/reports/${encodeURIComponent(attemptId)}/pdf?lang=${encodeURIComponent(lang)}`,
    { headers: { Authorization: `Bearer ${sessionToken}` } },
  );
  if (!response.ok) {
    throw new ApiError('PDF_DOWNLOAD_FAILED', `PDF request failed (${response.status})`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filenameMatch = disposition.match(/filename="([^"]+)"/i);
  const filename = filenameMatch?.[1] ?? fallbackFilename ?? `EDT-Report_${attemptId}.pdf`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

// --- AI feedback (DeepSeek) ---

export async function fetchAiFeedback(attemptId: string, sessionToken: string): Promise<AiFeedbackResponse> {
  return parseJson<AiFeedbackResponse>(
    await fetch(`${API_BASE}/api/attempts/${encodeURIComponent(attemptId)}/ai-feedback`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }),
  );
}

/**
 * Start generation. 202 -> pending; 409 ALREADY_GENERATED -> resolved as done
 * with the stored feedback (permanent one-per-attempt limit).
 */
export async function startAiFeedback(attemptId: string, sessionToken: string): Promise<AiFeedbackResponse> {
  const response = await fetch(`${API_BASE}/api/attempts/${encodeURIComponent(attemptId)}/ai-feedback`, {
    method: 'POST',
    headers: bearerHeaders(sessionToken),
  });
  const body = (await response.json()) as AiFeedbackResponse & { error?: string };
  if (response.status === 409 && body.error === 'ALREADY_GENERATED') {
    return { status: 'done', feedback: body.feedback ?? null };
  }
  if (!response.ok && response.status !== 202) {
    throw new ApiError(body.error ?? 'AI_FAILED', `AI feedback request failed (${response.status})`);
  }
  return { status: body.status ?? 'pending', feedback: body.feedback ?? null };
}

export async function generateClassOverview(
  teacherKey: string,
): Promise<{ overview: Omit<ClassOverview, 'id'>; quota: AiQuota }> {
  return parseJson(
    await fetch(`${API_BASE}/api/teacher/class-overview`, {
      method: 'POST',
      headers: { 'X-Teacher-Key': teacherKey },
    }),
  );
}

export async function fetchClassOverviews(teacherKey: string): Promise<ClassOverviewList> {
  return parseJson<ClassOverviewList>(
    await fetch(`${API_BASE}/api/teacher/class-overviews`, {
      headers: { 'X-Teacher-Key': teacherKey },
    }),
  );
}

// --- Teacher API ---

export async function verifyTeacherKey(key: string): Promise<TeacherSession> {
  const data = await parseJson<{ userGroup: string }>(
    await fetch(`${API_BASE}/api/teacher/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    }),
  );
  return { teacherKey: key, userGroup: data.userGroup };
}

export async function fetchTeacherDashboard(teacherKey: string): Promise<TeacherDashboardData> {
  return teacherFetch<TeacherDashboardData>('/api/teacher/dashboard', teacherKey);
}

// --- Admin: Vouchers ---

export async function fetchAdminSummary(): Promise<AdminSummary> {
  return adminFetch<AdminSummary>('/api/admin/summary');
}

export async function fetchAdminVouchers(params?: {
  q?: string;
  status?: 'all' | 'used' | 'available';
  limit?: number;
  offset?: number;
}): Promise<AdminVoucherList> {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.status && params.status !== 'all') search.set('status', params.status);
  if (params?.limit != null) search.set('limit', String(params.limit));
  if (params?.offset != null) search.set('offset', String(params.offset));
  const query = search.toString();
  return adminFetch<AdminVoucherList>(`/api/admin/vouchers${query ? `?${query}` : ''}`);
}

export async function createAdminVoucher(input: {
  code: string;
  userGroup?: string;
  educationLevel?: string | null;
  remark?: string | null;
  soldTo?: string | null;
}): Promise<{ voucher: AdminVoucher | null }> {
  return adminFetch<{ voucher: AdminVoucher | null }>('/api/admin/vouchers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminVoucher(
  code: string,
  input: {
    userGroup?: string;
    educationLevel?: string | null;
    remark?: string | null;
    soldTo?: string | null;
    usesAllowed?: number;
  },
): Promise<{ voucher: AdminVoucher | null }> {
  return adminFetch<{ voucher: AdminVoucher | null }>(`/api/admin/vouchers/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// --- Admin: User Groups ---

export async function fetchAdminUserGroups(): Promise<{ userGroups: string[] }> {
  return adminFetch<{ userGroups: string[] }>('/api/admin/user-groups');
}

// --- Admin: Teacher Credentials ---

export async function fetchAdminTeacherCredentials(): Promise<AdminTeacherCredentialList> {
  return adminFetch<AdminTeacherCredentialList>('/api/admin/teacher-credentials');
}

export async function createAdminTeacherCredential(input: {
  key: string;
  userGroup: string;
  remark?: string | null;
}): Promise<{ credential: AdminTeacherCredential | null }> {
  return adminFetch<{ credential: AdminTeacherCredential | null }>('/api/admin/teacher-credentials', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminTeacherCredential(
  key: string,
  input: { remark?: string | null; aiUsesAllowed?: number },
): Promise<{ credential: AdminTeacherCredential | null }> {
  return adminFetch<{ credential: AdminTeacherCredential | null }>(
    `/api/admin/teacher-credentials/${encodeURIComponent(key)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export async function deleteAdminTeacherCredential(key: string): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(
    `/api/admin/teacher-credentials/${encodeURIComponent(key)}`,
    { method: 'DELETE' },
  );
}

// --- Admin: AI usage logging ---

export async function fetchAdminAiUsage(params?: {
  limit?: number;
  offset?: number;
}): Promise<AdminAiUsage> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set('limit', String(params.limit));
  if (params?.offset != null) search.set('offset', String(params.offset));
  const query = search.toString();
  return adminFetch<AdminAiUsage>(`/api/admin/ai-usage${query ? `?${query}` : ''}`);
}
