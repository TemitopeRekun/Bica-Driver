import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

// For pickup: MUST be a fresh reading — never use a cached position
const PICKUP_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,            // 0 = always read fresh from GPS chip
};

// For ongoing tracking heartbeats: a short cache is fine
const HIGH_ACCURACY_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 5000,         // 5s — acceptable for tracking updates
};

const BALANCED_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 20000,
  maximumAge: 10000,        // 10s — fallback when high-accuracy fails
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
  async getCurrentLocation(forPickup = false): Promise<any> {
    const shouldRetryForAccuracy = (position: any) =>
      Boolean(
        position?.coords &&
        typeof position.coords.accuracy === 'number' &&
        // For pickups, accept only very good accuracy; for tracking, 100m is fine
        position.coords.accuracy > (forPickup ? 50 : DESIRED_ACCURACY_METERS),
      );

    const getWebLocation = (options: PositionOptions) =>
      new Promise<{ position: any | null; error: unknown | null }>((resolve) => {
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
              resolve({ position: null, error });
            },
            options,
          );
        } else {
          resolve({ position: null, error: new Error('Browser geolocation is unavailable.') });
        }
      });

    const tryWebLocation = async () => {
      let lastError: unknown = null;
      // For pickup: start with maximumAge: 0 to guarantee a fresh GPS fix
      const attemptOptions = forPickup
        ? [PICKUP_GEOLOCATION_OPTIONS, HIGH_ACCURACY_GEOLOCATION_OPTIONS, BALANCED_GEOLOCATION_OPTIONS]
        : [HIGH_ACCURACY_GEOLOCATION_OPTIONS, BALANCED_GEOLOCATION_OPTIONS];

      for (const options of attemptOptions) {
        const { position, error } = await getWebLocation(options);
        if (position) {
          if (shouldRetryForAccuracy(position)) {
            // One retry with the next fallback option
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

    const tryCapacitorLocation = async () => {
      let lastError: unknown = null;
      // For pickup: start with maximumAge: 0 to guarantee a fresh GPS fix
      const attemptOptions = forPickup
        ? [PICKUP_GEOLOCATION_OPTIONS, HIGH_ACCURACY_GEOLOCATION_OPTIONS, BALANCED_GEOLOCATION_OPTIONS]
        : [HIGH_ACCURACY_GEOLOCATION_OPTIONS, BALANCED_GEOLOCATION_OPTIONS];

      // Request permissions explicitly so the OS dialog appears on native
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location === 'denied') {
          return { position: null, error: new Error('Location permission denied.') };
        }
      } catch {
        // requestPermissions may not be supported on all platforms — continue
      }

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

    // On plain web (not native Capacitor), skip the Capacitor plugin entirely
    // so the browser's native permission prompt appears immediately
    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      const webResult = await tryWebLocation();
      if (webResult.position) return webResult.position;
      if (isPermissionDeniedError(webResult.error)) {
        throw new Error('Location permission denied.');
      }
      if (webResult.error) logGeolocationIssue('web', webResult.error);
      return null;
    }

    // Native path: Capacitor first, web API as fallback
    const capacitorResult = await tryCapacitorLocation();
    if (capacitorResult.position) {
      return capacitorResult.position;
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
    // 🛡️ If on Web, skip Capacitor UI which often fails without PWA elements
    if (!Capacitor.isNativePlatform()) {
      return this.useWebCameraFallback(direction);
    }

    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: source,
        direction: direction
      });
      return `data:image/jpeg;base64,${image.base64String}`;
    } catch (e) {
      console.warn('Capacitor Camera failed. Falling back...', e);
      return this.useWebCameraFallback(direction);
    }
  },

  async useWebCameraFallback(direction: CameraDirection): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      // 🛡️ This attribute is key: it tells mobile browsers to open the CAMERA directly
      if (direction === CameraDirection.Front) {
        input.setAttribute('capture', 'user');
      } else {
        input.setAttribute('capture', 'environment');
      }
      
      const cleanup = () => {
        if (input.parentNode) {
          document.body.removeChild(input);
        }
      };

      input.onchange = (event: any) => {
        const file = event.target.files[0];
        if (!file) {
          cleanup();
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = (e: any) => {
          cleanup();
          resolve(e.target.result as string);
        };
        reader.onerror = () => {
          cleanup();
          resolve(null);
        };
        reader.readAsDataURL(file);
      };

      // Ensure the input is not garbage collected before the dialog opens
      input.style.display = 'none';
      document.body.appendChild(input);
      input.click();
      // Wait for the change event instead of removing immediately
    });
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
  },

  async initBackButton(onBack?: () => void) {
    if (Capacitor.getPlatform() === 'web') return;
    
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          // If at the root of the app, we can exit or show a toast
          App.exitApp();
        } else if (onBack) {
          onBack();
        } else {
          window.history.back();
        }
      });
    } catch (e) {}
  }
};
