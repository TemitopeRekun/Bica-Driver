import { Config } from './Config';

declare global {
  interface Window {
    __initBicaGoogleMaps?: () => void;
    google?: any;
  }
}

let googleMapsPromise: Promise<any> | null = null;
const GOOGLE_MAPS_LOAD_TIMEOUT_MS = 15000;
const GOOGLE_MAPS_LOAD_ERROR_MESSAGE =
  'Google Maps failed to load. Verify API key/referrer restrictions and disable ad blockers or privacy shields for this site.';

export const loadGoogleMaps = async (): Promise<any> => {
  if (window.google?.maps?.importLibrary) {
    return window.google.maps;
  }

  if (!Config.googleMapsApiKey) {
    throw new Error(
      'Missing VITE_GOOGLE_MAPS_API_KEY. Add it to your frontend env file before using Google Maps.',
    );
  }

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      let isSettled = false;
      let timeoutId: number | null = null;
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-google-maps-loader="true"]',
      );

      const setNoopCallback = () => {
        window.__initBicaGoogleMaps = () => {};
      };

      const clearTimer = () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const resolveIfReady = (): boolean => {
        if (window.google?.maps) {
          isSettled = true;
          clearTimer();
          setNoopCallback();
          resolve(window.google.maps);
          return true;
        }

        return false;
      };

      const rejectWithError = (message: string) => {
        if (isSettled) return;
        isSettled = true;
        clearTimer();
        setNoopCallback();
        googleMapsPromise = null;
        reject(new Error(message));
      };

      const handleReady = () => {
        if (isSettled) return;
        resolveIfReady();
      };

      const handleError = () => {
        rejectWithError(GOOGLE_MAPS_LOAD_ERROR_MESSAGE);
      };

      timeoutId = window.setTimeout(() => {
        rejectWithError(
          'Timed out loading Google Maps. This is often caused by network filters, ad blockers, or strict browser privacy settings.',
        );
      }, GOOGLE_MAPS_LOAD_TIMEOUT_MS);

      if (resolveIfReady()) {
        return;
      }

      // Keep callback function defined for the Google script callback path.
      window.__initBicaGoogleMaps = () => {
        handleReady();
      };

      if (existingScript) {
        existingScript.addEventListener('load', handleReady, { once: true });
        existingScript.addEventListener('error', handleError, { once: true });
        return;
      }

      const script = document.createElement('script');
      const params = new URLSearchParams({
        key: Config.googleMapsApiKey,
        v: 'weekly',
        loading: 'async',
        callback: '__initBicaGoogleMaps',
      });

      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsLoader = 'true';
      script.onerror = handleError;

      document.head.appendChild(script);
    });
  }

  return googleMapsPromise;
};
