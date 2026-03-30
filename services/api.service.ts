import { requireApiUrl } from './Config';

interface RequestOptions {
  signal?: AbortSignal;
}

// Get token from localStorage
const getToken = (): string | null => {
  return localStorage.getItem('bica_token');
};

// Save token to localStorage
export const saveToken = (token: string): void => {
  localStorage.setItem('bica_token', token);
};

// Remove token on logout
export const clearToken = (): void => {
  localStorage.removeItem('bica_token');
};

// Core request function
async function request<T>(
  method: string,
  path: string,
  body?: any,
  requiresAuth = true,
  options?: RequestOptions,
): Promise<T> {
  const baseUrl = requireApiUrl();
  const headers: Record<string, string> = {};
  // Only declare JSON content-type when sending a body — NestJS/Fastify rejects
  // requests that have Content-Type: application/json but an empty body.
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (requiresAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  });

  const rawBody = await response.text();
  let data: any = null;

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = rawBody;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'message' in data
        ? (data.message as string)
        : typeof data === 'string' && data.trim()
          ? data
          : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

// Convenience methods
export const api = {
  get: <T>(path: string, requiresAuth = true, options?: RequestOptions) =>
    request<T>('GET', path, undefined, requiresAuth, options),

  post: <T>(path: string, body?: any, requiresAuth = true, options?: RequestOptions) =>
    request<T>('POST', path, body, requiresAuth, options),

  patch: <T>(path: string, body?: any, requiresAuth = true, options?: RequestOptions) =>
    request<T>('PATCH', path, body, requiresAuth, options),

  delete: <T>(path: string, requiresAuth = true, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, requiresAuth, options),
};
