import type { AdminSummary, AdminVoucher, AdminVoucherList, BackendData, ReportResult, Session } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const ADMIN_PASSWORD_KEY = 'edt.adminPassword';

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

export function saveAdminPassword(password: string) {
  sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
}

export function loadAdminPassword() {
  return sessionStorage.getItem(ADMIN_PASSWORD_KEY) ?? '';
}

export function clearAdminPassword() {
  sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
}

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

export async function verifyVoucher(code: string): Promise<Session> {
  return parseJson<Session>(
    await fetch(`${API_BASE}/api/verify-voucher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }),
  );
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
  },
): Promise<{ voucher: AdminVoucher | null }> {
  return adminFetch<{ voucher: AdminVoucher | null }>(`/api/admin/vouchers/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
