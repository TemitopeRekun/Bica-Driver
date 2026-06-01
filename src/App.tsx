import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import localforage from 'localforage';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

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
import { useRideStore } from './stores/rideStore';
import { useAppResume } from '@/hooks/useAppResume';

// Components
import SupportChatbot from '@/components/SupportChatbot';
import { ToastProvider as ToastContainer } from '@/components/Toast/ToastProvider';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import VersionEnforcer from '@/components/Common/VersionEnforcer';
import { telemetry } from '@/services/TelemetryService';
import { useConnectivityStore } from './stores/connectivityStore';
import ConnectivityBanner from '@/components/Common/ConnectivityBanner';

// Request location permissions early on app start (native platforms only)
const initializeLocationPermissions = async () => {
  try {
    if (!Capacitor.isNativePlatform()) {
      return; // Skip on web
    }

    const permissions = await Geolocation.checkPermissions();
    console.log('[Permissions] Initial location permission status:', permissions.location);

    // If permission is not yet granted, request it
    if (permissions.location === 'prompt' || permissions.location === 'denied') {
      console.log('[Permissions] Requesting location permission...');
      const result = await Geolocation.requestPermissions();
      console.log('[Permissions] Location permission result:', result.location);
    }
  } catch (error) {
    console.warn('[Permissions] Failed to initialize location permissions:', error);
    // Don't throw — let the app continue even if permission request fails
  }
};

