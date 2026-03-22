const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

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
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    // Throw the backend error message so UI can display it
    throw new Error(data.message || 'Something went wrong');
  }

  return data as T;
}

// Convenience methods
export const api = {
  get: <T>(path: string, requiresAuth = true) =>
    request<T>('GET', path, undefined, requiresAuth),

  post: <T>(path: string, body?: any, requiresAuth = true) =>
    request<T>('POST', path, body, requiresAuth),

  patch: <T>(path: string, body?: any, requiresAuth = true) =>
    request<T>('PATCH', path, body, requiresAuth),

  delete: <T>(path: string, requiresAuth = true) =>
    request<T>('DELETE', path, undefined, requiresAuth),
};