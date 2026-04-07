
import React, { useState, useEffect, useRef } from 'react';
import { CapacitorService } from '../services/CapacitorService';
import InteractiveMap from '../components/InteractiveMap';
import { IMAGES } from '../constants';
import {
  OwnerActivityTab,
  SystemSettings,
  Trip,
  UserProfile,
  UserRole,
  PaymentStatus,
  PaymentStatusResponse,
} from '../types';
import {
  LocationData,
  getLocationAddress,
  getLocationPrimaryText,
  getLocationSecondaryText,
  getLocationShortText,
} from '../services/LocationService';
import { api } from '@/services/api.service';
import { useOwnerRealtime } from '../hooks/useOwnerRealtime';
import { useOwnerLocationSearch } from '../hooks/useOwnerLocationSearch';
import { DISCOVERY_CATEGORIES } from '../constants';
import { useToast } from '../hooks/useToast';

// Refactored Components
import RideStoryTimeline from '../components/RequestRide/RideStoryTimeline';
import CountUpTimer from '../components/RequestRide/CountUpTimer';
import LocationSearchModal from '../components/RequestRide/LocationSearchModal';
import DriverPickerModal from '../components/RequestRide/DriverPickerModal';
import VehicleDetailsModal from '../components/RequestRide/VehicleDetailsModal';
import TripPaymentSummary from '../components/RequestRide/TripPaymentSummary';
import DriverStatusCard from '../components/RequestRide/DriverStatusCard';


interface RequestRideScreenProps {
  onOpenProfile: () => void;
  onOpenActivity: (tab: OwnerActivityTab) => void;
  settings: SystemSettings;
  onRideComplete: (trip: Trip) => void;
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
}

type RideState = 'IDLE' | 'SEARCHING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SCHEDULED';


// RideStoryTimeline extracted


// DISCOVERY_CATEGORIES moved to constants.tsx



// ... existing interfaces ...

