import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Stores & Hooks
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useRideStore } from '@/stores/rideStore';
import { useRideManager } from '@/hooks/useRideManager';
import { useOwnerLocationSearch } from '@/hooks/useOwnerLocationSearch';
import { useOwnerRealtime } from '@/hooks/useOwnerRealtime';
import { generateUUID } from '@/services/api.service';

// Components
import InteractiveMap from '@/components/InteractiveMap';
import RideStoryTimeline from '@/components/RequestRide/RideStoryTimeline';
import LocationSearchModal from '@/components/RequestRide/LocationSearchModal';
import DriverPickerModal from '@/components/RequestRide/DriverPickerModal';
import VehicleDetailsModal from '@/components/RequestRide/VehicleDetailsModal';
import TripPaymentSummary from '@/components/RequestRide/TripPaymentSummary';
import DriverStatusCard from '@/components/RequestRide/DriverStatusCard';

import { IMAGES } from '@/constants';
import { UserRole, Trip } from '@/types';
import { getLocationShortText } from '@/services/LocationService';
import { CapacitorService } from '@/services/CapacitorService';

const RequestRideScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { addToast } = useUIStore();
  const { 
    rideState, setRideState, rideMilestone, setRideMilestone,
    currentTripId, setCurrentTripId,
    driverInfo, setDriverInfo,
    trackedDriverPos, setTrackedDriverPos,
    availableDrivers, setAvailableDrivers,
    completedTripData, setCompletedTripData
  } = useRideStore();
  
  
  const { fetchAvailableDrivers, initiateRideRequest, cancelRide, resetRide, syncCurrentRide, getRoute, initiatePayment, getPaymentStatus } = useRideManager();

  // Reference-based tracking for the custom location search hook
  const trackedDriverIdRef = useRef<string | null>(null);
  const pickupRef = useRef<any>(null);
  const rideStateRef = useRef(rideState);
  const showDriverPickerRef = useRef(false);
  const refreshAvailableDriversRef = useRef<() => Promise<void>>(async () => {});

  const [bookingType, setBookingType] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  
  const [vehicleData, setVehicleData] = useState({
    make: currentUser?.carType || '',
    model: currentUser?.carModel || '',
    year: currentUser?.carYear || '',
    transmission: (currentUser?.transmission as string) || 'Automatic',
  });

  const {
    pickup, destination, mapCenter, estimatedPrice, estimatedDistance,
    isSearchingPickup, isSearchingDest, searchQuery, isFetchingRoute,
    searchResults, isSearching, isLocating, searchError, estimatedMins,
    currentTrafficMins,
    setSearchQuery, setIsSearchingPickup, setIsSearchingDest,
    handleUseMyLocation, handleMarkerDragEnd, handleSelectLocation,
    handleCategoryTap, clearSearchState, refreshRoute, resetLocationSearch
  } = useOwnerLocationSearch({
    onPickupChanged: () => {}
  });

  // Update route distance/ETA when points change
  useEffect(() => {
    if (pickup && destination && rideState === 'IDLE') {
      getRoute(pickup, destination);
    }
  }, [pickup, destination, rideState, getRoute]);

  const handlePayNow = async () => {
    if (!completedTripData?.id && !currentTripId) return;
    try {
      setIsInitiatingPayment(true);
      await initiatePayment(completedTripData?.id || currentTripId!);
    } catch (e) {
      setIsInitiatingPayment(false);
    }
  };

  // Auto-Sync on Mount to recover any active ride
  useEffect(() => {
    const initSync = async () => {
      // 🛡️ [SENIOR_FIX] Session Identity Validation
      // Check if the persisted ride context belongs to the current user
      const { lastUserId, resetRide: clearStaleRide } = useRideStore.getState();
      if (lastUserId && currentUser?.id && lastUserId !== currentUser.id) {
        console.warn(`🕵️ Session mismatch detected (${lastUserId} !== ${currentUser.id}). Isolating accounts...`);
        clearStaleRide();
        return; // Start fresh for the new user
      }

      try {
        await syncCurrentRide();
      } catch (e) {
        console.error('Initial ride sync failed:', e);
      }
    };
    initSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only sync on mount

  // Sync refs for the Realtime hook
  useEffect(() => {
    pickupRef.current = pickup;
    rideStateRef.current = rideState;
    showDriverPickerRef.current = showDriverPicker;
    refreshAvailableDriversRef.current = async () => {
      await fetchAvailableDrivers(pickup!, vehicleData.transmission);
    };
  }, [pickup, rideState, showDriverPicker, fetchAvailableDrivers, vehicleData.transmission]);

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
      setRideState('ASSIGNED');
      setRideMilestone('assigned');
    },
    onDriverDeclined: () => {
      addToast('The chauffeur declined the request. Feel free to search for another driver!', 'info');
      setRideState('IDLE');
      if (pickup) {
        fetchAvailableDrivers(pickup, vehicleData.transmission);
      }
    },
    onTripCompleted: (data) => {
      setCompletedTripData(data);
      setRideState('COMPLETED');
      setRideMilestone('completed');
    },
    onLocationUpdated: (lat, lng) => setTrackedDriverPos([lat, lng]),
    syncCurrentRide,
    onRideProgress: (payload) => {
       const m = payload.milestone?.toLowerCase();
       if (m === 'inprogress' || m === 'in_progress' || m === 'trip') setRideMilestone('in_progress');
       else if (m === 'arrived') setRideMilestone('arrived');
       else if (m === 'assigned') setRideMilestone('assigned');
       else if (m === 'completed') {
          setRideMilestone('completed');
          // Only sync if we haven't already transitioned to COMPLETED to avoid state flickering
          if (rideStateRef.current !== 'COMPLETED') {
            syncCurrentRide();
          }
       }

       // Update driver info with new security fields if they arrive via socket
       if (payload.otp || payload.acceptanceImageUrl) {
         const { driverInfo: currentInfo, setDriverInfo: updateInfo } = useRideStore.getState();
         updateInfo({
           ...(currentInfo || {}),
           otp: payload.otp || currentInfo?.otp,
           acceptanceImageUrl: payload.acceptanceImageUrl || currentInfo?.acceptanceImageUrl
         });
       }
    },
    onPaymentUpdated: (data) => {
      addToast(data.message || `Payment ${data.paymentStatus}`, data.paymentStatus === 'PAID' ? 'success' : 'info');
    }
  });

  // 🚀 [PREMIUM_UX] Dedicated Trip Status Redirect
  // If we have an active ride, move to the dedicated status screen for a better UX
  useEffect(() => {
    if (['SEARCHING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(rideState)) {
      navigate('/owner/status');
    }
  }, [rideState, navigate]);

  const handleCancelRide = async () => {
    if (currentTripId) {
      console.log(`[ACTION] Owner initiating cancellation for trip: ${currentTripId}`);
      // Send redundant socket signal for instant UI feedback across devices
      emitCancel(currentTripId);
      // Canonical cancellation via API
      await cancelRide(currentTripId);
    } else {
      resetRide();
    }
  };

  const handleConfirmRequest = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pickup) {
       addToast('Please select a pickup location.', 'warning');
       setIsSearchingPickup(true);
       return;
    }
    setShowVehicleForm(false);
    
    if (bookingType === 'schedule') {
      if (!scheduledAt) {
        addToast('Please select a time for your scheduled ride.', 'warning');
        return;
      }
      setShowDriverPicker(true);
      await fetchAvailableDrivers(pickup, vehicleData.transmission);
    } else {
      setShowDriverPicker(true);
      await fetchAvailableDrivers(pickup, vehicleData.transmission);
    }
  };

  const handleSelectDriver = async (driver: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    // The "Golden Rule": Generate a NEW key per unique action/intent
    const rideIntentId = generateUUID();

    try {
      if (!pickup || !destination) {
         addToast('Pickup or Destination is missing.', 'error');
         return;
      }
      await initiateRideRequest(
        pickup, 
        destination, 
        driver, 
        vehicleData, 
        bookingType === 'schedule' ? new Date(scheduledAt).toISOString() : null,
        rideIntentId
      );
      setShowDriverPicker(false);
    } catch (error: any) {
       // Handle 409 Conflict: Already being processed by backend
        if (error.status === 400) {
           addToast('Status mismatch. Refreshing...', 'info');
           await syncCurrentRide();
        } else if (error.status === 409) {
           addToast('Resolving previous request...', 'info');
           const syncedTrip = await syncCurrentRide();
           if (syncedTrip) {
              setShowDriverPicker(false);
              addToast('Request successfully recovered!', 'success');
           }
        }
    } finally {
      setIsSubmitting(false);
    }
  };

  const markers: any[] = [];
  if (pickup) markers.push({ id: 'pickup', position: [pickup.lat, pickup.lon], title: 'Pickup', icon: 'pickup', draggable: true });
  if (destination) markers.push({ id: 'dest', position: [destination.lat, destination.lon], title: 'Destination', icon: 'destination' });
  if (driverInfo && (rideState === 'ASSIGNED' || rideState === 'IN_PROGRESS')) {
    markers.push({ 
      id: 'driver', 
      position: trackedDriverPos || (pickup ? [pickup.lat, pickup.lon] : mapCenter), 
      title: driverInfo.name, 
      icon: 'taxi' 
    });
  }

  return (
    <div className="h-screen w-full flex flex-col relative bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Search Modals */}
      {isSearchingPickup && (
        <LocationSearchModal
          type="pickup"
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onClose={() => setIsSearchingPickup(false)}
          onUseMyLocation={handleUseMyLocation}
          isLocating={isLocating}
          onCategoryTap={handleCategoryTap}
          isSearching={isSearching}
          searchResults={searchResults}
          onSelectLocation={handleSelectLocation}
          searchError={searchError}
        />
      )}
      {isSearchingDest && (
        <LocationSearchModal
           type="dest"
           searchQuery={searchQuery}
           setSearchQuery={setSearchQuery}
           onClose={() => setIsSearchingDest(false)}
           onCategoryTap={handleCategoryTap}
           isSearching={isSearching}
           searchResults={searchResults}
           onSelectLocation={handleSelectLocation}
           searchError={searchError}
        />
      )}

      {showDriverPicker && (
        <DriverPickerModal
          onClose={() => !isSubmitting && setShowDriverPicker(false)}
          availableDrivers={availableDrivers}
          isLoading={isSubmitting}
          onSelectDriver={handleSelectDriver}
        />
      )}

      {showVehicleForm && (
        <VehicleDetailsModal
          onClose={() => setShowVehicleForm(false)}
          vehicleData={vehicleData}
          setVehicleData={setVehicleData}
          onSubmit={handleConfirmRequest}
        />
      )}

      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          center={mapCenter}
          zoom={14}
          markers={markers}
          onMarkerDragEnd={handleMarkerDragEnd}
        />
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/80 dark:via-background-dark/80 to-transparent pointer-events-none"></div>
      </div>

      <header className="relative z-10 px-4 py-8 flex items-center justify-between pointer-events-none">
        <div className="flex-1 pointer-events-auto">
           {/* Placeholder for left-side items if needed */}
        </div>

        <div className="flex flex-col items-center pointer-events-none">
           <span className="text-lg font-bold text-white tracking-tight italic drop-shadow-lg">BICA<span className="text-primary NOT-italic">DRIVE</span></span>
           <p className="text-[8px] font-black text-white/60 uppercase tracking-[0.3em] leading-none">Premium Owner Console</p>
        </div>

        <div className="flex-1 flex justify-end gap-3 pointer-events-auto">
          <button
            onClick={() => navigate('/owner/activity')}
            className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-xl"
          >
            <span className="material-symbols-outlined text-xl">receipt_long</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 overflow-hidden shadow-xl"
          >
            {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt="Profile" /> : <span className="material-symbols-outlined">person</span>}
          </button>
        </div>
      </header>

      <div className="flex-1"></div>

      <div className="relative z-20 px-4 pb-8">
        {rideState === 'IDLE' && (
           <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up">
               <div className="mb-4 flex items-center justify-between">
                 <h2 className="text-lg font-bold">Plan your ride</h2>
                 <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5">
                   <button 
                     onClick={() => setBookingType('now')}
                     className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${bookingType === 'now' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-black/5' : 'text-slate-500'}`}
                   >
                     Now
                   </button>
                   <button 
                     onClick={() => setBookingType('schedule')}
                     className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${bookingType === 'schedule' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-black/5' : 'text-slate-500'}`}
                   >
                     Schedule
                   </button>
                 </div>
               </div>
               
               <div className="flex flex-col gap-4">
                  <button onClick={() => setIsSearchingPickup(true)} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-left border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors">
                     <span className="material-symbols-outlined text-primary">my_location</span>
                     <div className="flex-1 min-w-0">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pickup</p>
                       <p className="text-sm font-black truncate">{pickup ? getLocationShortText(pickup) : 'Where to pick you up?'}</p>
                     </div>
                  </button>
                  <button onClick={() => setIsSearchingDest(true)} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-left border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors">
                     <span className="material-symbols-outlined text-accent">location_on</span>
                     <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destination</p>
                        <p className="text-sm font-black truncate">{destination ? getLocationShortText(destination) : 'Where are you going?'}</p>
                     </div>
                  </button>

                  {bookingType === 'schedule' && (
                    <div className="flex flex-col gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/20 animate-in fade-in slide-in-from-top-2">
                       <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                         <span className="material-symbols-outlined text-sm">calendar_month</span>
                         Scheduled Time
                       </p>
                       <input 
                         type="datetime-local" 
                         value={scheduledAt}
                         onChange={(e) => setScheduledAt(e.target.value)}
                         className="bg-transparent border-none text-sm font-black text-slate-900 dark:text-white focus:ring-0 w-full"
                         min={new Date().toISOString().slice(0, 16)}
                       />
                    </div>
                  )}
               </div>

                {pickup && destination && (
                 <div className="mt-6 p-4 bg-primary/5 rounded-2xl border border-primary/10 transition-all">
                    <div className="flex justify-between items-center">
                       <div className="flex-1">
                         <div className="flex items-center gap-2 mb-1">
                           <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Estimated Fare</p>
                           {isFetchingRoute && <div className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                         </div>
                         
                         {isFetchingRoute ? (
                           <div className="space-y-2">
                             <div className="h-8 w-32 bg-primary/20 animate-pulse rounded-lg" />
                             <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
                           </div>
                         ) : (
                           <>
                             <p className="text-2xl font-black">₦{estimatedPrice}</p>
                             <div className="flex items-center gap-2 mt-0.5">
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{estimatedDistance} km</p>
                               <span className="text-[10px] text-slate-300">•</span>
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                 {currentTrafficMins > estimatedMins ? `${currentTrafficMins} mins (Traffic)` : `${estimatedMins} mins`}
                               </p>
                             </div>
                           </>
                         )}
                       </div>
                       <button 
                         onClick={() => setShowVehicleForm(true)} 
                         disabled={isFetchingRoute}
                         className="bg-primary hover:bg-primary-dark disabled:opacity-50 transition-colors text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-primary/20"
                       >
                         {bookingType === 'schedule' ? 'Schedule' : 'Request Now'}
                       </button>
                    </div>
                 </div>
               )}
           </div>
        )}
      </div>
    </div>
  );
};

export default RequestRideScreen;
