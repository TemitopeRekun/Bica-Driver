import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import localforage from 'localforage';

// Stores & Config
import { router } from './routes/AppRouter';
import { useAuthStore } from './stores/authStore';
import { useSettingsStore } from './stores/settingsStore';
import { useUIStore } from './stores/uiStore';
import { setOnUnauthorizedListener, api } from '@/services/api.service';
import { mapUser } from '@/mappers/appMappers';
import { CapacitorService } from '@/services/CapacitorService';
import { UserRole } from '@/types';
import { useRatingGateStore } from './stores/ratingGateStore';
import { useAppResume } from '@/hooks/useAppResume';

// Components
import SupportChatbot from '@/components/SupportChatbot';
import { ToastProvider as ToastContainer } from '@/components/Toast/ToastProvider';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import VersionEnforcer from '@/components/Common/VersionEnforcer';
import { telemetry } from '@/services/TelemetryService';
import { useConnectivityStore } from './stores/connectivityStore';
import ConnectivityBanner from '@/components/Common/ConnectivityBanner';

const App: React.FC = () => {
  const { currentUser, setCurrentUser, logout, isAuthenticated, setInitializing, isInitializing } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const { addToast } = useUIStore();
  const { initStatusBar } = CapacitorService;

  // Initialize global app resume orchestrator
  useAppResume();

  useEffect(() => {
    initStatusBar();
    CapacitorService.initBackButton();
    
    const handleRejection = (event: PromiseRejectionEvent) => {
      telemetry.error('Unhandled Promise Rejection', event.reason);
    };

    window.addEventListener('unhandledrejection', handleRejection);

    const handleOnline = () => useConnectivityStore.getState().setOnline(true);
    const handleOffline = () => useConnectivityStore.getState().setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initialize notifications if already authenticated
    if (isAuthenticated) {
      import('@/services/NotificationService').then(({ notificationService }) => {
        notificationService.init();
        notificationService.syncTokenWithBackend();
      });
    }
    
    // Centralized 401 listener
    setOnUnauthorizedListener((message) => {
      addToast(message || 'Session expired', 'error');
      logout();
    });

    const initializeApp = async () => {
      try {
        // 1. Load system settings (includes version info)
        await loadSettings();

        // 2. Check for saved session
        const savedUser = await localforage.getItem<any>('bicadriver_current_user');
        if (savedUser && savedUser.id !== 'admin_preview') {
          try {
            const freshUser = await api.get<any>('/auth/me');
            const mapped = mapUser(freshUser);

            // Guard: clear any ride state that belonged to a different user (crash/refresh scenario)
            const { useRideStore } = await import('@/stores/rideStore');
            const { lastUserId, resetRide } = useRideStore.getState();
            if (lastUserId && lastUserId !== mapped.id) {
              console.warn(`[Auth] Stale ride data detected for user ${lastUserId}, clearing before restoring ${mapped.id}`);
              resetRide();
            }

            setCurrentUser(mapped);
            await localforage.setItem('bicadriver_current_user', mapped);
            telemetry.info('Session restored successfully', { userId: mapped.id });

            // Enforce post-trip payment/rating routing guards
            try {
               const activeRide = await api.get<any>('/rides/current');
               if (activeRide && activeRide.postTripAction) {
                  const { postTripAction, id } = activeRide;
                  const currentPath = window.location.pathname;
                  
                  if (postTripAction === 'AWAITING_PAYMENT' && mapped.role === UserRole.DRIVER && !currentPath.includes('/driver/awaiting-payment/')) {
                     window.location.replace(`/driver/awaiting-payment/${id}`);
                  } else if (postTripAction === 'REQUIRE_PAYMENT' && mapped.role === UserRole.OWNER) {
                     const { setRideState, setCompletedTripData, setCurrentTripId } = await import('@/stores/rideStore').then(m => m.useRideStore.getState());
                     setCompletedTripData(activeRide);
                     setCurrentTripId(activeRide.id);
                     setRideState('COMPLETED');
                     if (currentPath !== '/owner/status') window.location.replace('/owner/status');
                  }
               }
            } catch (e) {
               console.error('Failed to fetch active ride on boot', e);
            }

            // Check for pending ratings if OWNER
            if (mapped.role === UserRole.OWNER) {
              await useRatingGateStore.getState().checkPendingRating();
            }
          } catch (e) {
            console.warn('Session restoration failed:', e);
            await logout();
          }
        }
      } catch (e) {
        telemetry.error('Core init failed', e);
      } finally {
        setInitializing(false);
      }
    };

    initializeApp();

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ToastContainer>
        <div className="flex justify-center items-start min-h-screen bg-slate-950">
          <div className="w-full max-w-md min-h-screen bg-background-light dark:bg-background-dark shadow-2xl overflow-x-hidden relative flex flex-col">
            
            {/* Connectivity banner sits at the very top of the app frame, pushing content down */}
            <ConnectivityBanner />

            <VersionEnforcer>
              {/* The Main Router */}
              <RouterProvider router={router} />
            </VersionEnforcer>

            {/* Global Overlays */}
            {currentUser && <SupportChatbot user={currentUser} />}
            
          </div>
        </div>
      </ToastContainer>
    </ErrorBoundary>
  );
};

export default App;