const App: React.FC = () => {
  const { currentUser, setCurrentUser, logout, isAuthenticated, setInitializing } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const { addToast } = useUIStore();
  const { initStatusBar } = CapacitorService;

  // Initialize global app resume orchestrator
  useAppResume();

  useEffect(() => {
    initStatusBar();
    CapacitorService.initBackButton();
    initializeLocationPermissions(); // Request location permission early
    
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
    
    // Centralized 401 listener — suppressed during active trips to prevent
    // the car owner from being ejected when a driver accepts/starts a ride
    // (socket reconnects can briefly trigger spurious 401s).
    setOnUnauthorizedListener((message) => {
      const rideState = useRideStore.getState().rideState;
      if (rideState === 'ASSIGNED' || rideState === 'IN_PROGRESS') {
        return;
      }
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

            // 🛡️ SESSION RECOVERY GATE: Restore active trips and enforce routing
            try {
               const activeRide = await api.get<any>('/rides/current');
               if (activeRide) {
                  const { status, id, postTripAction } = activeRide;
                  const currentHash = window.location.hash;
                  const { setRideState, setCurrentTripId } = await import('@/stores/rideStore').then(m => m.useRideStore.getState());

                  // Handle ACTIVE trip states (recovery gate)
                  const activeTripsOwner = ['PENDING_ACCEPTANCE', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'SCHEDULED'];
                  const activeTripsDriver = ['ASSIGNED', 'ARRIVED', 'IN_PROGRESS'];

                  const isOwnerActiveTrip = mapped.role === UserRole.OWNER && activeTripsOwner.includes(status);
                  const isDriverActiveTrip = mapped.role === UserRole.DRIVER && activeTripsDriver.includes(status);

                  if (isOwnerActiveTrip) {
                     console.log(`🔄 [BOOT_RECOVERY] Owner has active trip ${id} [${status}] — restoring to status screen`);
                     setCurrentTripId(id);
                     setRideState(status as any);
                     const isSafePage = currentHash.includes('/owner/status');
                     if (!isSafePage && !currentHash.includes('/payment/complete')) {
                        window.location.hash = '/owner/status';
                     }
                  } else if (isDriverActiveTrip) {
                     console.log(`🔄 [BOOT_RECOVERY] Driver has active trip ${id} [${status}] — restoring to main screen`);
                     setCurrentTripId(id);
                     setRideState(status as any);
                     const isSafePage = currentHash.includes('/driver');
                     if (!isSafePage) {
                        window.location.hash = '/driver';
                     }
                  }
                  // Handle POST-TRIP actions (payment/rating)
                  else if (postTripAction) {
                     if (postTripAction === 'AWAITING_PAYMENT' && mapped.role === UserRole.DRIVER && !currentHash.includes('/driver/awaiting-payment/')) {
                        window.location.hash = `/driver/awaiting-payment/${id}`;
                     } else if (postTripAction === 'REQUIRE_PAYMENT' && mapped.role === UserRole.OWNER) {
                        const { setCompletedTripData } = await import('@/stores/rideStore').then(m => m.useRideStore.getState());
                        setCompletedTripData(activeRide);
                        setCurrentTripId(id);
                        setRideState('COMPLETED');
                        const isSafePage = currentHash.includes('/owner/status') || currentHash.includes('/payment/complete');
                        if (!isSafePage) {
                           window.location.hash = '/owner/status';
                        }
                     } else if (postTripAction === 'REQUIRE_RATING' && mapped.role === UserRole.OWNER) {
                        window.location.hash = `/rate-driver/${id}`;
                     }
                  }
               }
            } catch (e) {
               console.error('Failed to fetch active ride on boot', e);
            }

            // Check for pending ratings if OWNER
            if (mapped.role === UserRole.OWNER) {
              await useRatingGateStore.getState().checkPendingRating();
            }
          } catch (e: any) {
            console.warn('Session restoration failed:', e);
            
            // If it's an explicit 401, the token is dead — must logout.
            // For other errors (500, network drop, timeout), we stay logged in with the cached data.
            if (e.status === 401) {
              await logout();
            } else {
              const mapped = mapUser(savedUser);
              setCurrentUser(mapped);
              telemetry.warn('Restored session from cache due to network verification failure', { error: e.message });
            }
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

  const { isOnline, isReconnecting, socketEverConnected, locationStatus } = useConnectivityStore();
  const [showBannerPadding, setShowBannerPadding] = React.useState(false);

  useEffect(() => {
    const showOffline = !isOnline;
    const showLocationIssue = isOnline && locationStatus !== 'available' && locationStatus !== 'unavailable';
    const isSocketStale = isOnline && socketEverConnected && isReconnecting;

    let timer: ReturnType<typeof setTimeout> | undefined;

    // Padding debounce matches ConnectivityBanner's BANNER_DEBOUNCE_MS to prevent layout jumps before banner appears
    if (showOffline || isSocketStale) {
      timer = setTimeout(() => setShowBannerPadding(true), 2500);
    } else if (showLocationIssue) {
      setShowBannerPadding(true);
    } else {
      setShowBannerPadding(false);
    }

    return () => { if (timer) clearTimeout(timer); };
  }, [isOnline, isReconnecting, socketEverConnected, locationStatus]);

  return (
    <ErrorBoundary>
      <ToastContainer>
        <div className="flex justify-center items-start min-h-screen bg-slate-950">
          <div className={`w-full max-w-md min-h-screen bg-background-light dark:bg-background-dark shadow-2xl overflow-x-hidden relative flex flex-col transition-[padding] duration-500 ${showBannerPadding ? 'pt-11' : 'pt-0'}`}>
            
            {/* Connectivity banner sits at the very top of the app frame */}
            <ConnectivityBanner />

            <VersionEnforcer>
              {/* The Main Router */}
              <RouterProvider router={router} />
            </VersionEnforcer>

            {/* Global Overlays */}
            {(() => {
              const currentHash = (window.location.hash.split('?')[0] ?? '').replace('#', '') || '/';
              const isPublicRoute = ['/', '/login', '/register', '/role-selection', '/verify-email', '/forgot-password', '/reset-password'].includes(currentHash);
              
              if (isAuthenticated && currentUser && !isPublicRoute) {
                return <SupportChatbot user={currentUser} />;
              }
              return null;
            })()}
            
          </div>
        </div>
      </ToastContainer>
    </ErrorBoundary>
  );
};

export default App;
