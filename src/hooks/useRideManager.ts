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

  const fetchAvailableDrivers = useCallback(async (pickup: LocationData, transmission: string) => {
    try {
      const transmissionParam = transmission ? `&transmission=${encodeURIComponent(transmission)}` : '';
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
    scheduledAt?: string | null
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
      });

      if (!scheduledAt) {
        setCurrentTripId(trip.id);
        setDriverInfo({
          ...trip.driver,
          avatar: trip.driver?.avatarUrl || IMAGES.DRIVER_CARD,
          timeAway: driver.estimatedArrivalMins || 5,
          tripId: trip.id,
        });
      }
      
      addToast(scheduledAt ? 'Ride successfully scheduled!' : 'Ride request sent! Waiting for driver to accept.', 'info');
      return trip;
    } catch (error: any) {
      addToast(error.message || 'Could not book ride. Please try again.', 'error');
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
      addToast('Ride cancelled.', 'info');
    } catch (error: any) {
      addToast(error.message || 'Failed to cancel ride.', 'error');
    }
  }, [resetRide, addToast]);

  return {
    fetchAvailableDrivers,
    initiateRideRequest,
    handleRideCompletion,
    cancelRide,
    resetRide,
  };
};
