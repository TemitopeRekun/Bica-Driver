import { MutableRefObject, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { IMAGES } from '@/constants';
import { Config } from '@/services/Config';
import { sounds } from '@/services/SoundService';

const API_URL = Config.apiUrl;

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
  onPaymentUpdated: (payload: { tripId: string; paymentStatus: string; paidAt: string | null; transactionReference: string | null; message: string }) => void;
  onRideProgress?: (payload: { tripId: string; milestone: 'assigned' | 'arrived' | 'inprogress' | 'in_progress' | 'completed'; timestamp?: string; status?: any }) => void;
  onLocationUpdated: (lat: number, lng: number) => void;
  syncCurrentRide?: () => Promise<any>;
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
  onPaymentUpdated,
  onRideProgress,
  onLocationUpdated,
  syncCurrentRide,
}: UseOwnerRealtimeOptions) => {
  const ownerSocketRef = useRef<Socket | null>(null);
  const onDriverAcceptedRef = useRef(onDriverAccepted);
  const onDriverDeclinedRef = useRef(onDriverDeclined);
  const onTripCompletedRef = useRef(onTripCompleted);
  const onPaymentUpdatedRef = useRef(onPaymentUpdated);
  const onRideProgressRef = useRef(onRideProgress);
  const onLocationUpdatedRef = useRef(onLocationUpdated);
  const syncCurrentRideRef = useRef(syncCurrentRide);
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
    onPaymentUpdatedRef.current = onPaymentUpdated;
  }, [onPaymentUpdated]);

  useEffect(() => {
    onRideProgressRef.current = onRideProgress;
  }, [onRideProgress]);

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
    if (!ownerId || !API_URL) return;

    ownerSocketRef.current = io(`${API_URL}/rides`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: {
        token: localStorage.getItem('bica_token'),
      },
    });

    const connectTimer = setTimeout(() => {
      ownerSocketRef.current?.connect();
    }, 0);

    ownerSocketRef.current.on('connect', () => {
      ownerSocketRef.current?.emit('owner:register', { ownerId });
      if (
        driverInfoIdRef.current &&
        (rideStateValueRef.current === 'ASSIGNED' || rideStateValueRef.current === 'IN_PROGRESS')
      ) {
        trackedDriverIdRef.current = driverInfoIdRef.current;
        ownerSocketRef.current?.emit('trackdriver', { driverId: driverInfoIdRef.current });
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
      sounds.playSuccess();

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

    ownerSocketRef.current.on('payment:updated', (data: any) => {
      if (data.paymentStatus === 'PAID' || data.message?.toLowerCase().includes('success')) {
        sounds.playSuccess();
      }
      onPaymentUpdatedRef.current(data);
    });

    ownerSocketRef.current.on('ride:progress', (data: any) => {
      // payload: { tripId, milestone, timestamp }
      const m = data.milestone;
      if (m) {
        onRideProgressRef.current?.({
          ...data,
          milestone: (m === 'inprogress' || m === 'in_progress' || m === 'trip') ? 'in_progress' : m as any
        });
        if (m === 'arrived') {
          sounds.playAlert();
        }
      }
    });

    ownerSocketRef.current.on('trip:status', (data: any) => {
      // payload: { tripId, status, milestone }
      if (data.status === 'COMPLETED') {
        onTripCompletedRef.current({ fareBreakdown: data.fareBreakdown });
      } else if (data.status || data.milestone) {
        // Aligned with Guide: Fail-Forward sync logic
        onRideProgressRef.current?.({
          tripId: data.tripId || data.id,
          milestone: (data.milestone || data.status.toLowerCase()) as any
        });
        if (data.milestone === 'arrived' || data.status === 'ARRIVED') {
          sounds.playAlert();
        } else if (data.status === 'COMPLETED') {
          sounds.playNotification();
        }
      }
    });

    ownerSocketRef.current.on('driver:availability', () => {
      if ((showDriverPickerRef.current || rideStateRef.current === 'IDLE') && pickupRef.current) {
        refreshAvailableDriversRef.current().catch((error) => {
          console.error('Failed to refresh drivers after availability update:', error);
        });
      }
    });

    ownerSocketRef.current.on('locationupdated', (data: any) => {
      if (!trackedDriverIdRef.current || data.driverId !== trackedDriverIdRef.current) return;
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        onLocationUpdatedRef.current(data.lat, data.lng);
      }
    });

    return () => {
      clearTimeout(connectTimer);
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
      ownerSocketRef.current.emit('trackdriver', { driverId: driverInfoId });
    }
  }, [driverInfoId, rideState, trackedDriverIdRef]);

  return {
    isConnected: ownerSocketRef.current?.connected || false,
    emitCancel: (tripId: string) => {
      if (ownerSocketRef.current?.connected) {
        console.log(`📡 [WS] Cancellation signal dispatched to Driver for trip: ${tripId}`);
        ownerSocketRef.current.emit('ride:cancel', { tripId });
      }
    }
  };
};
