import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { CapacitorService } from '@/services/CapacitorService';
import { api } from '@/services/api.service';
import { Config } from '@/services/Config';
import { IMAGES } from '@/constants';
import { UserProfile } from '@/types';
import { sounds } from '@/services/SoundService';
import { Geolocation } from '@capacitor/geolocation';
import { useAuthStore } from '@/stores/authStore';
import { useConnectivityStore } from '@/stores/connectivityStore';
import { LocationPersistenceQueue } from '@/utils/locationPersistenceQueue';
import { getSocketMetricsCollector } from '@/utils/socketMetrics';
import { getRideRequestPrice } from '@/utils/currencyFormatter';

const API_URL = Config.apiUrl;

export interface DriverRideRequest {
  id: string;
  ownerName: string;
  pickup: string;
  destination: string;
  distance: string;
  price: string;
  timeToPickup: string;
  tripDuration: string;
  avatar: string;
  coords: [number, number];
  destCoords: [number, number];
  acceptanceImageUrl?: string;
  status: string;
  pickupAddress: string;
  destAddress: string;
  ownerPhone?: string;
  driverEarnings?: number;
}

interface UseDriverRealtimeOptions {
  user: UserProfile | null;
  approvalStatus: string;
  onOnlineStatusChange?: (isOnline: boolean) => void;
  onForcedLogout?: (message?: string) => void;
  onRideProgress?: (payload: { tripId: string; milestone: string }) => void;
  onRideCancelled?: (payload: { tripId: string; message?: string }) => void;
  onPaymentUpdated?: (payload: { tripId: string; paymentStatus: string; paidAt?: string; amount?: number; driverEarnings?: number; message?: string }) => void;
}

const DEFAULT_DRIVER_POS: [number, number] = [6.4549, 3.3896];
const DRIVER_ONLINE_GPS_TIMEOUT_MS = 25000;
const DRIVER_LOCATION_RETRY_MESSAGE =
  'We could not get your live location yet. Please make sure Location is enabled, wait a moment, and try going online again.';

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};

export const mapTripToDriverRideRequest = (trip: any): DriverRideRequest => {
  const pickupAddress = firstText(trip.pickupAddress, trip.pickup, 'Pickup unavailable');
  const destinationAddress = firstText(trip.destAddress, trip.destinationAddress, trip.destination, 'Destination unavailable');
  const distance =
    typeof trip.distanceKm === 'number'
      ? `${trip.distanceKm.toFixed(1)} km`
      : firstText(trip.distance, 'Distance pending');
  const estimatedArrivalMins = toFiniteNumber(trip.estimatedArrivalMins, 5);
  const estimatedTripMins = toFiniteNumber(trip.estimatedMins ?? trip.fareBreakdown?.totalMins, 10);

  return {
    id: String(trip.id),
    ownerName: firstText(trip.owner?.name, trip.ownerName, 'Car Owner'),
    pickup: pickupAddress,
    destination: destinationAddress,
    distance,
    price: getRideRequestPrice(trip.driverEarnings, trip.amount),
    timeToPickup: `${estimatedArrivalMins}m to pickup`,
    tripDuration: `${estimatedTripMins}m trip`,
    avatar: firstText(trip.owner?.avatarUrl, trip.ownerAvatar, IMAGES.USER_AVATAR),
    coords: [
      toFiniteNumber(trip.pickupLat ?? trip.pickupLatitude, DEFAULT_DRIVER_POS[0]),
      toFiniteNumber(trip.pickupLng ?? trip.pickupLongitude, DEFAULT_DRIVER_POS[1]),
    ],
    destCoords: [
      toFiniteNumber(trip.destLat ?? trip.destinationLat, DEFAULT_DRIVER_POS[0]),
      toFiniteNumber(trip.destLng ?? trip.destinationLng, DEFAULT_DRIVER_POS[1]),
    ],
    acceptanceImageUrl: trip.acceptanceImageUrl,
    status: firstText(trip.status, 'PENDING_ACCEPTANCE'),
    pickupAddress,
    destAddress: destinationAddress,
    ownerPhone: firstText(trip.owner?.phone, trip.ownerPhone),
    driverEarnings: trip.driverEarnings,
  };
};

