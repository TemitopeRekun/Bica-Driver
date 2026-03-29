import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { CapacitorService } from '../services/CapacitorService';
import { api } from '../services/api.service';
import { Config } from '../services/Config';
import { IMAGES } from '../constants';
import { UserProfile } from '../types';

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
}

const DEFAULT_DRIVER_POS: [number, number] = [6.4549, 3.3896];

export const useDriverRealtime = ({
  user,
  approvalStatus,
  onOnlineStatusChange,
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
    setDriverPos([latitude, longitude]);
    await api.patch('/users/location', { lat: latitude, lng: longitude });
    if (socketRef.current?.connected) {
      socketRef.current.emit('driver:location', {
        driverId: user.id,
        lat: latitude,
        lng: longitude,
      });
    }
  }, [user?.id]);

  const enableOnline = useCallback(() => {
    setAvailabilityIssue(null);
    updateOnlineState(true);
  }, [updateOnlineState]);

  const disableOnline = useCallback(async () => {
    await api.patch('/users/online', { isOnline: false });
    await api.patch('/users/location', { lat: null, lng: null }).catch(() => {});
    setAvailabilityIssue(null);
    updateOnlineState(false);
  }, [updateOnlineState]);

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
      } catch (error) {
        console.error('Initial location failed:', error);
        await api.patch('/users/online', { isOnline: false }).catch(() => {});
        await api.patch('/users/location', { lat: null, lng: null }).catch(() => {});
        if (socketRef.current?.connected) {
          socketRef.current.disconnect();
        }
        setAvailabilityIssue(
          'Location access is required before owners can see you. Turn on location and try going online again.',
        );
        updateOnlineState(false);
      } finally {
        setIsLocationRefreshing(false);
      }
    };

    initLocation();

    trackingInterval.current = setInterval(async () => {
      try {
        const pos = await CapacitorService.getCurrentLocation();
        if (pos) {
          const { latitude, longitude } = pos.coords;
          await pushDriverLocation(latitude, longitude);
        }
      } catch (error) {
        console.error('Location interval failed:', error);
      }
    }, 10000);

    return () => {
      clearInterval(trackingInterval.current);
    };
  }, [isOnline, approvalStatus, user?.id, registerDriverSocket, pushDriverLocation]);

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
