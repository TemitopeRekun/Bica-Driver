import { requireApiUrl } from './Config';

interface RequestOptions {
  signal?: AbortSignal;
  idempotencyKey?: string;
}

// Robust UUID v4 generator with fallback for older environments
const generateUUID = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  } catch (e) {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  }
};

// Listener for 401 errors to trigger global logout
type UnauthorizedListener = (message?: string) => void;
let unauthorizedListener: UnauthorizedListener | null = null;

export const setOnUnauthorizedListener = (listener: UnauthorizedListener) => {
  unauthorizedListener = listener;
};

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
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
  };

  // Automated Idempotency-Key for all mutation requests
  if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    headers['X-Idempotency-Key'] = options?.idempotencyKey || generateUUID();
  }

  // Only declare JSON content-type when sending a body (except for DELETE which might not have one)
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

  // Handle centralized 401 Unauthorized
  if (response.status === 401 && requiresAuth) {
    if (unauthorizedListener) {
      unauthorizedListener('Your session has expired. Please log in again.');
    }
    throw new Error('Unauthorized');
  }

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
