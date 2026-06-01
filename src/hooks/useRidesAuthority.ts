import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api.service';
import { useAuthStore } from '@/stores/authStore';
import { useRideStore } from '@/stores/rideStore';
import { UserRole } from '@/types';

/**
 * 🛡️ RIDES CURRENT AUTHORITY HOOK
 * Makes /rides/current the source of truth for routing decisions.
 * Call this on all key routes to ensure active trips are always recovered.
 */
export const useRidesAuthority = (options?: {
  autoRedirect?: boolean;
  onAuthorityCheck?: (trip: any | null) => void;
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { setRideState, setCurrentTripId, setCompletedTripData } = useRideStore();
  const [activeRide, setActiveRide] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    const fetchAuthority = async () => {
      try {
        const ride = await api.get<any>('/rides/current');
        setActiveRide(ride);

        // Call callback if provided (for custom logic)
        options?.onAuthorityCheck?.(ride);

        // Auto-redirect if active trip and we should
        if (options?.autoRedirect && ride) {
          const { status, id, postTripAction } = ride;

          // Active trip states
          const activeTripsOwner = ['PENDING_ACCEPTANCE', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'SCHEDULED'];
          const activeTripsDriver = ['ASSIGNED', 'ARRIVED', 'IN_PROGRESS'];

          const isOwnerActiveTrip = currentUser.role === UserRole.OWNER && activeTripsOwner.includes(status);
          const isDriverActiveTrip = currentUser.role === UserRole.DRIVER && activeTripsDriver.includes(status);

          if (isOwnerActiveTrip) {
            console.log(`🔄 [AUTHORITY] Owner has active trip ${id} [${status}] — redirecting to status`);
            setCurrentTripId(id);
            setRideState(status as any);
            navigate('/owner/status', { replace: true });
          } else if (isDriverActiveTrip) {
            console.log(`🔄 [AUTHORITY] Driver has active trip ${id} [${status}] — redirecting to main`);
            setCurrentTripId(id);
            setRideState(status as any);
            navigate('/driver', { replace: true });
          }
          // Post-trip actions
          else if (postTripAction) {
            if (postTripAction === 'AWAITING_PAYMENT' && currentUser.role === UserRole.DRIVER) {
              navigate(`/driver/awaiting-payment/${id}`, { replace: true });
            } else if (postTripAction === 'REQUIRE_PAYMENT' && currentUser.role === UserRole.OWNER) {
              setCompletedTripData(ride);
              setCurrentTripId(id);
              setRideState('COMPLETED');
              navigate('/owner/status', { replace: true });
            } else if (postTripAction === 'REQUIRE_RATING' && currentUser.role === UserRole.OWNER) {
              navigate(`/rate-driver/${id}`, { replace: true });
            }
          }
        }
      } catch (e: any) {
        console.warn('[AUTHORITY] Failed to fetch current ride:', e.message);
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuthority();
  }, [currentUser?.id]);

  return { activeRide, isLoading, error };
};
