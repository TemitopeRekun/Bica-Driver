import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { CapacitorService } from '@/services/CapacitorService';
import { api } from '@/services/api.service';
import { Config } from '@/services/Config';
import { IMAGES } from '@/constants';
import { UserProfile } from '@/types';
import { sounds } from '@/services/SoundService';
import { Geolocation } from '@capacitor/geolocation';
import { useConnectivityStore } from '@/stores/connectivityStore';

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

  const socketRef = useRef<Socket | null>(null);
  const trackingInterval = useRef<any>(null);
  const isInitializing = useRef(false);
  const updateOnlineState = useCallback(
    (nextIsOnline: boolean) => {
      setIsOnline(nextIsOnline);
      onOnlineStatusChange?.(nextIsOnline);
    },
    [onOnlineStatusChange],
  );

  const registerDriverSocket = useCallback(() => {
    if (!socketRef.current?.connected || !user?.id) return;
    socketRef.current.emit('driverregister', { driverId: user.id });
  }, [user?.id]);

  const pushDriverLocation = useCallback(async (latitude: number, longitude: number) => {
    if (!user?.id) return;

    // A: Local UI update
    setDriverPos([latitude, longitude]);

    try {
      // B: State persistence (canonical path)
      await api.patch('/users/location', { lat: latitude, lng: longitude });

      // C: Live broadcast (socket distribute state)
      if (socketRef.current?.connected) {
        socketRef.current.emit('driverlocation', {
          driverId: user.id,
          lat: latitude,
          lng: longitude,
        });
      }
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        onForcedLogout?.(error.message);
      } else {
        console.error('Failed to persist driver location:', error);
      }
    }
  }, [user?.id, onForcedLogout]);

  const enableOnline = useCallback(async () => {
    setAvailabilityIssue(null);

    const goOnline = async (lat?: number, lng?: number) => {
      const body: Record<string, any> = { isOnline: true };
      if (lat !== undefined && lng !== undefined) {
        body.lat = lat;
        body.lng = lng;
      }
      await api.patch('/users/online', body);
    };

    try {
      const pos = await CapacitorService.getCurrentLocation();
      if (pos?.coords) {
        const { latitude, longitude } = pos.coords;
        await goOnline(latitude, longitude);
        setDriverPos([latitude, longitude]);
        updateOnlineState(true);
      } else {
        await goOnline();
        setAvailabilityIssue(
          'You are online but your location could not be detected. ' +
          'Ride requests may not reach you until location is refreshed. ' +
          'Tap "Refresh Location" to fix this.'
        );
        updateOnlineState(true);
      }
    } catch (error: any) {
      // Check if it's a permission error
      const isPermDenied = isPermissionDeniedError(error);
      if (isPermDenied) {
        updateOnlineState(false);
        setAvailabilityIssue(
          '📍 Location permission required. Go to Settings > Apps > BicaDriver > Permissions > Location and enable location access. Then try going online again.',
        );
        return;
      }

      // Suspension or permanent block — don't retry, surface the message
      if (error?.status === 403) {
        updateOnlineState(false);
        setAvailabilityIssue(error.message || 'Your account is currently suspended. Please contact support.');
        return;
      }
      // GPS failed — attempt to go online without coords
      try {
        await goOnline();
        setAvailabilityIssue(
          'You are online but your location could not be detected. ' +
          'Ride requests may not reach you until location is refreshed. ' +
          'Tap "Refresh Location" to fix this.'
        );
        updateOnlineState(true);
      } catch (innerError: any) {
        if (innerError?.status === 403) {
          updateOnlineState(false);
          setAvailabilityIssue(innerError.message || 'Your account is currently suspended. Please contact support.');
          return;
        }
        updateOnlineState(false);
        setAvailabilityIssue("We couldn't connect to the server. Please check your connection and try again.");
      }
    }
  }, [updateOnlineState]);

  const disableOnline = useCallback(async () => {
    try {
      await api.patch('/users/online', { isOnline: false });
      await api.patch('/users/location', { lat: null, lng: null }).catch(() => {});
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        onForcedLogout?.(error.message);
      }
    }
    setAvailabilityIssue(null);
    updateOnlineState(false);
  }, [updateOnlineState, onForcedLogout]);

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

    socketRef.current.on('connect', () => {
      useConnectivityStore.getState().setSocketStatus(true, false);
      registerDriverSocket();
    });

    socketRef.current.on('disconnect', (reason) => {
      const isTransient = reason !== 'io client disconnect' && reason !== 'io server disconnect';
      useConnectivityStore.getState().setSocketStatus(false, isTransient);
    });

    socketRef.current.on('reconnect_attempt', () => {
      useConnectivityStore.getState().setSocketStatus(false, true);
    });

    const handleIncomingRequest = (trip: any) => {
      sounds.playNotification();
      const rideRequest: DriverRideRequest = {
        id: trip.id,
        ownerName: trip.owner?.name || 'Car Owner',
        pickup: trip.pickupAddress,
        destination: trip.destAddress,
        distance: `${trip.distanceKm?.toFixed(1)} km`,
        price: trip.driverEarnings?.toLocaleString() || trip.amount?.toLocaleString(),
        timeToPickup: `${trip.estimatedArrivalMins || 5}m to pickup`,
        tripDuration: `${trip.estimatedMins || trip.fareBreakdown?.totalMins || 10}m trip`,
        avatar: trip.owner?.avatarUrl || IMAGES.USER_AVATAR,
        coords: [trip.pickupLat, trip.pickupLng],
        destCoords: [trip.destLat, trip.destLng],
        status: trip.status,
        pickupAddress: trip.pickupAddress,
        destAddress: trip.destAddress,
        ownerPhone: trip.owner?.phone,
        driverEarnings: trip.driverEarnings,
      };

      setLiveRideRequests((prev) => {
        if (prev.some((ride) => ride.id === trip.id)) return prev;
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
    const bootSync = async () => {
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
      } catch (err) {
        console.warn('[DriverSync] Could not recover active ride:', err);
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
        const pos = await CapacitorService.getCurrentLocation();
        if (
          !pos?.coords ||
          typeof pos.coords.latitude !== 'number' ||
          typeof pos.coords.longitude !== 'number'
        ) {
          throw new Error('Live location was unavailable.');
        }

        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        } else if (socketRef.current) {
          registerDriverSocket();
        }

        const { latitude, longitude } = pos.coords;
        // Send isOnline + lat + lng in ONE atomic request — not two separate calls
        await api.patch('/users/online', {
          isOnline: true,
          lat: latitude,
          lng: longitude,
        });
        setDriverPos([latitude, longitude]);
        setAvailabilityIssue(null);
        useConnectivityStore.getState().setLocationStatus('available');
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
          updateOnlineState(false);
        } else {
          // Transient issues (timeouts/network hiccups) should not force drivers offline.
          if (socketRef.current && !socketRef.current.connected) {
            socketRef.current.connect();
          }
          // Keep driver online — next heartbeat interval will resend coords
          await api.patch('/users/online', { isOnline: true }).catch(() => {});
          setAvailabilityIssue(
            'We could not refresh live location yet. You are still online and retries will continue automatically.',
          );
          useConnectivityStore.getState().setLocationStatus('timeout');
        }
      } finally {
        setIsLocationRefreshing(false);
        isInitializing.current = false;
      }
    };

    initLocation();

    trackingInterval.current = setInterval(async () => {
      try {
        const pos = await CapacitorService.getCurrentLocation();
        if (pos) {
          const { latitude, longitude } = pos.coords;
          // Heartbeat: keep online flag fresh + broadcast location in one request
          await api.patch('/users/online', {
            isOnline: true,
            lat: latitude,
            lng: longitude,
          });
          setDriverPos([latitude, longitude]);
          setAvailabilityIssue(null);
          useConnectivityStore.getState().setLocationStatus('available');
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
  }, [isOnline, approvalStatus, user?.id]);

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
