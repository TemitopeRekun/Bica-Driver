import { MutableRefObject, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { IMAGES } from '../constants';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface UseOwnerRealtimeOptions {
  ownerId?: string;
  driverInfoId?: string;
  rideState: 'IDLE' | 'SEARCHING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SCHEDULED';
  trackedDriverIdRef: MutableRefObject<string | null>;
  pickupRef: MutableRefObject<any>;
  rideStateRef: MutableRefObject<any>;
  showDriverPickerRef: MutableRefObject<boolean>;
  refreshAvailableDriversRef: MutableRefObject<() => Promise<void>>;
  onDriverAccepted: (payload: { driver: any; estimatedArrivalMins?: number }) => void;
  onDriverDeclined: (payload: { message?: string }) => void;
  onTripCompleted: (payload: { fareBreakdown?: any }) => void;
  onLocationUpdated: (lat: number, lng: number) => void;
}

export const useOwnerRealtime = ({
  ownerId,
  driverInfoId,
  rideState,
  trackedDriverIdRef,
  pickupRef,
  rideStateRef,
  showDriverPickerRef,
  refreshAvailableDriversRef,
  onDriverAccepted,
  onDriverDeclined,
  onTripCompleted,
  onLocationUpdated,
}: UseOwnerRealtimeOptions) => {
  const ownerSocketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!ownerId) return;

    ownerSocketRef.current = io(`${API_URL}/rides`, {
      transports: ['websocket'],
    });

    ownerSocketRef.current.on('connect', () => {
      ownerSocketRef.current?.emit('owner:register', { ownerId });
    });

    ownerSocketRef.current.on('ride:accepted', (data: any) => {
      onDriverAccepted({
        driver: {
          ...data.driver,
          avatar: data.driver?.avatarUrl || IMAGES.DRIVER_CARD,
        },
        estimatedArrivalMins: data.estimatedArrivalMins,
      });

      if (data.driver?.id) {
        trackedDriverIdRef.current = data.driver.id;
      }
    });

    ownerSocketRef.current.on('ride:declined', (data: any) => {
      onDriverDeclined(data);
    });

    ownerSocketRef.current.on('trip:completed', (data: any) => {
      onTripCompleted(data);
    });

    ownerSocketRef.current.on('driver:availability', () => {
      if ((showDriverPickerRef.current || rideStateRef.current === 'IDLE') && pickupRef.current) {
        refreshAvailableDriversRef.current().catch((error) => {
          console.error('Failed to refresh drivers after availability update:', error);
        });
      }
    });

    ownerSocketRef.current.on('location:updated', (data: any) => {
      if (!trackedDriverIdRef.current || data.driverId !== trackedDriverIdRef.current) return;
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        onLocationUpdated(data.lat, data.lng);
      }
    });

    return () => {
      ownerSocketRef.current?.disconnect();
      ownerSocketRef.current = null;
    };
  }, [
    ownerId,
    onDriverAccepted,
    onDriverDeclined,
    onTripCompleted,
    onLocationUpdated,
    pickupRef,
    refreshAvailableDriversRef,
    rideStateRef,
    showDriverPickerRef,
    trackedDriverIdRef,
  ]);

  useEffect(() => {
    if (
      ownerSocketRef.current?.connected &&
      driverInfoId &&
      (rideState === 'ASSIGNED' || rideState === 'IN_PROGRESS')
    ) {
      trackedDriverIdRef.current = driverInfoId;
      ownerSocketRef.current.emit('track:driver', { driverId: driverInfoId });
    }
  }, [driverInfoId, rideState, trackedDriverIdRef]);
};
