import { requireApiUrl } from './Config';
import { PendingRatingTrip, GetPaymentsSummaryParams, PaymentsSummaryResponse } from '@/types';

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

// Listener for 401 errors to trigger global logout (only fires when refresh also fails)
type UnauthorizedListener = (message?: string) => void;
let unauthorizedListener: UnauthorizedListener | null = null;

export const setOnUnauthorizedListener = (listener: UnauthorizedListener) => {
  unauthorizedListener = listener;
};

// Refresh token helpers
export const saveRefreshToken = (token: string): void => {
  localStorage.setItem('bica_refresh_token', token);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('bica_refresh_token');
};

export const clearRefreshToken = (): void => {
  localStorage.removeItem('bica_refresh_token');
};

// In-flight refresh promise — prevents multiple simultaneous refresh calls
let refreshPromise: Promise<string> | null = null;

async function attemptTokenRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const rawRefreshToken = getRefreshToken();
    if (!rawRefreshToken) throw new Error('No refresh token');

    const baseUrl = requireApiUrl();
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rawRefreshToken }),
    });

    if (!response.ok) throw new Error('Refresh failed');

    const data = await response.json();
    saveToken(data.token);
    if (data.refreshToken) saveRefreshToken(data.refreshToken);
    return data.token;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

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

import { useConnectivityStore } from '@/stores/connectivityStore';

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
  const connectivity = useConnectivityStore.getState();

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

  const headers: Record<string, string> = {};
  
  // Skip ngrok warning only if using an ngrok URL (development only)
  if (baseUrl.includes('ngrok-free.dev')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

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
    // Ensure there is exactly one slash between baseUrl and path
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');
    const fullUrl = `${normalizedBaseUrl}/${normalizedPath}`;

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });

    // On any successful response (even 4xx/5xx), we know the server is reachable
    if (!connectivity.isOnline) {
      useConnectivityStore.getState().setOnline(true);
    }

    // Handle 401: try silent refresh once, then fall back to logout
    if (response.status === 401 && requiresAuth && retryCount === 0) {
      try {
        await attemptTokenRefresh();
        // Retry the original request with the new access token
        return request<T>(method, path, body, requiresAuth, options, 1, currentIdempotencyKey);
      } catch {
        clearRefreshToken();
        if (unauthorizedListener) {
          unauthorizedListener('Your session has expired. Please log in again.');
        }
        throw new Error('Unauthorized');
      }
    }
    if (response.status === 401 && requiresAuth) {
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

  // Prettify common backend technical jargon into user-friendly copy
  const prettifyBackendMessage = (raw: string): string | null => {
    if (!raw) return null;
    
    const friendlyMap: Record<string, string> = {
      'Invalid credentials': 'The email or password you entered is incorrect. Please try again.',
      'User not found': 'We couldn\'t find an account with that email address.',
      'An account with this email already exists': 'This email is already registered. Did you mean to log in instead?',
      'Account suspended. Please contact support.': 'Your account has been suspended. Please contact support for assistance.',
      'Your driver account is pending admin approval.': 'Your driver account is still pending admin approval. We will notify you once it\'s ready!',
    };

    // Return mapped friendly message or null to fallback to generic handler
    return friendlyMap[raw] || null;
  };

  // Human-friendly error normalization
  const normalizeErrorMessage = (status: number, originalMessage: string) => {
    // Priority 1: Check if the backend message is one we want to "Prettify" (e.g. Invalid credentials)
    const friendlyMessage = prettifyBackendMessage(originalMessage);
    if (friendlyMessage) return friendlyMessage;

    // Priority 2: Use the original message if it's not technical-sounding (non-empty)
    if (originalMessage && originalMessage.length > 3 && !originalMessage.includes('Request failed')) {
      return originalMessage;
    }

    // Priority 3: Status-based fallbacks
    switch (status) {
      case 401: 
        if (path.includes('/auth/login') || !requiresAuth) {
          return 'Invalid email or password. Please try again.';
        }
        return 'Your session has expired. Please log in again to continue.';
      case 403: return originalMessage || 'You don\'t have permission to perform this action.';
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

    // Intentional aborts (AbortController) are not network failures — never mark offline
    const isAbort = error.name === 'AbortError' || error.message === 'The user aborted a request.';
    const isNetworkFailure = !isAbort && error.message.includes('Failed to fetch');

    if (shouldRetry && isNetworkFailure && retryCount < 3) {
      // Only mark offline after retries start failing — avoids false positive on first transient drop
      if (retryCount > 0) {
        useConnectivityStore.getState().setOnline(false);
      }
      const backoffMs = Math.pow(2, retryCount) * 1000;
      console.warn(`[API] Connection lost during ${method} ${path}. Retrying with same key after ${backoffMs}ms...`);
      await sleep(backoffMs);
      return request<T>(method, path, body, requiresAuth, options, retryCount + 1, currentIdempotencyKey);
    }

    // Persistent network failure after retries exhausted — confirm offline
    if (isNetworkFailure) {
      useConnectivityStore.getState().setOnline(false);
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

  getPaginatedResponse: <T>(path: string, requiresAuth = true, options?: RequestOptions) =>
    request<PaginatedResponse<T>>('GET', path, undefined, requiresAuth, options),

  // Ratings
  getPendingRating: () =>
    request<PendingRatingTrip | null>('GET', '/rides/pending-rating', undefined, true),
  rateTrip: (tripId: string, score: number) =>
    request<{ message: string; driverRating: number; driverRatingCount: number }>('POST', `/rides/${tripId}/rate`, { score }, true),

  // Payments
  getPaymentsSummary: (params: GetPaymentsSummaryParams): Promise<PaymentsSummaryResponse> =>
    request<PaymentsSummaryResponse>('GET', `/payments/summary?period=${params.period}`, undefined, true),

  getPaymentStatus: (tripId: string) =>
    request<{ paymentStatus: import('@/types').PaymentStatus; amount?: number }>('GET', `/payments/status/${tripId}`, undefined, true),

  // Admin — Ledger Operations
  resetWalletBalance: (driverId: string): Promise<{ message: string }> =>
    request<{ message: string }>('POST', `/payments/wallet/reset`, { driverId }, true),

  // Admin — Payment Recovery
  getOrphanedTransactions: (): Promise<import('@/types').OrphanedTransactionsResponse> =>
    request<import('@/types').OrphanedTransactionsResponse>('GET', '/payments/orphaned-transactions', undefined, true),

  recoverTransaction: (transactionReference: string, tripId: string): Promise<import('@/types').RecoveryResult> =>
    request<import('@/types').RecoveryResult>('POST', `/payments/recover/${encodeURIComponent(transactionReference)}`, { tripId }, true),

  finalizeTrip: (tripId: string): Promise<import('@/types').FinalizeResult> =>
    request<import('@/types').FinalizeResult>('POST', `/payments/finalize/${tripId}`, undefined, true),

  getTripById: (tripId: string): Promise<any> =>
    request<any>('GET', `/admin/trips/${tripId}`, undefined, true),

  // Account Management
  deleteAccount: (password: string) =>
    request<{ message: string; success: boolean }>('DELETE', '/users/me', { password }, true),

  // Support
  createSupportTicket: (payload: {
    category: import('@/types').SupportCategory;
    firstMessage: string;
    openedAt: string;
    tripId?: string;
    paymentStatus?: string;
    recentFailureContext?: string;
  }): Promise<{ id: string; createdAt: string }> =>
    request<{ id: string; createdAt: string }>('POST', '/support/tickets', payload, true),

  getSupportTickets: (page = 0, limit = 20): Promise<PaginatedResponse<import('@/types').SupportTicket>> =>
    request<PaginatedResponse<import('@/types').SupportTicket>>('GET', `/support/tickets?page=${page}&limit=${limit}`, undefined, true),
};
