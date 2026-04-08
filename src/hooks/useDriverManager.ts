import { useCallback, useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useRideStore } from '@/stores/rideStore';
import { api } from '@/services/api.service';
import { WalletSummary, Trip } from '@/types';

export const useDriverManager = () => {
  const { currentUser } = useAuthStore();
  const { addToast } = useUIStore();
  const { setRideState, setRideMilestone } = useRideStore();
  
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadWalletSummary = useCallback(async () => {
    try {
      const summary = await api.get<WalletSummary>('/payments/wallet');
      setWalletSummary(summary);
      return summary;
    } catch (error: any) {
      console.error('Failed to load wallet summary:', error);
      return null;
    }
  }, []);

  const updateRideStatus = useCallback(async (tripId: string, status: 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED') => {
    setIsUpdatingStatus(true);
    try {
      const result = await api.patch<any>(`/rides/${tripId}/status`, { status });
      
      if (status === 'ARRIVED') {
        setRideMilestone('arrived');
      } else if (status === 'IN_PROGRESS') {
        setRideMilestone('in_progress');
      } else if (status === 'COMPLETED') {
        setRideState('COMPLETED');
        setRideMilestone('completed');
        addToast('Trip completed successfully!', 'success');
        await loadWalletSummary();
      }
      
      return result;
    } catch (error: any) {
      addToast(error.message || `Failed to update status to ${status}`, 'error');
      throw error;
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [addToast, setRideMilestone, setRideState, loadWalletSummary]);

  const acceptRide = useCallback(async (tripId: string) => {
    try {
      await api.post(`/rides/${tripId}/accept`);
      setRideState('ASSIGNED');
      setRideMilestone('assigned');
      addToast('Ride accepted! Proceed to pickup.', 'success');
    } catch (error: any) {
      addToast(error.message || 'Failed to accept ride.', 'error');
      throw error;
    }
  }, [addToast, setRideState, setRideMilestone]);

  const declineRide = useCallback(async (tripId: string) => {
    try {
      await api.post(`/rides/${tripId}/decline`);
      addToast('Ride declined.', 'info');
    } catch (error: any) {
      addToast(error.message || 'Failed to decline ride.', 'error');
    }
  }, [addToast]);

  return {
    walletSummary,
    isUpdatingStatus,
    loadWalletSummary,
    updateRideStatus,
    acceptRide,
    declineRide,
    syncCurrentRide: useCallback(async () => {
      try {
        const activeTrip = await api.get<Trip>('/rides/current');
        if (activeTrip) {
          setRideState(activeTrip.status as any);
          setRideMilestone(activeTrip.progressMilestone || 'assigned');
          return activeTrip;
        }
        return null;
      } catch (error) {
        return null;
      }
    }, [setRideState, setRideMilestone]),
  };
}
