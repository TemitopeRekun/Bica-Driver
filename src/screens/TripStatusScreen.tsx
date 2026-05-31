import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useRideStore } from '@/stores/rideStore';
import { useUIStore } from '@/stores/uiStore';
import { useRideManager } from '@/hooks/useRideManager';
import { useOwnerRealtime } from '@/hooks/useOwnerRealtime';
import { useOwnerLocationSearch } from '@/hooks/useOwnerLocationSearch';
import InteractiveMap from '@/components/InteractiveMap';
import DriverStatusCard from '@/components/RequestRide/DriverStatusCard';
import TripPaymentSummary from '@/components/RequestRide/TripPaymentSummary';
import { IMAGES } from '@/constants';
import { getLocationShortText } from '@/services/LocationService';
import { api } from '@/services/api.service';
import { notificationService, normalizeNotificationType } from '@/services/NotificationService';
import EmergencyHelpSheet from '@/components/EmergencyHelpSheet';

const ScheduledHoldingCard: React.FC<{
  scheduledAt?: string;
  onCancel: () => void;
}> = ({ scheduledAt, onCancel }) => {
  const formatLagosTime = (iso?: string) => {
    if (!iso) return 'Pending Assignment';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(iso));
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up">
      <div className="flex flex-col items-center text-center py-4">
        <div className="size-20 rounded-[2rem] bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
          <span className="material-symbols-outlined text-4xl">calendar_month</span>
        </div>
        
        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase mb-2">
          Your ride is scheduled
        </h3>
        
        <div className="bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-xl mb-4 border border-slate-200 dark:border-white/10">
          <p className="text-lg font-black text-amber-600 dark:text-amber-500 tracking-tighter">
            {formatLagosTime(scheduledAt)}
          </p>
        </div>

        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest max-w-[240px] leading-relaxed">
          Your driver will be assigned automatically before your trip
        </p>
      </div>

      <button
        onClick={onCancel}
        className="mt-6 w-full py-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-sm uppercase tracking-wider hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-lg">close</span>
        Cancel Ride
      </button>
    </div>
  );
};

const TripStatusScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { addToast } = useUIStore();
  const { 
    rideState, setRideState, rideMilestone, setRideMilestone,
    currentTripId, driverInfo, setDriverInfo,
    trackedDriverPos, setTrackedDriverPos,
    completedTripData, setCompletedTripData,
    pickup, destination, resetRide
  } = useRideStore();
  
  const [isPolling, setIsPolling] = React.useState(false);
  const [showEmergencyHelp, setShowEmergencyHelp] = React.useState(false);
  const isPollingRef = React.useRef(false);
  
  const { cancelRide, syncCurrentRide, initiatePayment } = useRideManager();
  
  // Real-time synchronization refs
  const trackedDriverIdRef = useRef<string | null>(null);
  const pickupRef = useRef(pickup);
  const rideStateRef = useRef(rideState);
  const showDriverPickerRef = useRef(false);
  const refreshAvailableDriversRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    pickupRef.current = pickup;
    rideStateRef.current = rideState;
  }, [pickup, rideState]);

  const { emitCancel } = useOwnerRealtime({
    ownerId: currentUser?.id,
    driverInfoId: driverInfo?.id,
    rideState,
    trackedDriverIdRef,
    pickupRef,
    rideStateRef,
    showDriverPickerRef,
    refreshAvailableDriversRef,
    onDriverAccepted: ({ driver, estimatedArrivalMins }) => {
      setDriverInfo({ ...driver, timeAway: estimatedArrivalMins || 5 });
    },
    onDriverDeclined: () => {
      addToast('The chauffeur declined. Please try another request.', 'info');
      navigate('/owner');
    },
    onTripCompleted: (data) => {
      setCompletedTripData(data);
      setRideState('COMPLETED');
      setRideMilestone('completed');
    },
    onPaymentUpdated: (payload) => {
       if (payload.paymentStatus === 'PAID') {
          addToast('Payment confirmed! Your ride is fully settled.', 'success');
          const current = useRideStore.getState().completedTripData;
          if (current) {
            setCompletedTripData({ ...current, paymentStatus: 'PAID' });
          }
       }
    },
    onLocationUpdated: (lat, lng) => setTrackedDriverPos([lat, lng]),
    syncCurrentRide,
    onRideProgress: (payload) => {
       const m = payload.milestone?.toLowerCase();
       if (m === 'inprogress' || m === 'in_progress' || m === 'trip') setRideMilestone('in_progress');
       else if (m === 'arrived') setRideMilestone('arrived');
       else if (m === 'assigned') setRideMilestone('assigned');
       else if (m === 'completed') setRideMilestone('completed');

       if (payload.otp || payload.acceptanceImageUrl) {
         setDriverInfo({
           ...driverInfo,
           otp: payload.otp || driverInfo?.otp,
           acceptanceImageUrl: payload.acceptanceImageUrl || driverInfo?.acceptanceImageUrl
         });
       }
    }
  });

  const emergencyContext = React.useMemo(() => ({
    tripId: currentTripId ?? undefined,
    tripStatus: rideState as any,
    pickupAddress: pickup ? getLocationShortText(pickup) : undefined,
    destAddress: destination ? getLocationShortText(destination) : undefined,
    ownerName: currentUser?.name || 'Car Owner',
    ownerPhone: currentUser?.phone || '',
    driverName: driverInfo?.name || 'Driver',
    driverPhone: driverInfo?.phone || '',
    locationLat: trackedDriverPos?.[0] || pickup?.lat,
    locationLng: trackedDriverPos?.[1] || pickup?.lon,
  }), [currentTripId, rideState, pickup, destination, currentUser, driverInfo, trackedDriverPos]);

  const handleCancel = async () => {
    if (currentTripId) {
      emitCancel(currentTripId);
      await cancelRide(currentTripId);
      navigate('/owner');
    }
  };

  const markers: any[] = [];
  if (pickup) markers.push({ id: 'pickup', position: [pickup.lat, pickup.lon], title: 'Pickup', icon: 'pickup' });
  if (destination) markers.push({ id: 'dest', position: [destination.lat, destination.lon], title: 'Destination', icon: 'destination' });
  if (driverInfo && (rideState === 'ASSIGNED' || rideState === 'IN_PROGRESS')) {
    markers.push({ 
      id: 'driver', 
      position: trackedDriverPos || (pickup ? [pickup.lat, pickup.lon] : [6.45, 3.42]), 
      title: driverInfo.name, 
      icon: 'taxi' 
    });
  }

  // If no active ride, go back to request screen
  useEffect(() => {
    if (rideState === 'IDLE') {
      navigate('/owner');
    }
  }, [rideState, navigate]);

  // Driver Awaiting Payment Lock
  useEffect(() => {
    if (rideState === 'COMPLETED' && currentUser?.role === 'DRIVER' && currentTripId) {
      navigate(`/driver/awaiting-payment/${currentTripId}`, { replace: true });
    }
  }, [rideState, currentUser?.role, currentTripId, navigate]);
  
  // Payment Polling on App Resume
  useEffect(() => {
    const handleResume = async () => {
      if (!currentTripId) return;
      
      // Check current payment status from store data
      const currentStatus = completedTripData?.paymentStatus || 'UNPAID';
      if (['PAID', 'REFUNDED'].includes(currentStatus)) return;
      
      if (isPollingRef.current) return;
      
      console.log('🔄 [PaymentPoll] App resumed, checking status for:', currentTripId);
      isPollingRef.current = true;
      setIsPolling(true);
      
      try {
        const data = await api.getPaymentStatus(currentTripId);
        if (data.paymentStatus === 'PAID') {
          addToast('Payment confirmed! Your ride is fully settled.', 'success');
          const current = useRideStore.getState().completedTripData;
          if (current) {
            setCompletedTripData({ ...current, paymentStatus: 'PAID' });
          }
        }
      } catch (error) {
        console.warn('[PaymentPoll] Background status check failed:', error);
      } finally {
        isPollingRef.current = false;
        setIsPolling(false);
      }
    };

    window.addEventListener('bica-app-resumed', handleResume);
    return () => window.removeEventListener('bica-app-resumed', handleResume);
  }, [currentTripId, completedTripData?.paymentStatus, setCompletedTripData, addToast]);

  // Handle FCM Push for OTP Regeneration
  useEffect(() => {
    const unsubscribe = notificationService.addListener((payload) => {
      if (normalizeNotificationType(payload.type) === 'otpregenerated' && payload.otp) {
        console.log('🔔 [FCM] OTP regenerated received:', payload.otp);
        setDriverInfo({
          ...driverInfo,
          otp: payload.otp
        });
      }
    });
    return () => { unsubscribe(); };
  }, [driverInfo, setDriverInfo]);

  return (
    <div className="h-screen w-full flex flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Dynamic Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-6 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => navigate('/owner')} 
          className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/20 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        
        <div className="flex flex-col items-center">
           <span className="text-xl font-black text-slate-900 dark:text-white drop-shadow-md">Ride <span className="text-primary">Status</span></span>
           <div className="px-3 py-1 bg-primary/20 backdrop-blur-md rounded-full border border-primary/30">
              <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">{rideMilestone}</p>
           </div>
        </div>

        <button 
          onClick={() => {
            addToast('Refreshing ride status...', 'info');
            syncCurrentRide();
          }} 
          className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/20 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">sync</span>
        </button>
      </div>

      {/* Map Header Area */}
      <div className="h-[40%] w-full relative shrink-0">
        <InteractiveMap
          center={trackedDriverPos || (pickup ? [pickup.lat, pickup.lon] : [6.45, 3.42])}
          zoom={15}
          markers={markers}
        />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent z-10"></div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative z-20 -mt-12 px-5 pb-10">
        {rideState === 'COMPLETED' ? (
           <TripPaymentSummary
             role="OWNER"
             pickup={pickup ? getLocationShortText(pickup) : (completedTripData?.pickupAddress || undefined)}
             destination={destination ? getLocationShortText(destination) : (completedTripData?.destAddress || undefined)}
             onClose={() => { resetRide(); navigate('/owner'); }}
             fareBreakdown={{
               billableDistanceKm: completedTripData?.fareBreakdown?.billableDistanceKm ?? completedTripData?.distanceKm ?? 0,
               estimatedDistanceKm: completedTripData?.fareBreakdown?.estimatedDistanceKm ?? completedTripData?.distanceKm ?? 0,
               distanceSource: completedTripData?.fareBreakdown?.distanceSource,
               actualMins: completedTripData?.fareBreakdown?.actualMins ?? completedTripData?.totalMins ?? 0,
               finalFare: completedTripData?.amount || completedTripData?.finalFare || 0,
               commissionPercent: completedTripData?.fareBreakdown?.commissionPercent,
             }}
             paymentStatus={completedTripData?.paymentStatus || 'UNPAID'}
             onPayNow={() => {
                const bannerStatus = (completedTripData?.paymentStatus === 'PAID' || completedTripData?.paymentStatus === 'SUCCESS') ? 'confirmed'
                  : completedTripData?.paymentStatus === 'FAILED' ? 'failed'
                  : completedTripData?.paymentStatus === 'CANCELLED' ? 'cancelled'
                  : 'unpaid';
                if (!isPolling && currentTripId) initiatePayment(currentTripId);
              }}
           />
        ) : rideState === 'SCHEDULED' ? (
          <ScheduledHoldingCard 
            scheduledAt={completedTripData?.scheduledAt}
            onCancel={handleCancel}
          />
        ) : (
          <DriverStatusCard
            rideState={rideState}
            driverInfo={driverInfo || { name: 'Searching', car: 'Please wait', plate: '---', rating: 5, trips: 0, avatar: IMAGES.DRIVER_CARD, timeAway: 0 }}
            rideMilestone={rideMilestone}
            lastMilestoneUpdate={new Date().toISOString()}
            onCall={() => window.open(`tel:${driverInfo?.phone}`, '_self')}
            onChat={() => {
              addToast('P2P Chat coming soon!', 'info');
            }}
            onSupport={() => {
              useUIStore.getState().setSupportContext({
                tripId: currentTripId ?? undefined,
                tripStatus: rideState as any,
                paymentStatus: completedTripData?.paymentStatus as any,
                openedAt: new Date().toISOString()
              });
              useUIStore.getState().setSupportOpen(true);
            }}
            onTrack={() => {
              addToast('Tracking driver location...', 'info');
            }}
            onSOS={() => setShowEmergencyHelp(true)}
            onCancel={handleCancel}
            trackedDriverPos={trackedDriverPos}
            pickup={pickup}
          />
        )}
      </div>

      {showEmergencyHelp && (
        <EmergencyHelpSheet
          context={emergencyContext}
          onClose={() => setShowEmergencyHelp(false)}
        />
      )}
    </div>
  );
};

export default TripStatusScreen;
