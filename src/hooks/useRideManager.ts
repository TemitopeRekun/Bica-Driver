import { useCallback, useEffect } from 'react';
import { useRideStore } from '@/stores/rideStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { api } from '@/services/api.service';
import { IMAGES } from '@/constants';
import { Trip, LocationData } from '@/types';
import { getLocationAddress, getLocationShortText } from '@/services/LocationService';

export const useRideManager = () => {
  const { currentUser } = useAuthStore();
  const { addToast } = useUIStore();
  const {
    rideState,
    setRideState,
    rideMilestone,
    setRideMilestone,
    currentTripId,
    setCurrentTripId,
    driverInfo,
    setDriverInfo,
    trackedDriverPos,
    setTrackedDriverPos,
    setAvailableDrivers,
    completedTripData,
    setCompletedTripData,
    routePreview,
    setRoutePreview,
    resetRide,
  } = useRideStore();

  const syncCurrentRide = useCallback(async () => {
    try {
      const trip = await api.get<any>('/rides/current');
      // Access current state via store to avoid dependency loop
      const { rideState: currentState, setLastUserId } = useRideStore.getState();

      if (trip && currentUser?.id) {
        // Record who this trip belongs to for persistence security
        setLastUserId(currentUser.id);
        
        setCurrentTripId(trip.id);
        setDriverInfo({
          ...trip.driver,
          avatar: trip.driver?.avatarUrl || IMAGES.DRIVER_CARD,
          otp: trip.otp,
          acceptanceImageUrl: trip.acceptanceImageUrl,
          timeAway: trip.estimatedArrivalMins || 5,
          tripId: trip.id,
        });
        
        if (trip.status === 'SEARCHING') setRideState('SEARCHING');
        else if (trip.status === 'ASSIGNED') setRideState('ASSIGNED');
        else if (trip.status === 'IN_PROGRESS') setRideState('IN_PROGRESS');
        else if (trip.status === 'COMPLETED') {
          setCompletedTripData(trip);
          setRideState('COMPLETED');
        }
      } else {
        // IMPORTANT: Only reset if we aren't currently in a "Live" transition state.
        // This prevents accidental "automatic cancellations" if the sync call fails or returns null temporarily.
        const PROTECTED_STATES: string[] = ['SEARCHING', 'ASSIGNED', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED'];
        if (!PROTECTED_STATES.includes(currentState)) {
          resetRide();
        }
      }
      return trip;
    } catch (e) {
      console.error('Ride sync failed (server error):', e);
      // Resilience: If the server is 500ing, we don't wipe local state blindly. 
      // We keep the current UI but return null to the caller.
      return null;
    }
  }, [setCurrentTripId, setDriverInfo, setRideState, setCompletedTripData, resetRide, currentUser?.id]);

  const fetchAvailableDrivers = useCallback(async (pickup: LocationData | null, transmission: string) => {
    if (!pickup?.lat || !pickup?.lon) {
       console.warn('Cannot fetch drivers: Pickup location is invalid.');
       setAvailableDrivers([]);
       return [];
    }
    try {
      const transmissionParam = transmission ? `&transmission=${encodeURIComponent(transmission.toUpperCase())}` : '';
      const drivers = await api.get<any[]>(
        `/users/drivers/available?pickupLat=${pickup.lat}&pickupLng=${pickup.lon}${transmissionParam}`
      );
      setAvailableDrivers(drivers);
      return drivers;
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
      setAvailableDrivers([]);
      return [];
    }
  }, [setAvailableDrivers]);

  const getRoute = useCallback(async (origin: LocationData, destination: LocationData) => {
    try {
      const route = await api.get<any>(
        `/locations/route?originLat=${origin.lat}&originLng=${origin.lon}&destLat=${destination.lat}&destLng=${destination.lon}`
      );
      setRoutePreview({
        distanceKm: route.distanceKm,
        estimatedMins: route.estimatedMins
      });
      return route;
    } catch (error) {
      console.error('Failed to calculate route:', error);
      return null;
    }
  }, [setRoutePreview]);

  const initiatePayment = useCallback(async (tripId: string) => {
    try {
      const response = await api.post<any>(`/payments/initiate/${tripId}`);
      if (response.checkoutUrl) {
        // Stash tripId so PaymentCompleteScreen can poll status on return
        localStorage.setItem('bica_pending_payment_tripId', tripId);
        // Redirect to Monnify Sandbox/Live checkout
        window.location.href = response.checkoutUrl;
      }
      return response;
    } catch (error: any) {
      addToast(error.message || 'Failed to initiate payment. Please try again.', 'error');
      throw error;
    }
  }, [addToast]);

  const initiateRideRequest = useCallback(async (
    pickup: LocationData, 
    destination: LocationData, 
    driver: any, 
    vehicleData: any,
    scheduledAt?: string | null,
    idempotencyKey?: string
  ) => {
    setRideState(scheduledAt ? 'SCHEDULED' : 'SEARCHING');
    setRideMilestone(scheduledAt ? 'scheduled' : 'requested');
    
    try {
      const trip = await api.post<any>('/rides', {
        pickupAddress: getLocationAddress(pickup),
        pickupLat: pickup.lat,
        pickupLng: pickup.lon,
        destAddress: getLocationAddress(destination),
        destLat: destination.lat,
        destLng: destination.lon,
        distanceKm: routePreview?.distanceKm || 0, 
        estimatedMins: routePreview?.estimatedMins || 0,
        driverId: driver.id,
        transmission: vehicleData.transmission,
        scheduledAt: scheduledAt || null,
      }, true, { idempotencyKey });

      if (!scheduledAt) {
        setCurrentTripId(trip.id);
        setDriverInfo({
          ...trip.driver,
          avatar: trip.driver?.avatarUrl || IMAGES.DRIVER_CARD,
          timeAway: driver.estimatedArrivalMins || 5,
          tripId: trip.id,
        });
      }
      
      addToast(scheduledAt ? 'Great! Your ride has been scheduled successfully.' : 'Your request has been sent! We\'re just waiting for the chauffeur to confirm.', 'info');
      return trip;
    } catch (error: any) {
      addToast(error.message || 'We couldn\'t process your request right now. Please try again or check your connection.', 'error');
      setRideState('IDLE');
      throw error;
    }
  }, [setRideState, setRideMilestone, setCurrentTripId, setDriverInfo, addToast, routePreview]);

  const handleRideCompletion = useCallback((trip: Trip) => {
    addToast('Trip completed! Thank you for riding with BICA.', 'success');
    setRideState('COMPLETED');
    setRideMilestone('completed');
  }, [addToast, setRideState, setRideMilestone]);

  const cancelRide = useCallback(async (tripId: string) => {
    try {
      await api.post(`/rides/${tripId}/cancel`);
      resetRide();
      addToast('Your ride has been cancelled as requested.', 'info');
    } catch (error: any) {
      if (error.status === 400 || error.message?.includes('state')) {
        addToast('State mismatch. Refreshing status...', 'info');
        await syncCurrentRide();
      } else {
        addToast(error.message || 'We had trouble cancelling the trip. Please try again or contact support if the issue persists.', 'error');
      }
    }
  }, [resetRide, addToast, syncCurrentRide]);

  const getPaymentStatus = useCallback(async (tripId: string) => {
    try {
      return await api.get<any>(`/payments/status/${tripId}`);
    } catch (error: any) {
      console.error('Failed to get payment status:', error);
      throw error;
    }
  }, []);
  
  return {
    fetchAvailableDrivers,
    initiateRideRequest,
    handleRideCompletion,
    cancelRide,
    resetRide,
    syncCurrentRide,
    getRoute,
    initiatePayment,
    getPaymentStatus,
  };
};
