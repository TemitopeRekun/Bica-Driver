
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

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
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
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
              });
            },
            (error) => {
              console.error("Web Geolocation error:", error);
              resolve(null);
            },
            GEOLOCATION_OPTIONS,
          );
        } else {
          resolve(null);
        }
      });

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
    }
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
