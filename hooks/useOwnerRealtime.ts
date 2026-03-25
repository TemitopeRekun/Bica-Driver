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
  const onDriverAcceptedRef = useRef(onDriverAccepted);
  const onDriverDeclinedRef = useRef(onDriverDeclined);
  const onTripCompletedRef = useRef(onTripCompleted);
  const onLocationUpdatedRef = useRef(onLocationUpdated);
  const driverInfoIdRef = useRef(driverInfoId);
  const rideStateValueRef = useRef(rideState);

  useEffect(() => {
    onDriverAcceptedRef.current = onDriverAccepted;
  }, [onDriverAccepted]);

  useEffect(() => {
    onDriverDeclinedRef.current = onDriverDeclined;
  }, [onDriverDeclined]);

  useEffect(() => {
    onTripCompletedRef.current = onTripCompleted;
  }, [onTripCompleted]);

  useEffect(() => {
    onLocationUpdatedRef.current = onLocationUpdated;
  }, [onLocationUpdated]);

  useEffect(() => {
    driverInfoIdRef.current = driverInfoId;
  }, [driverInfoId]);

  useEffect(() => {
    rideStateValueRef.current = rideState;
  }, [rideState]);

  useEffect(() => {
    if (!ownerId) return;

    ownerSocketRef.current = io(`${API_URL}/rides`, {
      transports: ['websocket'],
    });

    ownerSocketRef.current.on('connect', () => {
      ownerSocketRef.current?.emit('owner:register', { ownerId });
      if (
        driverInfoIdRef.current &&
        (rideStateValueRef.current === 'ASSIGNED' || rideStateValueRef.current === 'IN_PROGRESS')
      ) {
        trackedDriverIdRef.current = driverInfoIdRef.current;
        ownerSocketRef.current?.emit('track:driver', { driverId: driverInfoIdRef.current });
      }
    });

    ownerSocketRef.current.on('ride:accepted', (data: any) => {
      onDriverAcceptedRef.current({
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
      onDriverDeclinedRef.current(data);
    });

    ownerSocketRef.current.on('trip:completed', (data: any) => {
      onTripCompletedRef.current(data);
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
        onLocationUpdatedRef.current(data.lat, data.lng);
      }
    });

    return () => {
      ownerSocketRef.current?.disconnect();
      ownerSocketRef.current = null;
    };
  }, [ownerId, pickupRef, refreshAvailableDriversRef, rideStateRef, showDriverPickerRef, trackedDriverIdRef]);

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
