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

  // Human-friendly error normalization
  const normalizeErrorMessage = (status: number, originalMessage: string) => {
    switch (status) {
      case 401: return 'Your session has expired. Please log in again to continue.';
      case 403: return 'You don\'t have permission to perform this action. If you believe this is an error, please contact support.';
      case 404: return 'We couldn\'t find what you were looking for. It might have been moved or deleted.';
      case 409: 
        if (originalMessage.includes('idempotency')) return 'This request is already being processed. Please wait a moment.';
        return 'There is a conflict with your request. This might happen if someone else made a change at the same time.';
      case 422: return 'Some of the information you provided seems incorrect. Please check your details and try again.';
      case 429: return 'We\'re receiving a lot of requests right now. Please take a 5-second breather and try again.';
      case 500: return 'Our servers are having a momentary hiccup. We\'ve been notified and are working on it!';
      case 502:
      case 503:
      case 504: return 'We\'re having trouble reaching our servers. Please check your internet connection or try again shortly.';
      default: 
        if (originalMessage.includes('Failed to fetch')) return 'We can\'t reach the internet right now. Please check your connection.';
        return originalMessage || 'Something unexpected happened on our end. Please try again.';
    }
  };

      // Handle the new standardized error format (supporting message arrays)
      let rawErrorMessage = `Request failed with status ${response.status}`;
      
      if (typeof data === 'object' && data && 'message' in data) {
        if (Array.isArray(data.message)) {
          rawErrorMessage = data.message.join('; ');
        } else {
          rawErrorMessage = String(data.message);
        }
      } else if (typeof data === 'string' && data.trim()) {
        rawErrorMessage = data;
      }

      const errorMessage = normalizeErrorMessage(response.status, rawErrorMessage);

      // Handle 429 Rate Limiting
      if (response.status === 429) {
        throttleCoolDownUntil = Date.now() + THROTTLE_DURATION_MS;
      }

      const error = new Error(errorMessage) as any;
      error.rawMessage = rawErrorMessage;
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