const RequestRideScreen: React.FC<RequestRideScreenProps> = ({
  onOpenProfile,
  onOpenActivity,
  settings,
  onRideComplete,
  currentUser,
  allUsers
}) => {
  const { toast } = useToast();
  const [rideState, setRideState] = useState<RideState>('IDLE');
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  // Booking Type State
  const [bookingType, setBookingType] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const pickupRef = useRef<LocationData | null>(null);
  const rideStateRef = useRef<RideState>('IDLE');
  const showDriverPickerRef = useRef(false);
  const transmissionRef = useRef('Automatic');
  const trackedDriverIdRef = useRef<string | null>(null);
  const refreshAvailableDriversRef = useRef<() => Promise<void>>(async () => {});


  const [currentTripFareBreakdown, setCurrentTripFareBreakdown] = useState<any>(null);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState<PaymentStatus | null>(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('');

  // Vehicle Details State
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleData, setVehicleData] = useState({
    make: currentUser?.carType || '',
    model: currentUser?.carModel || '',
    year: currentUser?.carYear || '',
    transmission: (currentUser?.transmission as string) || 'Automatic',
  });

  useEffect(() => {
    if (currentUser) {
      setVehicleData(prev => ({
        make: prev.make || currentUser.carType || '',
        model: prev.model || currentUser.carModel || '',
        year: prev.year || currentUser.carYear || '',
        transmission: prev.transmission || (currentUser.transmission as string) || 'Automatic',
      }));
    }
  }, [currentUser]);
  // Simulation State
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [trackedDriverPos, setTrackedDriverPos] = useState<[number, number] | null>(null);
  const [noDriversFound, setNoDriversFound] = useState(false);

  // OWNER RIDE STORY STATE
  const [rideMilestone, setRideMilestone] = useState<'requested' | 'assigned' | 'arrived' | 'in_progress' | 'completed'>('requested');
  const [lastMilestoneUpdate, setLastMilestoneUpdate] = useState<string>(new Date().toISOString());

  const timerRefs = useRef<any[]>([]);
  const {
    pickup,
    destination,
    mapCenter,
    estimatedPrice,
    estimatedDistance,
    isSearchingPickup,
    isSearchingDest,
    searchQuery,
    isFetchingRoute,
    estimatedMins,
    fareRange,
    searchResults,
    isSearching,
    isLocating,
    searchError,
    clearSearchState,
    setIsSearchingPickup,
    setIsSearchingDest,
    setSearchQuery,
    handleUseMyLocation,
    handleMarkerDragEnd,
    handleSelectLocation,
    handleCategoryTap,
    restoreLocations,
    refreshRoute,
    resetLocationSearch,
  } = useOwnerLocationSearch({
    settings,
    onPickupChanged: () => setNoDriversFound(false),
  });

  // CountUpTimer extracted

  const buildLocationFromTrip = (
    id: string,
    address: string,
    lat?: number | null,
    lng?: number | null,
  ): LocationData | null => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return {
      id,
      display_name: address || 'Unknown Location',
      description: address || 'Unknown Location',
      formatted_address: address || 'Unknown Location',
      lat,
      lon: lng,
      category: 'Residential',
    };
  };

  const buildDriverInfoFromTrip = (trip: any) => {
    if (!trip?.driver) return null;
    return {
      id: trip.driver.id,
      name: trip.driver.name,
      car: 'Professional Driver',
      plate: `ID-${trip.driver.id?.substr(0, 4).toUpperCase()}`,
      rating: trip.driver.rating,
      avatar: trip.driver.avatarUrl || IMAGES.DRIVER_CARD,
      timeAway: trip.estimatedArrivalMins || 5,
      tripId: trip.id,
    };
  };

  const loadPaymentStatus = async (tripId: string) => {
    try {
      const payment = await api.get<PaymentStatusResponse>(`/payments/status/${tripId}`);
      setCurrentPaymentStatus(payment.paymentStatus);
      setPaymentStatusMessage(
        payment.paymentStatus === 'PAID'
          ? 'Payment confirmed.'
          : payment.paymentStatus === 'FAILED'
            ? 'Payment failed. Please try again.'
            : payment.paymentStatus === 'PENDING'
              ? 'Payment is being verified by the backend.'
              : 'Please complete payment below.',
      );
      return payment;
    } catch (error) {
      console.error('Failed to load payment status:', error);
      return null;
    }
  };

  const applyRecoveredRide = (trip: any) => {
    const restoredPickup = buildLocationFromTrip(
      `pickup_${trip.id}`,
      trip.pickupAddress,
      trip.pickupLat,
      trip.pickupLng,
    );
    const restoredDestination = buildLocationFromTrip(
      `dest_${trip.id}`,
      trip.destAddress,
      trip.destLat,
      trip.destLng,
    );

    restoreLocations(restoredPickup, restoredDestination);
    setCurrentTripId(trip.id);
    setCurrentTripFareBreakdown(trip.fareBreakdown || null);
    setCurrentPaymentStatus(trip.paymentStatus ?? null);
    setPaymentStatusMessage('');

    const restoredDriverInfo = buildDriverInfoFromTrip(trip);
    setDriverInfo(restoredDriverInfo);

    if (trip.driver?.id) {
      trackedDriverIdRef.current = trip.driver.id;
    }

    if (typeof trip.driver?.locationLat === 'number' && typeof trip.driver?.locationLng === 'number') {
      setTrackedDriverPos([trip.driver.locationLat, trip.driver.locationLng]);
    } else {
      setTrackedDriverPos(null);
    }

    switch (trip.status) {
      case 'PENDING_ACCEPTANCE':
        setRideState('SEARCHING');
        setRideMilestone('requested');
        setLastMilestoneUpdate(trip.updatedAt || new Date().toISOString());
        break;
      case 'ASSIGNED':
        setRideState('ASSIGNED');
        setRideMilestone('assigned');
        setLastMilestoneUpdate(trip.updatedAt || new Date().toISOString());
        break;
      case 'ARRIVED':
        setRideState('ASSIGNED');
        setRideMilestone('arrived');
        setLastMilestoneUpdate(trip.updatedAt || new Date().toISOString());
        break;
      case 'IN_PROGRESS':
        setRideState('IN_PROGRESS');
        setRideMilestone('in_progress');
        setLastMilestoneUpdate(trip.updatedAt || new Date().toISOString());
        break;
      case 'COMPLETED':
        setRideState('COMPLETED');
        setRideMilestone('completed');
        setLastMilestoneUpdate(trip.completedAt || trip.updatedAt || new Date().toISOString());
        break;
      default:
        setRideState('IDLE');
        setRideMilestone('requested');
        setLastMilestoneUpdate(new Date().toISOString());
        break;
    }
  };

  const handlePayNow = async () => {
    if (!currentTripId) return;
    setIsInitiatingPayment(true);
    try {
      const payment = await api.post<any>(`/payments/initiate/${currentTripId}`);
      setPaymentStatusMessage('Checkout opened. Payment is only confirmed after backend verification.');
      if (payment.checkoutUrl) {
        window.open(payment.checkoutUrl, '_blank');
      }
    } catch (error: any) {
      toast.error(error.message || 'Payment initiation failed. Please try again.');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  const fetchAvailableDrivers = async () => {
    const activePickup = pickupRef.current;
    if (!activePickup) return;
    setIsLoadingDrivers(true);
    try {
      // Pass the owner's chosen transmission so backend only returns
      // compatible drivers (Automatic owners see Automatic + Any drivers;
      // Manual owners see only Manual drivers)
      const transmissionParam = transmissionRef.current
        ? `&transmission=${encodeURIComponent(transmissionRef.current)}`
        : '';
      const drivers = await api.get<any[]>(
        `/users/drivers/available?pickupLat=${activePickup.lat}&pickupLng=${activePickup.lon}${transmissionParam}`,
      );
      setAvailableDrivers(drivers);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
      setAvailableDrivers([]);
    } finally {
      setIsLoadingDrivers(false);
    }
  };

  pickupRef.current = pickup;
  rideStateRef.current = rideState;
  showDriverPickerRef.current = showDriverPicker;
  transmissionRef.current = vehicleData.transmission;
  refreshAvailableDriversRef.current = fetchAvailableDrivers;

  useEffect(() => {
    if (!pickup) {
      setAvailableDrivers([]);
      return;
    }

    if (rideState !== 'IDLE') return;

    const timer = setTimeout(() => {
      fetchAvailableDrivers().catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [pickup?.lat, pickup?.lon, vehicleData.transmission, rideState]);

  useEffect(() => {
    setScheduleDate(new Date().toISOString().split('T')[0]);
    return () => clearTimers();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    let isMounted = true;

    const bootstrapOwnerState = async () => {
      try {
        const currentRide = await api.get<any | null>('/rides/current');
        if (!isMounted || !currentRide) return;

        applyRecoveredRide(currentRide);

        if (currentRide.status === 'COMPLETED') {
          await loadPaymentStatus(currentRide.id);
        }
      } catch (error) {
        console.error('Failed to restore owner ride context:', error);
      }
    };

    bootstrapOwnerState();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

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
      setDriverInfo((prev: any) => ({
        ...prev,
        ...driver,
        timeAway: estimatedArrivalMins || 5,
      }));
      setRideState('ASSIGNED');
      setRideMilestone('assigned');
      setLastMilestoneUpdate(new Date().toISOString());
    },
    onDriverDeclined: (data) => {
      toast.error(data.message || 'Driver declined. Please choose another driver.');
      setSelectedDriver(null);
      setDriverInfo(null);
      trackedDriverIdRef.current = null;
      setTrackedDriverPos(null);
      fetchAvailableDrivers();
      setShowDriverPicker(true);
      setRideState('IDLE');
    },
    onTripCompleted: (data) => {
      if (data.fareBreakdown) {
        setCurrentTripFareBreakdown(data.fareBreakdown);
      }
      setCurrentPaymentStatus('UNPAID');
      setPaymentStatusMessage('Please complete payment below.');
      setRideState('COMPLETED');
      setRideMilestone('completed');
      setLastMilestoneUpdate(new Date().toISOString());
    },
    onPaymentUpdated: (data) => {
      if (data.tripId !== currentTripId) return;
      setCurrentPaymentStatus(data.paymentStatus as PaymentStatus);
      setPaymentStatusMessage(data.message || '');
    },
    onLocationUpdated: (lat, lng) => {
      setTrackedDriverPos([lat, lng]);
    },
    onRideProgress: (payload) => {
      // Map backend milestones to owner-facing steps
      if (payload.milestone === 'assigned') {
        setRideMilestone('assigned');
        setRideState('ASSIGNED');
      } else if (payload.milestone === 'arrived') {
        setRideMilestone('arrived');
        setRideState('ASSIGNED');
      } else if (payload.milestone === 'inprogress') {
        setRideMilestone('in_progress');
        setRideState('IN_PROGRESS');
      } else if (payload.milestone === 'completed') {
        setRideMilestone('completed');
        setRideState('COMPLETED');
      }

      if (payload.timestamp) {
        setLastMilestoneUpdate(payload.timestamp);
      } else {
        setLastMilestoneUpdate(new Date().toISOString());
      }
    },
  });

  const clearTimers = () => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  };



  const handleConfirmRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleData.make || !vehicleData.model || !vehicleData.year) {
      toast.warning('Please fill in all vehicle details to proceed.');
      return;
    }
    setShowVehicleForm(false);

    if (bookingType === 'schedule') {
      finalizeScheduledRide();
    } else {
      // Fetch drivers filtered by transmission, then show picker
      await fetchAvailableDrivers();
      setShowDriverPicker(true);
    }
  };

  const finalizeScheduledRide = () => {
    const formattedDate = `${scheduleDate} ${scheduleTime}`;
    // Add to Global History as PENDING
    onRideComplete({
      id: `t_${Math.random().toString(36).substr(2, 6)}`,
      ownerId: currentUser?.id,
      ownerName: currentUser?.name || 'Me',
      driverName: 'Pending Assignment',
      location: `${getLocationShortText(pickup)} -> ${getLocationShortText(destination)}`,
      status: 'PENDING',
      date: formattedDate,
      amount: estimatedPrice
    });
    setRideState('SCHEDULED');
  };

  const startRideRequest = async (driver?: any) => {
    // Use passed driver or fall back to selectedDriver state
    const bookedDriver = driver || selectedDriver;

    if (!pickup || !destination || !bookedDriver) {
      toast.error('Missing trip details. Please try again.');
      setRideState('IDLE');
      return;
    }

    setRideState('SEARCHING');
    setRideMilestone('requested');
    setLastMilestoneUpdate(new Date().toISOString());
    setNoDriversFound(false);
    setCurrentPaymentStatus(null);
    setPaymentStatusMessage('');

    try {
      const trip = await api.post<any>('/rides', {
        pickupAddress: getLocationAddress(pickup),
        pickupLat: pickup.lat,
        pickupLng: pickup.lon,
        destAddress: getLocationAddress(destination),
        destLat: destination.lat,
        destLng: destination.lon,
        distanceKm: parseFloat(estimatedDistance),
        estimatedMins: estimatedMins || undefined,
        driverId: bookedDriver.id,



        transmission: vehicleData.transmission,
      });
      setCurrentTripId(trip.id);
      setDriverInfo({
        id: trip.driverId,
        name: trip.driver?.name,
        car: 'Professional Driver',
        plate: `ID-${trip.driverId?.substr(0, 4).toUpperCase()}`,
        rating: trip.driver?.rating,
        trips: trip.driver?.totalTrips ?? 0,
        avatar: trip.driver?.avatarUrl || IMAGES.DRIVER_CARD,
        timeAway: bookedDriver.estimatedArrivalMins || 5,
        tripId: trip.id,
      });
      setRideState('SEARCHING');
    } catch (error: any) {
      toast.error(error.message || 'Could not book ride. Please try again.');
      setRideState('IDLE');
      setNoDriversFound(true);
    }
  };

  const handleArrivedAtDestination = async () => {
    if (!currentTripId) return;

    try {
      // Fetch the completed trip to get fare breakdown
      const trip = await api.get<any>(`/rides/${currentTripId}`);
      if (trip.fareBreakdown) {
        setCurrentTripFareBreakdown(trip.fareBreakdown);
      } else {
        // Build a simple breakdown from trip data if fareBreakdown not cached
        const fallbackActualMins = trip.estimatedMins ?? 0;
        const fallbackBaseFare = settings.baseFare;
        const fallbackDistanceComponent = Math.max((trip.distanceKm ?? 0) * 100, 0);
        const fallbackTimeComponent = Math.max(fallbackActualMins * 50, 0);
        setCurrentTripFareBreakdown({
          finalFare: trip.amount,
          distanceKm: trip.distanceKm,
          baseFare: fallbackBaseFare,
          distanceComponent: fallbackDistanceComponent,
          timeComponent: fallbackTimeComponent,
          totalMins: fallbackActualMins,
          actualMins: fallbackActualMins,
          estimatedMins: trip.estimatedMins ?? 0,
          driverEarnings: trip.driverEarnings,
          commissionAmount: trip.commissionAmount,
        });
      }
    } catch (error) {
      console.error('Could not fetch trip breakdown:', error);
    }

    setRideState('COMPLETED');
  };

  const resetRide = () => {
    clearTimers();
    setRideState('IDLE');
    setCurrentTripId(null);
    resetLocationSearch();
    setDriverInfo(null);
    setTrackedDriverPos(null);
    trackedDriverIdRef.current = null;
    setCurrentTripFareBreakdown(null);
    setCurrentPaymentStatus(null);
    setPaymentStatusMessage('');
    setNoDriversFound(false);
    setBookingType('now');
  };

  const copyToClipboard = async (text: string, label: string) => {
    await CapacitorService.triggerHaptic();
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleInitiateRequest = () => {
    CapacitorService.triggerHaptic();
    if (bookingType === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        toast.warning('Please select both date and time for your scheduled ride.');
        return;
      }
    }
    // Show vehicle form FIRST — vehicle details needed to filter drivers
    setShowVehicleForm(true);
  };


  const handleSelectDriver = async (driver: any) => {
    setSelectedDriver(driver);
    trackedDriverIdRef.current = driver.id;
    if (typeof driver.locationLat === 'number' && typeof driver.locationLng === 'number') {
      setTrackedDriverPos([driver.locationLat, driver.locationLng]);
    } else {
      setTrackedDriverPos(null);
    }
    setShowDriverPicker(false);
    // Pass driver directly — don't rely on selectedDriver state which is async
    await startRideRequest(driver);
  };


  const openGoogleMaps = () => {
    if (destination) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lon}`;
      window.open(url, '_blank');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(val).replace('NGN', '₦');
  };




  // renderSearchModal logic moved to LocationSearchModal component

  const markers: any[] = [];
  if (pickup) markers.push({ id: 'pickup', position: [pickup.lat, pickup.lon], title: 'Pickup', icon: 'pickup', draggable: true });
  if (destination) markers.push({ id: 'dest', position: [destination.lat, destination.lon], title: 'Destination', icon: 'destination' });

  // Show assigned driver
  if (driverInfo && (rideState === 'ASSIGNED' || rideState === 'IN_PROGRESS')) {
    markers.push({
      id: 'driver',
      position: trackedDriverPos || [pickup!.lat + 0.002, pickup!.lon + 0.002],
      title: driverInfo.name,
      icon: 'taxi'
    });
  }

  // Show available drivers when idle
  if (rideState === 'IDLE' && allUsers.length > 0) {
    allUsers.forEach(u => {
      if (u.role === UserRole.DRIVER && u.approvalStatus === 'APPROVED' && u.currentLocation && u.id !== currentUser?.id) {
        markers.push({
          id: `available-${u.id}`,
          position: [u.currentLocation.lat, u.currentLocation.lng],
          title: u.name,
          icon: 'taxi'
        });
      }
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

      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          center={mapCenter}
          zoom={14}
          markers={markers}
          onMarkerDragEnd={handleMarkerDragEnd}
        />
        {/* Gradients for UI visibility */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/80 dark:via-background-dark/80 to-transparent pointer-events-none"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 py-3 flex items-center justify-end">
        <button
          onClick={onOpenProfile}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors overflow-hidden border border-white/20"
        >
          {currentUser?.avatar ? (
            <img src={currentUser.avatar} className="w-full h-full object-cover" alt="Profile" />
          ) : (
            <span className="material-symbols-outlined">person</span>
          )}
        </button>
      </header>

      {rideState === 'IDLE' && (
        <div className="relative z-10 px-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onOpenActivity('trips')}
              className="group relative overflow-hidden rounded-[1.75rem] border border-emerald-300/25 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500 p-4 text-left text-white shadow-xl shadow-emerald-900/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-emerald-900/25"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_38%)] opacity-90" />
              <div className="relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/18 ring-1 ring-white/20">
                <span className="material-symbols-outlined">route</span>
              </div>
              <p className="relative text-sm font-black">Trips</p>
              <p className="relative mt-1 text-xs text-white/80">View your recent and scheduled rides</p>
            </button>
            <button
              onClick={() => onOpenActivity('payments')}
              className="group relative overflow-hidden rounded-[1.75rem] border border-amber-300/25 bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 p-4 text-left text-white shadow-xl shadow-orange-900/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-orange-900/25"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_38%)] opacity-90" />
              <div className="relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/18 ring-1 ring-white/20">
                <span className="material-symbols-outlined">payments</span>
              </div>
              <p className="relative text-sm font-black">Payments</p>
              <p className="relative mt-1 text-xs text-white/80">Check completed fare payments and records</p>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1"></div>

      {/* Bottom Sheet UI */}
      <div className="relative z-20 px-4 pb-8 max-h-[72vh] overflow-y-auto no-scrollbar">
        {rideState === 'IDLE' && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Plan your ride</h2>
              <button
                onClick={() => refreshRoute().catch((error) => {
                  console.error('Failed to refresh route:', error);
                })}
                disabled={!pickup || !destination || isFetchingRoute}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 text-xs font-black uppercase tracking-wide text-primary transition-colors hover:bg-primary/12 disabled:cursor-not-allowed disabled:opacity-50"
                title="Refresh route"
              >
                <span className={`material-symbols-outlined text-base ${isFetchingRoute ? 'animate-spin' : ''}`}>refresh</span>
                Refresh
              </button>
            </div>

            {/* Booking Type Toggle */}
            <div className="flex bg-slate-100 dark:bg-black/30 p-1 rounded-xl mb-6">
              <button
                onClick={() => { CapacitorService.triggerHaptic(); setBookingType('now'); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${bookingType === 'now'
                  ? 'bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                Ride Now
              </button>
              <button
                onClick={() => { CapacitorService.triggerHaptic(); setBookingType('schedule'); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${bookingType === 'schedule'
                  ? 'bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                Schedule
                <span className="material-symbols-outlined text-sm">calendar_clock</span>
              </button>
            </div>

            <div className="flex flex-col gap-4 relative">
              {/* Connecting Line */}
              <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700 z-0"></div>

              {/* Pickup Input */}
              <button
                onClick={() => {
                  clearSearchState();
                  setIsSearchingPickup(true);
                }}
                className="flex items-center gap-4 relative z-10"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-primary text-xl">trip_origin</span>
                </div>
                <div className="flex-1 h-14 bg-slate-50 dark:bg-black/20 rounded-xl flex items-center px-4 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                  <p className={`text-sm font-medium truncate ${pickup ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    {pickup ? getLocationPrimaryText(pickup) : "Current Location"}
                  </p>
                </div>
              </button>

              {/* Destination Input */}
              <button
                onClick={() => {
                  clearSearchState();
                  setIsSearchingDest(true);
                }}
                className="flex items-center gap-4 relative z-10"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-slate-900 dark:text-white text-xl">location_on</span>
                </div>
                <div className="flex-1 h-14 bg-slate-50 dark:bg-black/20 rounded-xl flex items-center px-4 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                  <p className={`text-sm font-medium truncate ${destination ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    {destination ? getLocationPrimaryText(destination) : "Enter Destination"}
                  </p>
                </div>
              </button>
            </div>

            {pickup && destination && (
              <div className="mt-6 animate-fade-in">
                {bookingType === 'schedule' && (
                  <div className="grid grid-cols-2 gap-3 mb-4 animate-slide-up">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Date</label>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl h-12 px-3 font-bold text-slate-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl h-12 px-3 font-bold text-slate-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4 bg-primary/5 p-4 rounded-2xl border border-primary/10 min-h-[80px]">
                  {isFetchingRoute ? (
                    // Loading state — pulsing skeleton
                    <div className="w-full flex items-center justify-between animate-pulse">
                      <div className="flex flex-col gap-2">
                        <div className="h-3 w-24 bg-slate-300 dark:bg-slate-700 rounded"></div>
                        <div className="h-7 w-40 bg-slate-300 dark:bg-slate-700 rounded"></div>
                        <div className="h-2 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className="h-3 w-16 bg-slate-300 dark:bg-slate-700 rounded"></div>
                        <div className="h-5 w-20 bg-slate-300 dark:bg-slate-700 rounded"></div>
                        <div className="h-2 w-14 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      </div>
                    </div>
                  ) : (
                    // Loaded state — real data
                    <>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Fare</p>
                        {fareRange ? (
                          <p className="text-2xl font-black text-slate-900 dark:text-white">
                            {formatCurrency(fareRange.low)}
                            <span className="text-base font-bold text-slate-400"> – {formatCurrency(fareRange.high)}</span>
                          </p>
                        ) : (
                          <p className="text-2xl font-black text-slate-900 dark:text-white">
                            {formatCurrency(estimatedPrice)}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">Estimate uses route time. Final fare uses actual trip duration.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distance</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{estimatedDistance} km</p>
                        {estimatedMins > 0 && (
                          <p className="text-xs text-slate-400">~{estimatedMins} mins</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={handleInitiateRequest}
                  disabled={isFetchingRoute}
                  className="w-full h-14 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFetchingRoute ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                      Calculating fare...
                    </>
                  ) : (
                    <>
                      {bookingType === 'schedule' ? 'Schedule Ride' : 'Request Driver'}
                      <span className="material-symbols-outlined">
                        {bookingType === 'schedule' ? 'event_available' : 'arrow_forward'}
                      </span>
                    </>
                  )}
                </button>
                {noDriversFound && (
                  <div className="mt-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-fade-in">
                    <span className="material-symbols-outlined text-red-500 shrink-0">person_off</span>
                    <div>
                      <p className="text-red-500 font-bold text-sm">No Drivers Available</p>
                      <p className="text-red-400 text-xs mt-0.5">
                        All drivers are busy or offline. Try again in a few minutes.
                      </p>
                    </div>
                    <button
                      onClick={() => setNoDriversFound(false)}
                      className="ml-auto text-red-400 hover:text-red-600"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {rideState === 'SEARCHING' && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up">
            <RideStoryTimeline milestone={rideMilestone} lastUpdate={lastMilestoneUpdate} />
            <div className="text-center py-4">
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4 relative font-bold">
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                {driverInfo?.avatar ? (
                  <img
                    src={driverInfo.avatar}
                    className="w-12 h-12 rounded-full object-cover"
                    alt=""
                  />
                ) : (
                  <span className="material-symbols-outlined text-primary text-3xl">person</span>
                )}
              </div>
              <h3 className="text-xl font-bold mb-1">
                Waiting for {driverInfo?.name ?? 'Driver'}
              </h3>
              <p className="text-slate-500 text-sm">
                Request sent — waiting for driver to accept
              </p>

              {/* Count-up timer — no auto-cancel */}
              <CountUpTimer />

              <button
                onClick={resetRide}
                className="mt-6 text-slate-400 font-bold text-sm hover:text-slate-600"
              >
                Cancel Request
              </button>
            </div>
          </div>
        )}

        {rideState === 'SCHEDULED' && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-scale-in">
            <div className="w-20 h-20 mx-auto bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined text-white text-4xl filled">event_available</span>
            </div>
            <h3 className="text-2xl font-black mb-2">Ride Scheduled!</h3>
            <p className="text-slate-500 mb-6 max-w-xs mx-auto">
              We've received your request. A driver will be assigned closer to your pickup time.
            </p>

            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3 mb-3">
                <span className="text-sm font-medium text-slate-500">Date</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{new Date(scheduleDate).toDateString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Time</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{scheduleTime}</span>
              </div>
            </div>

            <button
              onClick={resetRide}
              className="w-full h-14 bg-surface-light dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm active:scale-[0.98] transition-all"
            >
              Done
            </button>
          </div>
        )}

        {(rideState === 'ASSIGNED' || rideState === 'IN_PROGRESS') && driverInfo && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up">
            
            <RideStoryTimeline milestone={rideMilestone} lastUpdate={lastMilestoneUpdate} />
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {rideMilestone === 'assigned' ? 'Your driver is on the way to your pickup' : rideMilestone === 'arrived' ? 'Your driver has arrived  head to your pickup point' : rideMilestone === 'in_progress' ? 'Trip in progress' : rideMilestone === 'completed' ? 'Trip completed  please complete your payment' : 'Waiting for a driver to accept your request'}
                </span>
              </div>
              <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">
                {rideMilestone === 'assigned' ? driverInfo.timeAway + ' mins away' : rideMilestone === 'arrived' ? 'At pickup location' : rideMilestone === 'in_progress' ? 'Heading to Destination' : rideMilestone === 'completed' ? 'Arrived at destination' : ''}
              </span>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <img src={driverInfo.avatar} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary/20" alt="Driver" />
              <div className="flex-1">
                <h3 className="text-lg font-bold leading-tight">{driverInfo.name}</h3>
                <p className="text-sm text-slate-500">{driverInfo.car} • {driverInfo.plate}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-yellow-500 text-sm filled">star</span>
                  <span className="text-xs font-bold">{driverInfo.rating}</span>
                  <span className="text-xs text-slate-400">({driverInfo.trips} trips)</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                  <span className="material-symbols-outlined">call</span>
                </button>
                <button className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 transition-colors">
                  <span className="material-symbols-outlined">chat</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={openGoogleMaps}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">map</span>
                Track
              </button>
              <button className="flex-1 py-3 rounded-xl bg-red-500/10 font-bold text-red-500 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-lg">shield</span>
                SOS
              </button>
            </div>

            {rideState === 'ASSIGNED' && (
              <button
                onClick={resetRide}
                className="mt-4 w-full py-3 rounded-xl border border-red-500/20 text-red-500 font-bold text-sm hover:bg-red-500/5 transition-colors active:scale-95"
              >
                Cancel Ride
              </button>
            )}

          </div>
        )}
        {rideState === 'COMPLETED' && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-in flex flex-col gap-4">

            {/* Header */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-3 shadow-lg shadow-green-500/30">
                <span className="material-symbols-outlined text-white text-3xl filled">check</span>
              </div>
              <h3 className="text-xl font-black">Trip Completed!</h3>
              <p className="text-slate-500 text-sm mt-1">
                {currentPaymentStatus === 'PAID'
                  ? 'Payment confirmed.'
                  : currentPaymentStatus === 'PENDING'
                    ? 'Payment verification is in progress.'
                    : currentPaymentStatus === 'FAILED'
                      ? 'Payment failed. Please retry below.'
                      : 'Please complete payment below'}
              </p>
            </div>

            {paymentStatusMessage && (
              <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                currentPaymentStatus === 'PAID'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : currentPaymentStatus === 'FAILED'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-slate-100 dark:bg-black/20 text-slate-600 dark:text-slate-300'
              }`}>
                {paymentStatusMessage}
              </div>
            )}

            {currentTripFareBreakdown && (
              <TripPaymentSummary fareBreakdown={currentTripFareBreakdown} />
            )}

            {/* Pay button */}
            <button
              onClick={handlePayNow}
              disabled={isInitiatingPayment || currentPaymentStatus === 'PENDING' || currentPaymentStatus === 'PAID'}
              className="w-full h-14 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isInitiatingPayment ? (
                <>
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                  Opening payment...
                </>
              ) : currentPaymentStatus === 'PAID' ? (
                <>
                  <span className="material-symbols-outlined">verified</span>
                  Payment Confirmed
                </>
              ) : currentPaymentStatus === 'PENDING' ? (
                <>
                  <span className="material-symbols-outlined">hourglass_top</span>
                  Awaiting Confirmation
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">payment</span>
                  Pay NGN {currentTripFareBreakdown?.finalFare.toLocaleString() ?? estimatedPrice.toLocaleString()}
                </>
              )}
            </button>

            {/* Rating */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-slate-400">Rate your driver</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} className="text-slate-300 hover:text-yellow-400 transition-colors active:scale-110">
                    <span className="material-symbols-outlined text-3xl filled">star</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={resetRide}
              className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 font-bold text-sm"
            >
              Done
            </button>
          </div>
        )}
      </div>


      {showDriverPicker && (
        <div className="fixed inset-0 z-50 bg-background-light dark:bg-background-dark flex flex-col animate-slide-up">
          {/* Header */}
          <div className="px-4 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowDriverPicker(false)}
              className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h2 className="text-lg font-bold">Choose a Driver</h2>
              <p className="text-xs text-slate-500">
                {availableDrivers.length} driver{availableDrivers.length !== 1 ? 's' : ''} available nearby
                {vehicleData.transmission ? (
                  <span className="ml-1 text-primary font-bold">
                    · {vehicleData.transmission} compatible
                  </span>
                ) : null}
              </p>

            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingDrivers ? (
              // Loading skeleton
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-slate-100 dark:bg-surface-dark rounded-2xl">
                    <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    </div>
                    <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : availableDrivers.length === 0 ? (
              // No drivers
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-slate-400">person_off</span>
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-lg">No Drivers Available</h3>
                  <p className="text-slate-500 text-sm mt-1 max-w-[240px]">
                    All drivers are currently busy or offline. Please try again shortly.
                  </p>
                  <p className="text-slate-400 text-xs mt-3 max-w-[260px]">
                    Drivers must be approved, online, and sharing live location before they can appear here.
                  </p>
                </div>
                <button
                  onClick={fetchAvailableDrivers}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Refresh
                </button>
              </div>
            ) : (
              // Driver list
              <div className="space-y-3">
                {availableDrivers.map(driver => (
                  <button
                    key={driver.id}
                    onClick={() => handleSelectDriver(driver)}
                    className="w-full flex items-center gap-4 p-4 bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary transition-all active:scale-[0.98] text-left"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={driver.avatarUrl || IMAGES.DRIVER_CARD}
                        className="w-14 h-14 rounded-xl object-cover"
                        alt={driver.name}
                      />
                      {/* Online indicator */}
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-surface-dark"></div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white truncate">
                        {driver.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="material-symbols-outlined text-yellow-500 text-sm filled">star</span>
                        <span className="text-sm font-bold">{driver.rating?.toFixed(1)}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-400">{driver.totalTrips} trips</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold text-slate-500 uppercase">
                          {driver.transmission || 'Any'}
                        </span>
                        {driver.distanceKm && (
                          <span className="text-[10px] text-slate-400">
                            {driver.distanceKm}km away
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ETA + arrow */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {driver.estimatedArrivalMins && (
                        <span className="text-xs font-bold text-primary">
                          ~{driver.estimatedArrivalMins} mins
                        </span>
                      )}
                      <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vehicle Details Modal */}
      {showVehicleForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 animate-fade-in">
          <div className="w-full max-h-[85vh] overflow-y-auto no-scrollbar bg-surface-light dark:bg-surface-dark rounded-[2rem] p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Vehicle Details</h3>
              <button
                onClick={() => setShowVehicleForm(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmRequest} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Make</label>
                  <input
                    required
                    placeholder="e.g. Toyota"
                    className="w-full h-12 bg-slate-50 dark:bg-input-dark rounded-xl px-4 font-bold text-slate-900 dark:text-white border-none focus:ring-1 focus:ring-primary placeholder-slate-400"
                    value={vehicleData.make}
                    onChange={e => setVehicleData({ ...vehicleData, make: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Model</label>
                  <input
                    required
                    placeholder="e.g. Camry"
                    className="w-full h-12 bg-slate-50 dark:bg-input-dark rounded-xl px-4 font-bold text-slate-900 dark:text-white border-none focus:ring-1 focus:ring-primary placeholder-slate-400"
                    value={vehicleData.model}
                    onChange={e => setVehicleData({ ...vehicleData, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Year</label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 2020"
                    className="w-full h-12 bg-slate-50 dark:bg-input-dark rounded-xl px-4 font-bold text-slate-900 dark:text-white border-none focus:ring-1 focus:ring-primary placeholder-slate-400"
                    value={vehicleData.year}
                    onChange={e => setVehicleData({ ...vehicleData, year: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Transmission</label>
                  <div className="relative">
                    <select
                      className="w-full h-12 bg-slate-50 dark:bg-input-dark rounded-xl px-4 font-bold text-slate-900 dark:text-white border-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                      value={vehicleData.transmission}
                      onChange={e => setVehicleData({ ...vehicleData, transmission: e.target.value })}
                    >
                      <option value="Automatic" className="dark:bg-surface-dark">Automatic</option>
                      <option value="Manual" className="dark:bg-surface-dark">Manual</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 p-4 rounded-xl flex items-start gap-3 mt-2 border border-blue-500/20">
                <span className="material-symbols-outlined text-blue-500 mt-0.5">info</span>
                <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed font-medium">
                  Providing accurate vehicle details ensures we match you with a driver experienced in handling your specific car type.
                </p>
              </div>

              <button
                type="submit"
                className="w-full h-14 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 mt-2 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-green-700"
              >
                {bookingType === 'schedule' ? 'Schedule Now' : 'Find Driver'}
                <span className="material-symbols-outlined">{bookingType === 'schedule' ? 'event_available' : 'search'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestRideScreen;



