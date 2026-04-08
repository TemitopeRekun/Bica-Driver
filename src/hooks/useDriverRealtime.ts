import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { CapacitorService } from '@/services/CapacitorService';
import { api } from '@/services/api.service';
import { Config } from '@/services/Config';
import { IMAGES } from '@/constants';
import { UserProfile } from '@/types';
import { Geolocation } from '@capacitor/geolocation';

const API_URL = Config.apiUrl;

export interface DriverRideRequest {
  id: string;
  ownerName: string;
  pickup: string;
  destination: string;
  distance: string;
  price: string;
  time: string;
  avatar: string;
  coords: [number, number];
  destCoords: [number, number];
  estimatedMins?: number | null;
}

interface UseDriverRealtimeOptions {
  user: UserProfile | null;
  approvalStatus: string;
  onOnlineStatusChange?: (isOnline: boolean) => void;
  onForcedLogout?: (message?: string) => void;
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
    socketRef.current.emit('driver:register', { driverId: user.id });
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

  const enableOnline = useCallback(() => {
    setAvailabilityIssue(null);
    updateOnlineState(true);
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
    });

    socketRef.current.on('connect', () => {
      registerDriverSocket();
    });

    socketRef.current.on('ride:assigned', (trip: any) => {
      const rideRequest: DriverRideRequest = {
        id: trip.id,
        ownerName: trip.owner?.name || 'Car Owner',
        pickup: trip.pickupAddress,
        destination: trip.destAddress,
        distance: `${trip.distanceKm?.toFixed(1)} km`,
        price: trip.driverEarnings?.toLocaleString() || trip.amount?.toLocaleString(),
        time: `${trip.estimatedArrivalMins || 5} mins`,
        avatar: trip.owner?.avatarUrl || IMAGES.USER_AVATAR,
        coords: [trip.pickupLat, trip.pickupLng],
        destCoords: [trip.destLat, trip.destLng],
        estimatedMins: trip.estimatedMins ?? null,
      };

      setLiveRideRequests((prev) => {
        if (prev.some((ride) => ride.id === trip.id)) return prev;
        return [rideRequest, ...prev];
      });
    });

    socketRef.current.on('trip:status', (data: any) => {
      // payload: { tripId, status, milestone }
      if (data.status === 'CANCELLED' || data.status === 'COMPLETED') {
        removeRideRequest(data.tripId);
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

        if (!socketRef.current?.connected) {
          socketRef.current.connect();
        } else {
          registerDriverSocket();
        }

        const { latitude, longitude } = pos.coords;
        await pushDriverLocation(latitude, longitude);
        await api.patch('/users/online', { isOnline: true });
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
            'Location permission is disabled. Enable location permission and go online again.',
          );
          updateOnlineState(false);
        } else {
          // Transient issues (timeouts/network hiccups) should not force drivers offline.
          if (!socketRef.current?.connected) {
            socketRef.current.connect();
          }
          await api.patch('/users/online', { isOnline: true }).catch(() => {});
          setAvailabilityIssue(
            'We could not refresh live location yet. You are still online and retries will continue automatically.',
          );
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
          await pushDriverLocation(latitude, longitude);
          await api.patch('/users/online', { isOnline: true }).catch(() => {});
          setAvailabilityIssue(null);
        }
      } catch (error) {
        console.error('Location interval failed:', error);
      }
    }, 10000);

    return () => {
      clearInterval(trackingInterval.current);
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