const isPermissionDeniedError = (error: unknown): boolean => {
  const typedError = error as { code?: number | string; message?: string; cause?: { code?: number | string } };
  const code = typedError?.code ?? typedError?.cause?.code;
  if (code === 1 || code === 'PERMISSION_DENIED') return true;

  const message = String(typedError?.message ?? error ?? '').toLowerCase();
  return (
    (message.includes('permission') && message.includes('denied')) ||
    message.includes('location permission') ||
    message.includes('not allowed')
  );
};

const hasValidCoords = (pos: any): pos is { coords: { latitude: number; longitude: number } } =>
  Number.isFinite(pos?.coords?.latitude) && Number.isFinite(pos?.coords?.longitude);

// 🛡️ GPS Timeout Wrapper — Prevents indefinite hang on location permission.
// Native release builds regularly need more than a few seconds for the first GPS fix.
const getLocationWithTimeout = async (timeoutMs = DRIVER_ONLINE_GPS_TIMEOUT_MS, forPickup = false) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`GPS location request timed out after ${Math.round(timeoutMs / 1000)} seconds`)), timeoutMs)
  );
  return Promise.race([
    CapacitorService.getCurrentLocation(forPickup),
    timeoutPromise
  ]);
};

export const useDriverRealtime = ({
  user,
  approvalStatus,
  onOnlineStatusChange,
  onForcedLogout,
  onRideProgress,
  onRideCancelled,
  onPaymentUpdated,
}: UseDriverRealtimeOptions) => {
  const [isOnline, setIsOnline] = useState(Boolean(user?.isOnline));
  const [isLocationRefreshing, setIsLocationRefreshing] = useState(false);
  const [availabilityIssue, setAvailabilityIssue] = useState<string | null>(null);
  const [driverPos, setDriverPos] = useState<[number, number]>(() =>
    user?.currentLocation ? [user.currentLocation.lat, user.currentLocation.lng] : DEFAULT_DRIVER_POS,
  );
  const [liveRideRequests, setLiveRideRequests] = useState<DriverRideRequest[]>([]);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const socketRef = useRef<Socket | null>(null);
  const trackingInterval = useRef<any>(null);
  const isInitializing = useRef(false);
  const locationQueueRef = useRef<LocationPersistenceQueue | null>(null);
  
  const updateOnlineState = useCallback(
    (nextIsOnline: boolean) => {
      setIsOnline(nextIsOnline);
      onOnlineStatusChange?.(nextIsOnline);
    },
    [onOnlineStatusChange],
  );

  const markOnlineConfirmed = useCallback(
    (updatedUser: any, latitude: number, longitude: number) => {
      setDriverPos([latitude, longitude]);
      updateProfile({
        isOnline: Boolean(updatedUser?.isOnline),
        currentLocation: { lat: latitude, lng: longitude },
        locationLat: updatedUser?.locationLat ?? latitude,
        locationLng: updatedUser?.locationLng ?? longitude,
      });
      useConnectivityStore.getState().setLocationStatus('available');
      updateOnlineState(true);
    },
    [updateOnlineState, updateProfile],
  );

  const markOfflineConfirmed = useCallback(() => {
    updateProfile({
      isOnline: false,
      currentLocation: undefined,
      locationLat: undefined,
      locationLng: undefined,
    });
    updateOnlineState(false);
  }, [updateOnlineState, updateProfile]);

  const registerDriverSocket = useCallback(() => {
    if (!socketRef.current?.connected || !user?.id) return;
    socketRef.current.emit('driver:register', { driverId: user.id });
  }, [user?.id]);

  const pushDriverLocation = useCallback(async (latitude: number, longitude: number) => {
    if (!user?.id) return;

    // A: Local UI update (immediate for responsive UX)
    setDriverPos([latitude, longitude]);

    // B: 🏢 Enqueue persistence with automatic retry logic
    // This ensures transient network failures don't cause stale location
    if (!locationQueueRef.current) {
      locationQueueRef.current = new LocationPersistenceQueue(
        async (lat, lng) => {
          await api.patch('/users/location', { lat, lng });
        },
        undefined, // Use default config
        (update) => {
          console.log('[LocationQueue] Successfully persisted location:', { lat: update.latitude, lng: update.longitude });
        },
        (update, error) => {
          console.error('[LocationQueue] Failed to persist after retries:', error);
          // Optionally report to observability/analytics
        }
      );
    }

    const updateId = locationQueueRef.current.enqueue(latitude, longitude);

    // C: Attempt immediate socket broadcast (fire-and-forget, non-blocking)
    if (socketRef.current?.connected) {
      socketRef.current.emit('driverlocation', {
        driverId: user.id,
        lat: latitude,
        lng: longitude,
      });
    }
  }, [user?.id]);

  const enableOnline = useCallback(async () => {
    setAvailabilityIssue(null);

    const goOnline = async (lat: number, lng: number) => {
      const updated = await api.patch<any>('/users/online', {
        isOnline: true,
        lat,
        lng,
      });
      markOnlineConfirmed(updated, lat, lng);
    };

    try {
      const pos = await getLocationWithTimeout(DRIVER_ONLINE_GPS_TIMEOUT_MS, true);
      if (!hasValidCoords(pos)) {
        setAvailabilityIssue(DRIVER_LOCATION_RETRY_MESSAGE);
        markOfflineConfirmed();
        return;
      }

      const { latitude, longitude } = pos.coords;
      await goOnline(latitude, longitude);
    } catch (error: any) {
      // Check if it's a permission error
      const isPermDenied = isPermissionDeniedError(error);
      if (isPermDenied) {
        markOfflineConfirmed();
        setAvailabilityIssue(
          '📍 Location permission required. Go to Settings > Apps > BicaDriver > Permissions > Location and enable location access. Then try going online again.',
        );
        return;
      }

      // Suspension or permanent block — don't retry, surface the message
      if (error?.status === 403) {
        markOfflineConfirmed();
        setAvailabilityIssue(error.message || 'Your account is currently suspended. Please contact support.');
        return;
      }

      markOfflineConfirmed();
      setAvailabilityIssue(
        error?.status
          ? error.message || "We couldn't connect to the server. Please check your connection and try again."
          : DRIVER_LOCATION_RETRY_MESSAGE,
      );
    }
  }, [markOfflineConfirmed, markOnlineConfirmed]);

  const disableOnline = useCallback(async () => {
    try {
      await api.patch('/users/online', { isOnline: false });
      await api.patch('/users/location', { lat: null, lng: null }).catch(() => {});
      markOfflineConfirmed();
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        onForcedLogout?.(error.message);
      }
    }
    setAvailabilityIssue(null);
    markOfflineConfirmed();
  }, [markOfflineConfirmed, onForcedLogout]);

  const removeRideRequest = useCallback((rideId: string) => {
    setLiveRideRequests((prev) => prev.filter((ride) => ride.id !== rideId));
  }, []);

  const restoreRideRequest = useCallback((rideRequest: DriverRideRequest) => {
    setLiveRideRequests((prev) => {
      if (prev.some((ride) => ride.id === rideRequest.id)) return prev;
      return [rideRequest, ...prev];
    });
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setIsOnline(false);
      setAvailabilityIssue(null);
      setDriverPos(DEFAULT_DRIVER_POS);
      setLiveRideRequests([]);
      return;
    }

    setIsOnline(Boolean(user.isOnline));
    if (user.currentLocation) {
      setDriverPos([user.currentLocation.lat, user.currentLocation.lng]);
    }
  }, [user?.id, user?.isOnline, user?.currentLocation?.lat, user?.currentLocation?.lng]);

  useEffect(() => {
    if (approvalStatus !== 'APPROVED' || !user?.id || !API_URL) return;

    socketRef.current = io(`${API_URL}/rides`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: {
        token: localStorage.getItem('bica_token'),
      },
    });

    // 🏢 Enterprise metrics collection for socket stability monitoring
    const metricsCollector = getSocketMetricsCollector();

    socketRef.current.on('connect', () => {
      metricsCollector.recordConnect();
      useConnectivityStore.getState().setSocketStatus(true, false);
      registerDriverSocket();
    });

    socketRef.current.on('disconnect', (reason) => {
      metricsCollector.recordDisconnect(reason);
      const isTransient = reason !== 'io client disconnect' && reason !== 'io server disconnect';
      useConnectivityStore.getState().setSocketStatus(false, isTransient);
    });

    socketRef.current.on('reconnect_attempt', () => {
      metricsCollector.recordReconnectAttempt();
      useConnectivityStore.getState().setSocketStatus(false, true);
    });

    const handleIncomingRequest = (trip: any) => {
      sounds.playNotification();
      const rideRequest = mapTripToDriverRideRequest(trip);

      setLiveRideRequests((prev) => {
        if (prev.some((ride) => ride.id === rideRequest.id)) return prev;
        return [rideRequest, ...prev];
      });
    };

    // Aligned with Integration Guide: Supporting both legacy and new events
    socketRef.current.on('ride:assigned', handleIncomingRequest);
    socketRef.current.on('ride:request', handleIncomingRequest);

    socketRef.current.on('ride:cancelled', (data: any) => {
      const tripId = data.tripId || data.id;
      removeRideRequest(tripId);
      onRideCancelled?.({ tripId, message: data.message });
    });

    // Boot-time Sync: Recover any pending or active requests after socket is ready
    // 🛡️ Enhanced with retry logic to handle transient network failures
    const bootSync = async (attempt = 1, maxAttempts = 3) => {
      try {
        const trip = await api.get<any>('/rides/current');
        if (!trip) return;

        if (trip.status === 'PENDING_ACCEPTANCE' || trip.status === 'SEARCHING') {
          // It's a pending request, add to the card queue
          handleIncomingRequest(trip);
        } else if (['ASSIGNED', 'IN_PROGRESS', 'ARRIVED'].includes(trip.status)) {
          // It's an active trip, restore state
          onRideProgress?.({ tripId: trip.id, milestone: trip.status.toLowerCase() });
        }
      } catch (err: any) {
        // 🛡️ Retry with exponential backoff on transient failures
        const isTransientError = 
          err?.message?.includes('timeout') || 
          err?.status === 429 || 
          err?.status === 503 || 
          err?.status === 504;
        
        if (isTransientError && attempt < maxAttempts) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.warn(`[DriverSync] Retry ${attempt}/${maxAttempts} in ${delayMs}ms:`, err);
          setTimeout(() => bootSync(attempt + 1, maxAttempts), delayMs);
        } else {
          console.warn('[DriverSync] Could not recover active ride after retries:', err);
        }
      }
    };
    
    bootSync();

    socketRef.current.on('trip:status', (data: any) => {
      // payload: { tripId, status, milestone }
      if (data.status === 'CANCELLED') {
        removeRideRequest(data.tripId || data.id);
        onRideCancelled?.({ tripId: data.tripId || data.id, message: data.message });
      }
      if (data.milestone) {
        onRideProgress?.(data);
      }
    });

    socketRef.current.on('payment:updated', (data: any) => {
      onPaymentUpdated?.(data);
      if (data.paymentStatus === 'PAID') {
        sounds.playNotification();
      }
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [approvalStatus, user?.id, registerDriverSocket]);

  useEffect(() => {
    if (approvalStatus !== 'APPROVED' || !user?.id || !socketRef.current) return;

    if (!isOnline) {
      clearInterval(trackingInterval.current);
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
      return;
    }

    const initLocation = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;
      
      setIsLocationRefreshing(true);
      setAvailabilityIssue(null);
      try {
        const pos = await getLocationWithTimeout(DRIVER_ONLINE_GPS_TIMEOUT_MS, true);
        if (!hasValidCoords(pos)) {
          throw new Error('Live location was unavailable.');
        }

        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        } else if (socketRef.current) {
          registerDriverSocket();
        }

        const { latitude, longitude } = pos.coords;
        // Send isOnline + lat + lng in ONE atomic request — not two separate calls
        const updated = await api.patch<any>('/users/online', {
          isOnline: true,
          lat: latitude,
          lng: longitude,
        });
        markOnlineConfirmed(updated, latitude, longitude);
        setAvailabilityIssue(null);
      } catch (error: any) {
        console.error('Initial location failed:', error);

        if (error.message?.includes('401') || error.message?.includes('403')) {
          onForcedLogout?.(error.message);
          return;
        }

        let permissionDenied = isPermissionDeniedError(error);
        if (!permissionDenied) {
          try {
            const permissions = await Geolocation.checkPermissions();
            permissionDenied =
              permissions.location === 'denied' || permissions.coarseLocation === 'denied';
          } catch {
            // If permission state cannot be determined, treat as transient.
          }
        }

        if (permissionDenied) {
          await api.patch('/users/online', { isOnline: false }).catch(() => {});
          await api.patch('/users/location', { lat: null, lng: null }).catch(() => {});
          if (socketRef.current?.connected) {
            socketRef.current.disconnect();
          }
          setAvailabilityIssue(
            '📍 Location permission required. Go to Settings > Apps > BicaDriver > Permissions > Location and enable location access.',
          );
          useConnectivityStore.getState().setLocationStatus('denied');
          markOfflineConfirmed();
        } else {
          // Transient issues should keep retrying locally, but the backend requires
          // coordinates before a driver can be marked available.
          if (socketRef.current && !socketRef.current.connected) {
            socketRef.current.connect();
          }
          setAvailabilityIssue(
            'We could not refresh live location yet. Please wait a moment and try going online again.',
          );
          useConnectivityStore.getState().setLocationStatus('timeout');
          markOfflineConfirmed();
        }
      } finally {
        setIsLocationRefreshing(false);
        isInitializing.current = false;
      }
    };

    initLocation();

    trackingInterval.current = setInterval(async () => {
      try {
        const pos = await getLocationWithTimeout(DRIVER_ONLINE_GPS_TIMEOUT_MS);
        if (hasValidCoords(pos)) {
          const { latitude, longitude } = pos.coords;
          // Heartbeat: keep online flag fresh + broadcast location in one request
          const updated = await api.patch<any>('/users/online', {
            isOnline: true,
            lat: latitude,
            lng: longitude,
          });
          markOnlineConfirmed(updated, latitude, longitude);
          setAvailabilityIssue(null);
        }
      } catch (error) {
        console.error('Location interval failed:', error);
      }
    }, 10000);

    const handleResume = () => {
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
        registerDriverSocket();
      }
      if (isOnline) {
        initLocation();
      }
    };

    window.addEventListener('bica-app-resumed', handleResume);

    return () => {
      clearInterval(trackingInterval.current);
      window.removeEventListener('bica-app-resumed', handleResume);
    };
  }, [isOnline, approvalStatus, user?.id, registerDriverSocket, onForcedLogout, markOfflineConfirmed, markOnlineConfirmed]);

  // 🛡️ Socket Token Refresh: Re-authenticate socket when access token is renewed
  useEffect(() => {
    if (!socketRef.current) return;

    // Create an interval to check if token changed (e.g., after 401 refresh)
    const tokenCheckInterval = setInterval(() => {
      const currentToken = localStorage.getItem('bica_token');
      const storedSocketToken = localStorage.getItem('_socket_auth_token');
      
      // If token changed, refresh socket auth and reconnect
      if (currentToken && storedSocketToken !== currentToken) {
        console.log('[SocketAuth] Token refreshed, re-authenticating socket...');
        localStorage.setItem('_socket_auth_token', currentToken);
        
        if (socketRef.current?.connected) {
          // Update auth on live connection
          socketRef.current.auth = { token: currentToken };
          socketRef.current.disconnect();
          socketRef.current.connect();
        } else if (socketRef.current) {
          // Just update auth for next connection
          socketRef.current.auth = { token: currentToken };
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(tokenCheckInterval);
  }, []);

  // 🛡️ Cleanup: Stop location queue when hook unmounts
  useEffect(() => {
    return () => {
      if (locationQueueRef.current) {
        locationQueueRef.current.stop();
      }
    };
  }, []);

  return {
    isOnline,
    isLocationRefreshing,
    availabilityIssue,
    driverPos,
    liveRideRequests,
    enableOnline,
    disableOnline,
    removeRideRequest,
    restoreRideRequest,
  };
};
