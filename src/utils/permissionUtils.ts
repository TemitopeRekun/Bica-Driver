import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

/**
 * Check the current location permission status
 */
export const checkLocationPermission = async (): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> => {
  try {
    if (!Capacitor.isNativePlatform()) {
      // On web, check via navigator.permissions
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          return result.state as 'granted' | 'denied' | 'prompt';
        } catch {
          return 'unknown';
        }
      }
      return 'unknown';
    }

    const permissions = await Geolocation.checkPermissions();
    return permissions.location as any;
  } catch (error) {
    console.warn('[Permission] Failed to check location permission:', error);
    return 'unknown';
  }
};

/**
 * Request location permission from the user
 * Returns true if granted, false otherwise
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  try {
    if (!Capacitor.isNativePlatform()) {
      // On web, trigger the browser's geolocation permission dialog
      return new Promise((resolve) => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            () => {
              console.log('[Permission] Web geolocation permission granted');
              resolve(true);
            },
            (error) => {
              console.log('[Permission] Web geolocation permission denied:', error);
              resolve(false);
            },
            { timeout: 5000 },
          );
        } else {
          resolve(false);
        }
      });
    }

    // On native, request via Capacitor
    console.log('[Permission] Requesting native location permission...');
    const result = await Geolocation.requestPermissions();
    const granted = result.location === 'granted';
    console.log('[Permission] Native location permission result:', granted ? 'granted' : 'denied');
    return granted;
  } catch (error) {
    console.error('[Permission] Failed to request location permission:', error);
    return false;
  }
};

/**
 * Ensure location permission is granted, requesting if necessary
 */
export const ensureLocationPermission = async (): Promise<boolean> => {
  const currentStatus = await checkLocationPermission();

  if (currentStatus === 'granted') {
    return true;
  }

  if (currentStatus === 'denied') {
    console.warn('[Permission] Location permission permanently denied by user');
    return false;
  }

  // 'prompt' or 'unknown' — request permission
  return await requestLocationPermission();
};
