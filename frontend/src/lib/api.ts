import type { BackendData, ReportResult, Session } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json;
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
