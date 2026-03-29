import { Config } from './Config';

declare global {
  interface Window {
    __initBicaGoogleMaps?: () => void;
    google?: any;
  }
}

let googleMapsPromise: Promise<any> | null = null;

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
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-google-maps-loader="true"]',
      );

      const handleReady = () => {
        if (window.google?.maps) {
          resolve(window.google.maps);
          return;
        }

        googleMapsPromise = null;
        reject(new Error('Google Maps loaded, but the API is unavailable.'));
      };

      const handleError = () => {
        googleMapsPromise = null;
        reject(new Error('Google Maps failed to load. Check your API key and allowed referrers.'));
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

      window.__initBicaGoogleMaps = () => {
        window.__initBicaGoogleMaps = undefined;
        handleReady();
      };

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
