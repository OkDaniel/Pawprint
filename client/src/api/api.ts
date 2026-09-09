import type { ApiErrorResponse } from '@capstone/shared';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const requestOptions: RequestInit = { ...options, credentials: 'same-origin' };
  if (options?.body) {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    requestOptions.headers = headers;
  }
  const response = await fetch(path, requestOptions);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorResponse | null;
    throw new ApiError(body?.error.message ?? 'The request failed.', response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
