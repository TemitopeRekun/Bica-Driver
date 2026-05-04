import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { useAuthStore } from '@/stores/authStore';
import { useRideManager } from '@/hooks/useRideManager';
import { useRatingGateStore } from '@/stores/ratingGateStore';
import { telemetry } from '@/services/TelemetryService';

export const useAppResume = () => {
  const isResumingRef = useRef(false);
  // useRideManager might trigger state updates, but we need the sync function
  const { syncCurrentRide } = useRideManager();

  useEffect(() => {
    const listener = App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return;

      // Prevent duplicate concurrent resume logic
      if (isResumingRef.current) return;
      
      const { isAuthenticated, currentUser } = useAuthStore.getState();
      if (!isAuthenticated || !currentUser) return;

      isResumingRef.current = true;
      try {
        telemetry.info('App resumed, restoring session state');

        // 1. Resync active ride context safely
        await syncCurrentRide();

        // 2. Check for pending ratings
        await useRatingGateStore.getState().checkPendingRating();

        // 3. Dispatch a custom window event so other hooks (realtime, payment) can react atomically
        window.dispatchEvent(new Event('bica-app-resumed'));

      } catch (error) {
        console.error('[AppResume] Failed to restore state gracefully:', error);
      } finally {
        // Allow future resumes after a short debounce to prevent rapid firing
        setTimeout(() => {
          isResumingRef.current = false;
        }, 1000);
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [syncCurrentRide]);
};
