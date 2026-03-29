export const Config = {
  apiUrl: (function () {
    const explicitApiUrl = sanitizeApiUrl(import.meta.env.VITE_API_URL);
    if (explicitApiUrl) {
      return explicitApiUrl;
    }

    return import.meta.env.DEV ? 'http://localhost:3001' : '';
  })(),
  apiKey: sanitizeEnvValue(import.meta.env.VITE_GEMINI_API_KEY),
  mapboxToken: sanitizeEnvValue(import.meta.env.VITE_MAPBOX_TOKEN),
  isProduction: import.meta.env.PROD,
  isSandbox: import.meta.env.DEV,
  platform: (window as any).Capacitor?.getPlatform?.() || 'web',
};

function sanitizeEnvValue(value?: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim().replace(/['"]+/g, '');
  if (!trimmed || trimmed === 'undefined' || trimmed.includes('process.env')) {
    return '';
  }

  return trimmed;
}

function sanitizeApiUrl(value?: string): string {
  return sanitizeEnvValue(value).replace(/\/+$/, '');
}

export const requireApiUrl = (): string => {
  if (Config.apiUrl) {
    return Config.apiUrl;
  }

  throw new Error(
    'Missing VITE_API_URL. Set it to your public backend URL before deploying this app.',
  );
};
