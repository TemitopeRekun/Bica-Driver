
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

<<<<<<< HEAD
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

const DESIRED_ACCURACY_METERS = 100;

export const CapacitorService = {
  async getCurrentLocation(): Promise<any> {
    const getWebLocation = () =>
      new Promise<any>((resolve) => {
=======
const HIGH_ACCURACY_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 15000,
};

const BALANCED_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 20000,
  maximumAge: 120000,
};

const DESIRED_ACCURACY_METERS = 100;
const GEOLOCATION_LOG_THROTTLE_MS = 60000;

const geolocationLogTimestamps: Record<string, number> = {};

const isPermissionDeniedError = (error: unknown): boolean => {
  const typedError = error as { code?: number | string; message?: string; cause?: { code?: number | string } };
  const code = typedError?.code ?? typedError?.cause?.code;

  if (code === 1 || code === 'PERMISSION_DENIED') {
    return true;
  }

  const message = String(typedError?.message ?? error ?? '').toLowerCase();
  return message.includes('permission') && message.includes('denied');
};

const isTimeoutError = (error: unknown): boolean => {
  const typedError = error as { code?: number | string; message?: string; cause?: { code?: number | string } };
  const code = typedError?.code ?? typedError?.cause?.code;

  if (code === 3 || code === 'TIMEOUT') {
    return true;
  }

  const message = String(typedError?.message ?? error ?? '').toLowerCase();
  return message.includes('timeout');
};

const logGeolocationIssue = (context: string, error: unknown) => {
  const category = isPermissionDeniedError(error)
    ? 'permission-denied'
    : isTimeoutError(error)
      ? 'timeout'
      : 'other';
  const key = `${context}:${category}`;
  const now = Date.now();
  const lastLoggedAt = geolocationLogTimestamps[key] ?? 0;

  if (now - lastLoggedAt < GEOLOCATION_LOG_THROTTLE_MS) {
    return;
  }

  geolocationLogTimestamps[key] = now;
  console.warn(`[Geolocation] ${context} failed (${category}).`, error);
};

export const CapacitorService = {
  async getCurrentLocation(): Promise<any> {
    const shouldRetryForAccuracy = (position: any) =>
      Boolean(
        position?.coords &&
        typeof position.coords.accuracy === 'number' &&
        position.coords.accuracy > DESIRED_ACCURACY_METERS,
      );

    const getWebLocation = (options: PositionOptions) =>
      new Promise<{ position: any | null; error: unknown | null }>((resolve) => {
>>>>>>> main
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                position: {
                  coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed
                  },
                  timestamp: position.timestamp
                },
                error: null,
              });
            },
            (error) => {
<<<<<<< HEAD
              console.error("Web Geolocation error:", error);
              resolve(null);
            },
            GEOLOCATION_OPTIONS,
=======
              resolve({ position: null, error });
            },
            options,
>>>>>>> main
          );
        } else {
          resolve({ position: null, error: new Error('Browser geolocation is unavailable.') });
        }
      });

<<<<<<< HEAD
    const shouldRetryForAccuracy = (position: any) =>
      Boolean(
        position?.coords &&
        typeof position.coords.accuracy === 'number' &&
        position.coords.accuracy > DESIRED_ACCURACY_METERS,
      );

    try {
      let coordinates = await Geolocation.getCurrentPosition(GEOLOCATION_OPTIONS);

      // Retry once when the device reports a stale or low-accuracy GPS fix.
      if (shouldRetryForAccuracy(coordinates)) {
        coordinates = await Geolocation.getCurrentPosition(GEOLOCATION_OPTIONS);
      }

      return coordinates;
    } catch (e) {
      console.warn('Capacitor Geolocation failed, trying web fallback...', e);
      let webCoordinates = await getWebLocation();

      if (shouldRetryForAccuracy(webCoordinates)) {
        webCoordinates = await getWebLocation();
      }

      return webCoordinates;
=======
    const tryCapacitorLocation = async () => {
      let lastError: unknown = null;

      const attemptOptions = [HIGH_ACCURACY_GEOLOCATION_OPTIONS, BALANCED_GEOLOCATION_OPTIONS];

      for (const options of attemptOptions) {
        try {
          let coordinates = await Geolocation.getCurrentPosition(options);

          if (shouldRetryForAccuracy(coordinates)) {
            try {
              coordinates = await Geolocation.getCurrentPosition(options);
            } catch {
              // Keep the first position fix if refinement fails.
            }
          }

          return { position: coordinates, error: null };
        } catch (error) {
          lastError = error;
          if (isPermissionDeniedError(error)) {
            return { position: null, error };
          }
        }
      }

      return { position: null, error: lastError };
    };

    const tryWebLocation = async () => {
      let lastError: unknown = null;
      const attemptOptions = [HIGH_ACCURACY_GEOLOCATION_OPTIONS, BALANCED_GEOLOCATION_OPTIONS];

      for (const options of attemptOptions) {
        const { position, error } = await getWebLocation(options);
        if (position) {
          if (shouldRetryForAccuracy(position)) {
            const retryResult = await getWebLocation(BALANCED_GEOLOCATION_OPTIONS);
            return {
              position: retryResult.position || position,
              error: retryResult.error,
            };
          }

          return { position, error: null };
        }

        lastError = error;
        if (isPermissionDeniedError(error)) {
          return { position: null, error };
        }
      }

      return { position: null, error: lastError };
    };

    const capacitorResult = await tryCapacitorLocation();
    if (capacitorResult.position) {
      return capacitorResult.position;
>>>>>>> main
    }

    if (isPermissionDeniedError(capacitorResult.error)) {
      throw new Error('Location permission denied.');
    }

    const webResult = await tryWebLocation();
    if (webResult.position) {
      return webResult.position;
    }

    if (isPermissionDeniedError(webResult.error)) {
      throw new Error('Location permission denied.');
    }

    const finalError = webResult.error ?? capacitorResult.error;
    if (finalError) {
      logGeolocationIssue('all providers', finalError);
    }

    return null;
  },

  async takePhoto(source: CameraSource = CameraSource.Prompt, direction: CameraDirection = CameraDirection.Rear): Promise<string | null> {
    try {
      const image = await Camera.getPhoto({
        // Keep base64 payloads reasonably small for backend upload limits.
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: source,
        direction: direction
      });
      return `data:image/jpeg;base64,${image.base64String}`;
    } catch (e) {
      console.warn('Capacitor Camera failed or cancelled. Using web fallback...', e);
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (source === CameraSource.Camera) {
          (input as any).capture = direction === CameraDirection.Front ? 'user' : 'environment';
        }
        
        input.onchange = (event: any) => {
          const file = event.target.files[0];
          if (!file) {
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onload = (e: any) => {
            resolve(e.target.result as string);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        };
        input.click();
      });
    }
  },

  async triggerHaptic() {
    // Disabled as per user request to remove sound/feedback on clicks
  },

  async initStatusBar() {
    try {
      if (StatusBar && typeof StatusBar.setStyle === 'function') {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#032e02' });
      }
    } catch (e) {}
  }
};
