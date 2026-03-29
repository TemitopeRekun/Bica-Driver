
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

export const CapacitorService = {
  async getCurrentLocation(): Promise<any> {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      return coordinates;
    } catch (e) {
      console.warn('Capacitor Geolocation failed, trying web fallback...', e);
      return new Promise<any>((resolve) => {
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
            }
          );
        } else {
          resolve(null);
        }
      });
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
