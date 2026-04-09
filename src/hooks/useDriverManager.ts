import { useCallback, useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useRideStore } from '@/stores/rideStore';
import { api } from '@/services/api.service';
import { WalletSummary, Trip } from '@/types';

export const useDriverManager = () => {
  const { currentUser } = useAuthStore();
  const { addToast } = useUIStore();
  const { setRideState, setRideMilestone, resetRide } = useRideStore();
  
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
      }      if (status === 'COMPLETED') {
        setRideState('COMPLETED');
        setRideMilestone('completed');
        addToast('Great job! Trip completed successfully.', 'success');
        await loadWalletSummary();
      }
      
      return result;
    } catch (error: any) {
      addToast(error.message || `We couldn't update the status to ${status.toLowerCase()}. Please check your connection.`, 'error');
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
      addToast('Ride accepted! You can now proceed to the pickup location.', 'success');
    } catch (error: any) {
      addToast(error.message || 'We had trouble accepting this ride. It might have been taken or cancelled.', 'error');
      throw error;
    }
  }, [addToast, setRideState, setRideMilestone]);

  const declineRide = useCallback(async (tripId: string) => {
    try {
      await api.post(`/rides/${tripId}/decline`);
      addToast('Ride declined. We\'ll look for more requests for you.', 'info');
    } catch (error: any) {
      addToast(error.message || 'We couldn\'t decline the ride right now. Please try again.', 'error');
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
        } else {
          // Force reset if backend says nothing is active
          resetRide();
          return null;
        }
      } catch (error) {
        // On network error, we stay silent to avoid clearing state during transient disconnects
        return null;
      }
    }, [setRideState, setRideMilestone, resetRide]),
  };
}
