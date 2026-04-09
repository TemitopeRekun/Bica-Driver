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
    setRideMilestone,
    setCurrentTripId,
    setDriverInfo,
    setTrackedDriverPos,
    setAvailableDrivers,
    resetRide,
  } = useRideStore();

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
        distanceKm: 0, 
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
  }, [setRideState, setRideMilestone, setCurrentTripId, setDriverInfo, addToast]);

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
      addToast(error.message || 'We had trouble cancelling the trip. Please try again or contact support if the issue persists.', 'error');
    }
  }, [resetRide, addToast]);
  
  const syncCurrentRide = useCallback(async () => {
    try {
      const trip = await api.get<any>('/rides/current');
      if (trip) {
        setCurrentTripId(trip.id);
        setDriverInfo({
          ...trip.driver,
          avatar: trip.driver?.avatarUrl || IMAGES.DRIVER_CARD,
          timeAway: trip.estimatedArrivalMins || 5,
          tripId: trip.id,
        });
        if (trip.status === 'SEARCHING') setRideState('SEARCHING');
        else if (trip.status === 'ASSIGNED') setRideState('ASSIGNED');
        else if (trip.status === 'IN_PROGRESS') setRideState('IN_PROGRESS');
      }
      return trip;
    } catch (e) {
      return null;
    }
  }, [setCurrentTripId, setDriverInfo, setRideState]);

  return {
    fetchAvailableDrivers,
    initiateRideRequest,
    handleRideCompletion,
    cancelRide,
    resetRide,
    syncCurrentRide,
  };
};
