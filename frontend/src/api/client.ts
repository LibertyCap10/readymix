/**
 * API Client — thin fetch wrapper for the ReadyMix backend.
 *
 * Reads VITE_API_BASE_URL from environment, prepends it to all paths,
 * parses JSON responses, and throws structured errors on non-2xx.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '') as string;

export interface ApiError {
  status: number;
  message: string;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    const error: ApiError = {
      status: res.status,
      message: data?.message ?? data?.error ?? `Request failed: ${res.status}`,
    };
    throw error;
  }

  return data as T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const api = {
  get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return request<T>('GET', path + buildQuery(params ?? {}));
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>('POST', path, body);
  },
  patch<T>(path: string, body: unknown, params?: Record<string, string | number | undefined>): Promise<T> {
    return request<T>('PATCH', path + buildQuery(params ?? {}), body);
  },
};
