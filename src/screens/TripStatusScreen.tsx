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
          setCompletedTripData((prev: any) => ({ ...prev, paymentStatus: 'PAID' }));
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

        <div className="w-12 h-12"></div> {/* Spacer */}
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
             pickup={pickup ? getLocationShortText(pickup) : undefined}
             destination={destination ? getLocationShortText(destination) : undefined}
             onClose={() => { resetRide(); navigate('/owner'); }}
             fareBreakdown={{
               distanceKm: completedTripData?.distanceKm || 0,
               actualMins: completedTripData?.totalMins || 0,
               finalFare: completedTripData?.amount || 0,
             }}
             paymentStatus={completedTripData?.paymentStatus || 'UNPAID'}
             onPayNow={() => currentTripId && initiatePayment(currentTripId)}
           />
        ) : (
          <DriverStatusCard
            rideState={rideState}
            driverInfo={driverInfo || { name: 'Searching', car: 'Please wait', plate: '---', rating: 5, trips: 0, avatar: IMAGES.DRIVER_CARD, timeAway: 0 }}
            rideMilestone={rideMilestone}
            lastMilestoneUpdate={new Date().toISOString()}
            onCall={() => window.open(`tel:${driverInfo?.phone}`, '_self')}
            onChat={() => {}}
            onTrack={() => {}}
            onSOS={() => {}}
            onCancel={handleCancel}
            trackedDriverPos={trackedDriverPos}
            pickup={pickup}
          />
        )}
        
        {/* Support Quick Link */}
        <div className="mt-6 p-5 bg-slate-100 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                 <span className="material-symbols-outlined text-primary text-xl">headset_mic</span>
              </div>
              <div>
                 <p className="text-sm font-bold text-slate-900 dark:text-white">Need help?</p>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Support available 24/7</p>
              </div>
           </div>
           <button className="text-primary text-xs font-black uppercase tracking-widest px-4 py-2 bg-primary/10 rounded-xl hover:bg-primary hover:text-white transition-all">Chat</button>
        </div>
      </div>
    </div>
  );
};

export default TripStatusScreen;
