import { requireApiUrl } from './Config';

interface RequestOptions {
  signal?: AbortSignal;
  idempotencyKey?: string;
}

// Robust UUID v4 generator with fallback for older environments
export const generateUUID = () => {
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

// Rate limiting state
let throttleCoolDownUntil = 0;
const THROTTLE_DURATION_MS = 5000;

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

// Sleep helper for backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// Core request function with retry logic
async function request<T>(
  method: string,
  path: string,
  body?: any,
  requiresAuth = true,
  options?: RequestOptions,
  retryCount = 0,
  stableIdempotencyKey?: string
): Promise<T> {
  const baseUrl = requireApiUrl();

  // Use provided key, or previous stable key from retry, or generate new one for mutations
  let currentIdempotencyKey = stableIdempotencyKey || options?.idempotencyKey;
  if (!currentIdempotencyKey && (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
    currentIdempotencyKey = generateUUID();
  }

  // Check for active throttle cooldown
  if (Date.now() < throttleCoolDownUntil) {
     const remaining = Math.ceil((throttleCoolDownUntil - Date.now()) / 1000);
     throw new Error(`Client is throttled. Retrying in ${remaining}s...`);
  }

  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
  };

  // Automated Idempotency-Key for all mutation requests
  if (currentIdempotencyKey) {
    headers['x-idempotency-key'] = currentIdempotencyKey;
  }

  // Only declare JSON content-type when sending a body
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (requiresAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
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
    const reqId = response.headers.get('x-request-id') || response.headers.get('X-Request-ID');
    let data: any = null;

    if (rawBody) {
      try {
        data = JSON.parse(rawBody);
      } catch {
        data = rawBody;
      }
    }

    if (!response.ok) {
      // Logic for retrying failed GET requests (transient errors 500, 502, 503, 504)
      const isTransientError = response.status >= 500 && response.status <= 504;
      if (method === 'GET' && isTransientError && retryCount < 3) {
        const backoffMs = Math.pow(2, retryCount) * 1000;
        console.warn(`[API] Retrying GET ${path} after ${backoffMs}ms... (Attempt ${retryCount + 1})`);
        await sleep(backoffMs);
        return request<T>(method, path, body, requiresAuth, options, retryCount + 1, currentIdempotencyKey);
      }

      // Handle the new standardized error format (supporting message arrays)
      let errorMessage = `Request failed with status ${response.status}`;
      
      if (typeof data === 'object' && data && 'message' in data) {
        if (Array.isArray(data.message)) {
          errorMessage = data.message.join('; ');
        } else {
          errorMessage = String(data.message);
        }
      } else if (typeof data === 'string' && data.trim()) {
        errorMessage = data;
      }

      // Handle 429 Rate Limiting
      if (response.status === 429) {
        throttleCoolDownUntil = Date.now() + THROTTLE_DURATION_MS;
        console.error('[API] 429 Too Many Requests. Throttling all requests for 5s.');
      }

      const error = new Error(errorMessage) as any;
      error.reqId = reqId;
      error.status = response.status;
      throw error;
    }

    return data as T;
  } catch (error: any) {
    if (retryCount === 0 && error.status !== 401) {
       // Auto-log to telemetry for observability
       import('./TelemetryService').then(({ telemetry }) => {
          telemetry.error(`API Error: ${method} ${path}`, error, { 
            reqId: error.reqId,
            status: error.status 
          });
       });
    }

    // Retry on network errors (lost connection)
    // Safe to retry mutations IF an idempotency key is present (the Golden Rule)
    const canRetryMutation = (method !== 'GET') && !!currentIdempotencyKey;
    const shouldRetry = (method === 'GET' || canRetryMutation);

    if (shouldRetry && error.message.includes('Failed to fetch') && retryCount < 3) {
      const backoffMs = Math.pow(2, retryCount) * 1000;
      console.warn(`[API] Connection lost during ${method} ${path}. Retrying with same key after ${backoffMs}ms...`);
      await sleep(backoffMs);
      return request<T>(method, path, body, requiresAuth, options, retryCount + 1, currentIdempotencyKey);
    }
    throw error;
  }
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
