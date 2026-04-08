import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Stores & Hooks
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useRideStore } from '@/stores/rideStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRideManager } from '@/hooks/useRideManager';
import { useOwnerLocationSearch } from '@/hooks/useOwnerLocationSearch';
import { useOwnerRealtime } from '@/hooks/useOwnerRealtime';

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
  const { settings } = useSettingsStore();
  const { 
    rideState, setRideState, rideMilestone, setRideMilestone,
    currentTripId, setCurrentTripId,
    driverInfo, setDriverInfo,
    trackedDriverPos, setTrackedDriverPos,
    availableDrivers, setAvailableDrivers 
  } = useRideStore();
  
  const { fetchAvailableDrivers, initiateRideRequest, resetRide } = useRideManager();

  // Reference-based tracking for the custom location search hook
  const trackedDriverIdRef = useRef<string | null>(null);
  const pickupRef = useRef<any>(null);
  const rideStateRef = useRef(rideState);
  const showDriverPickerRef = useRef(false);
  const refreshAvailableDriversRef = useRef<() => Promise<void>>(async () => {});

  const [bookingType, setBookingType] = useState<'now' | 'schedule'>('now');
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [vehicleData, setVehicleData] = useState({
    make: currentUser?.carType || '',
    model: currentUser?.carModel || '',
    year: currentUser?.carYear || '',
    transmission: (currentUser?.transmission as string) || 'Automatic',
  });

  const {
    pickup, destination, mapCenter, estimatedPrice, estimatedDistance,
    isSearchingPickup, isSearchingDest, searchQuery, isFetchingRoute,
    searchResults, isSearching, isLocating, searchError,
    setSearchQuery, setIsSearchingPickup, setIsSearchingDest,
    handleUseMyLocation, handleMarkerDragEnd, handleSelectLocation,
    handleCategoryTap, clearSearchState, refreshRoute, resetLocationSearch
  } = useOwnerLocationSearch({
    settings,
    onPickupChanged: () => {}
  });

  // Sync refs for the Realtime hook
  useEffect(() => {
    pickupRef.current = pickup;
    rideStateRef.current = rideState;
    showDriverPickerRef.current = showDriverPicker;
    refreshAvailableDriversRef.current = () => fetchAvailableDrivers(pickup!, vehicleData.transmission);
  }, [pickup, rideState, showDriverPicker, fetchAvailableDrivers, vehicleData.transmission]);

  useOwnerRealtime({
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
      addToast('Driver declined. Searching for others.', 'warning');
      setRideState('IDLE');
      fetchAvailableDrivers(pickup!, vehicleData.transmission);
    },
    onTripCompleted: () => {
      setRideState('COMPLETED');
      setRideMilestone('completed');
    },
    onLocationUpdated: (lat, lng) => setTrackedDriverPos([lat, lng]),
    onRideProgress: (payload) => {
       if (payload.milestone === 'inprogress') setRideMilestone('in_progress');
       else if (payload.milestone === 'arrived') setRideMilestone('arrived');
    },
    onPaymentUpdated: (data) => {
      addToast(data.message || `Payment ${data.paymentStatus}`, data.paymentStatus === 'PAID' ? 'success' : 'info');
    }
  });

  const handleConfirmRequest = async () => {
    setShowVehicleForm(false);
    if (bookingType === 'schedule') {
      addToast('Ride successfully scheduled!', 'success');
      setRideState('SCHEDULED');
    } else {
      setShowDriverPicker(true);
      await fetchAvailableDrivers(pickup!, vehicleData.transmission);
    }
  };

  const handleSelectDriver = async (driver: any) => {
    setShowDriverPicker(false);
    await initiateRideRequest(pickup!, destination!, driver, vehicleData);
  };

  const markers: any[] = [];
  if (pickup) markers.push({ id: 'pickup', position: [pickup.lat, pickup.lon], title: 'Pickup', icon: 'pickup', draggable: true });
  if (destination) markers.push({ id: 'dest', position: [destination.lat, destination.lon], title: 'Destination', icon: 'destination' });
  if (driverInfo && (rideState === 'ASSIGNED' || rideState === 'IN_PROGRESS')) {
    markers.push({ id: 'driver', position: trackedDriverPos || [pickup!.lat, pickup!.lon], title: driverInfo.name, icon: 'taxi' });
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
          isOpen={showDriverPicker}
          onClose={() => setShowDriverPicker(false)}
          drivers={availableDrivers}
          isLoading={false}
          onSelectDriver={handleSelectDriver}
        />
      )}

      {showVehicleForm && (
        <VehicleDetailsModal
          isOpen={showVehicleForm}
          onClose={() => setShowVehicleForm(false)}
          vehicleData={vehicleData}
          setVehicleData={setVehicleData}
          onConfirm={handleConfirmRequest}
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

      <header className="relative z-10 px-4 py-3 flex items-center justify-end">
        <button
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 overflow-hidden"
        >
          {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt="Profile" /> : <span className="material-symbols-outlined">person</span>}
        </button>
      </header>

      <div className="flex-1"></div>

      <div className="relative z-20 px-4 pb-8">
        {rideState === 'IDLE' && (
           <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Plan your ride</h2>
              </div>
              
              <div className="flex flex-col gap-4">
                 <button onClick={() => setIsSearchingPickup(true)} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-left">
                    <span className="material-symbols-outlined text-primary">my_location</span>
                    <span className="text-sm font-medium truncate">{pickup ? getLocationShortText(pickup) : 'Where to pick you up?'}</span>
                 </button>
                 <button onClick={() => setIsSearchingDest(true)} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-left">
                    <span className="material-symbols-outlined text-accent">location_on</span>
                    <span className="text-sm font-medium truncate">{destination ? getLocationShortText(destination) : 'Where are you going?'}</span>
                 </button>
              </div>

              {pickup && destination && (
                <div className="mt-6 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                   <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase">Estimated Fare</p>
                        <p className="text-2xl font-black">₦{estimatedPrice}</p>
                      </div>
                      <button onClick={() => setShowVehicleForm(true)} className="bg-primary text-white px-6 py-3 rounded-xl font-bold">Request Now</button>
                   </div>
                </div>
              )}
           </div>
        )}

        {(rideState === 'ASSIGNED' || rideState === 'IN_PROGRESS' || rideState === 'SEARCHING') && (
           <DriverStatusCard
             rideState={rideState}
             driverInfo={driverInfo}
             rideMilestone={rideMilestone}
             onCancel={() => resetRide()}
           />
        )}

        {rideState === 'COMPLETED' && (
          <TripPaymentSummary
            onClose={() => resetRide()}
            fareBreakdown={null}
            paymentStatus="UNPAID"
            paymentMessage=""
            onPayNow={() => {}}
            isInitiatingPayment={false}
          />
        )}
      </div>
    </div>
  );
};

export default RequestRideScreen;
