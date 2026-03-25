
import React, { useState, useEffect, useRef } from 'react';
import { CapacitorService } from '../services/CapacitorService';
import InteractiveMap from '../components/InteractiveMap';
import { IMAGES } from '../constants';
import { SystemSettings, Trip, UserProfile, UserRole, PaymentHistoryRecord } from '../types';
import { io, Socket } from 'socket.io-client';
import { LocationService, LocationData } from '../services/LocationService';
import { api } from '@/services/api.service';
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface SearchResult {
  id: string;
  display_name: string;
  description: string;
  lat: number;
  lon: number;
  category: 'LGA' | 'Airport' | 'Hotel' | 'Shopping' | 'Residential' | 'Commercial' | 'Tourism' | 'Education' | 'Transport' | 'District';
}

interface RequestRideScreenProps {
  onOpenProfile: () => void;
  onBack: () => void;
  settings: SystemSettings;
  onRideComplete: (trip: Trip) => void;
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
}

type RideState = 'IDLE' | 'SEARCHING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SCHEDULED';

const DISCOVERY_CATEGORIES = [
  { label: 'Airports', icon: 'flight_takeoff', type: 'Airport' },
  { label: 'Hotels', icon: 'hotel', type: 'Hotel' },
  { label: 'Dining', icon: 'restaurant', type: 'Commercial' },
  { label: 'Malls', icon: 'shopping_cart', type: 'Shopping' }
];



// ... existing interfaces ...

const RequestRideScreen: React.FC<RequestRideScreenProps> = ({
  onOpenProfile,
  onBack,
  settings,
  onRideComplete,
  currentUser,
  allUsers
}) => {
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [destination, setDestination] = useState<LocationData | null>(null);
  const [rideState, setRideState] = useState<RideState>('IDLE');
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.4549, 3.4246]); // Lagos default
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [estimatedDistance, setEstimatedDistance] = useState<string>('');
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);

  // Search States
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [estimatedMins, setEstimatedMins] = useState<number>(0);
  const [fareRange, setFareRange] = useState<{ low: number; high: number } | null>(null);

  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Booking Type State
  const [bookingType, setBookingType] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const ownerSocketRef = useRef<Socket | null>(null);
  const pickupRef = useRef<LocationData | null>(null);
  const rideStateRef = useRef<RideState>('IDLE');
  const showDriverPickerRef = useRef(false);
  const transmissionRef = useRef('Automatic');
  const trackedDriverIdRef = useRef<string | null>(null);
  const refreshAvailableDriversRef = useRef<() => Promise<void>>(async () => {});


  const [currentTripFareBreakdown, setCurrentTripFareBreakdown] = useState<any>(null);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);

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
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const timerRefs = useRef<any[]>([]);

  const [isLocating, setIsLocating] = useState(false);

  const CountdownTimer: React.FC<{ seconds: number; onExpire: () => void }> = ({
    seconds,
    onExpire,
  }) => {
    const [remaining, setRemaining] = React.useState(seconds);

    React.useEffect(() => {
      if (remaining <= 0) {
        onExpire();
        return;
      }
      const timer = setTimeout(() => setRemaining(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }, [remaining]);

    return (
      <div className="mt-4 flex flex-col items-center gap-1">
        <div
          className="w-12 h-12 rounded-full border-4 border-primary/30 flex items-center justify-center"
          style={{
            background: `conic-gradient(#045828 ${(remaining / seconds) * 360}deg, transparent 0deg)`,
          }}
        >
          <div className="w-8 h-8 bg-white dark:bg-surface-dark rounded-full flex items-center justify-center">
            <span className="text-sm font-black text-primary">{remaining}</span>
          </div>
        </div>
        <span className="text-xs text-slate-400">seconds remaining</span>
      </div>
    );
  };

  const handlePayNow = async () => {
    if (!currentTripId) return;
    setIsInitiatingPayment(true);
    try {
      const payment = await api.post<any>(`/payments/initiate/${currentTripId}`);
      if (payment.checkoutUrl) {
        window.open(payment.checkoutUrl, '_blank');
      }
    } catch (error: any) {
      alert(error.message || 'Payment initiation failed. Please try again.');
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


  const handleUseMyLocation = async () => {
    setIsLocating(true);
    try {
      const position = await CapacitorService.getCurrentLocation();
      if (position) {
        const { latitude, longitude, accuracy } = position.coords;
        const location = await LocationService.reverseGeocode(latitude, longitude);
        setPickup({ ...location, accuracy: accuracy || 0 });
        setMapCenter([latitude, longitude]);
        setIsSearchingPickup(false);
      }
    } catch (error) {
      alert('Location permission denied. Please enter pickup manually.');
    } finally {
      setIsLocating(false);
    }
  };
  const handleMarkerDragEnd = async (id: string, newPos: [number, number]) => {
    if (id === 'pickup') {
      const newLocation = await LocationService.reverseGeocode(newPos[0], newPos[1]);
      setPickup({ ...newLocation, accuracy: 0 });
    }
  };

  useEffect(() => {
    // Get initial location
    CapacitorService.getCurrentLocation().then(pos => {
      if (pos) {
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
      }
    });

    // Set default schedule date to today
    setScheduleDate(new Date().toISOString().split('T')[0]);

    // Cleanup timers on unmount
    return () => clearTimers();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    const loadOwnerHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const [rides, payments] = await Promise.all([
          api.get<any[]>('/rides/history'),
          api.get<PaymentHistoryRecord[]>('/payments/history'),
        ]);

        setRecentTrips(rides.map((trip) => ({
          ...trip,
          ownerId: trip.ownerId || trip.owner?.id,
          driverId: trip.driverId || trip.driver?.id,
          ownerName: trip.owner?.name || trip.ownerName || 'Owner',
          driverName: trip.driver?.name || trip.driverName || 'Unassigned',
          date: trip.createdAt ? new Date(trip.createdAt).toLocaleString() : '',
          location: `${trip.pickupAddress?.split(',')[0] || 'Unknown'} -> ${trip.destAddress?.split(',')[0] || 'Unknown'}`,
        })));
        setRecentPayments(payments);
      } catch (error) {
        console.error('Failed to load owner history:', error);
        setRecentTrips([]);
        setRecentPayments([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadOwnerHistory();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    ownerSocketRef.current = io(`${API_URL}/rides`, {
      transports: ['websocket'],
    });

    ownerSocketRef.current.on('connect', () => {
      ownerSocketRef.current?.emit('owner:register', { ownerId: currentUser.id });
    });

    // Driver accepted — move to ASSIGNED state
    ownerSocketRef.current.on('ride:accepted', (data: any) => {
      setDriverInfo(prev => ({
        ...prev,
        ...data.driver,
        avatar: data.driver?.avatarUrl || IMAGES.DRIVER_CARD,
        timeAway: data.estimatedArrivalMins || 5,
      }));
      if (data.driver?.id) {
        trackedDriverIdRef.current = data.driver.id;
      }
      setRideState('ASSIGNED');
    });

    // Driver declined or timed out — go back to driver picker
    ownerSocketRef.current.on('ride:declined', (data: any) => {
      alert(data.message || 'Driver declined. Please choose another driver.');
      setSelectedDriver(null);
      setDriverInfo(null);
      trackedDriverIdRef.current = null;
      setTrackedDriverPos(null);
      fetchAvailableDrivers();
      setShowDriverPicker(true);
      setRideState('IDLE');
    });

    // Trip completed by driver — show payment screen
    ownerSocketRef.current.on('trip:completed', (data: any) => {
      if (data.fareBreakdown) {
        setCurrentTripFareBreakdown(data.fareBreakdown);
      }
      setRideState('COMPLETED');
    });

    ownerSocketRef.current.on('driver:availability', () => {
      if ((showDriverPickerRef.current || rideStateRef.current === 'IDLE') && pickupRef.current) {
        refreshAvailableDriversRef.current().catch((error) => {
          console.error('Failed to refresh drivers after availability update:', error);
        });
      }
    });

    ownerSocketRef.current.on('location:updated', (data: any) => {
      if (!trackedDriverIdRef.current || data.driverId !== trackedDriverIdRef.current) return;
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        setTrackedDriverPos([data.lat, data.lng]);
      }
    });

    return () => {
      ownerSocketRef.current?.disconnect();
    };
  }, [currentUser?.id]);
  const getSearchBias = (): { lat?: number; lng?: number } => {
    if (pickup) {
      return { lat: pickup.lat, lng: pickup.lon };
    }
    if (Number.isFinite(mapCenter[0]) && Number.isFinite(mapCenter[1])) {
      return { lat: mapCenter[0], lng: mapCenter[1] };
    }
    return {};
  };

  function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  // Calculate Price when points change
  useEffect(() => {
    if (!pickup || !destination) return;

    const fetchRoute = async () => {
      setIsFetchingRoute(true); // ← start loading
      try {
        const route = await api.get<{
          distanceKm: number;
          estimatedMins: number;
          currentTrafficMins: number;
          fareEstimate: { low: number; high: number };
        }>(
          `/locations/route?originLat=${pickup.lat}&originLng=${pickup.lon}&destLat=${destination.lat}&destLng=${destination.lon}`,
          false,
        );

        setEstimatedDistance(route.distanceKm.toFixed(1));
        setEstimatedMins(route.estimatedMins);
        setFareRange({ low: route.fareEstimate.low, high: route.fareEstimate.high });
        setEstimatedPrice(route.fareEstimate.low);
      } catch (error) {
        const dist = Math.max(
          calculateDistance(pickup.lat, pickup.lon, destination.lat, destination.lon),
          1,
        );
        setEstimatedDistance(dist.toFixed(1));
        const price = settings.baseFare + dist * settings.pricePerKm;
        const rounded = Math.round(price / 50) * 50;
        setEstimatedPrice(rounded);
        setFareRange({ low: rounded, high: Math.round((rounded * 1.5) / 50) * 50 });
      } finally {
        setIsFetchingRoute(false); // ← stop loading regardless of success/failure
      }
    };

    fetchRoute();
  }, [pickup, destination]);

  const handleSelectLocation = (loc: LocationData, type: 'pickup' | 'dest') => {
    if (type === 'pickup') {
      setNoDriversFound(false);
      setPickup(loc);
      setIsSearchingPickup(false);
      setMapCenter([loc.lat, loc.lon]);
    } else {
      setDestination(loc);
      setIsSearchingDest(false);
    }
    setSearchQuery('');
  };

  const clearTimers = () => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  };



  const handleConfirmRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleData.make || !vehicleData.model || !vehicleData.year) {
      alert('Please fill in all vehicle details to proceed.');
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
      location: `${pickup?.display_name?.split(',')[0] || 'Unknown'} -> ${destination?.display_name?.split(',')[0] || 'Unknown'}`,
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
      alert('Missing trip details. Please try again.');
      setRideState('IDLE');
      return;
    }

    setRideState('SEARCHING');
    setNoDriversFound(false);

    try {
      const trip = await api.post<any>('/rides', {
        pickupAddress: pickup.display_name,
        pickupLat: pickup.lat,
        pickupLng: pickup.lon,
        destAddress: destination.display_name,
        destLat: destination.lat,
        destLng: destination.lon,
        distanceKm: parseFloat(estimatedDistance),
        estimatedMins: estimatedMins || undefined,
        driverId: bookedDriver.id,
        vehicleMake: vehicleData.make,
        vehicleModel: vehicleData.model,
        vehicleYear: vehicleData.year,
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
      alert(error.message || 'Could not book ride. Please try again.');
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
    setPickup(null);
    setDestination(null);
    setDriverInfo(null);
    setTrackedDriverPos(null);
    trackedDriverIdRef.current = null;
    setNoDriversFound(false);
    setBookingType('now');
  };

  const copyToClipboard = async (text: string, label: string) => {
    await CapacitorService.triggerHaptic();
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label} copied to clipboard!`);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleInitiateRequest = () => {
    CapacitorService.triggerHaptic();
    if (bookingType === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        alert('Please select both date and time for your scheduled ride.');
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

  useEffect(() => {
    if (
      ownerSocketRef.current?.connected &&
      driverInfo?.id &&
      (rideState === 'ASSIGNED' || rideState === 'IN_PROGRESS')
    ) {
      trackedDriverIdRef.current = driverInfo.id;
      ownerSocketRef.current.emit('track:driver', { driverId: driverInfo.id });
    }
  }, [driverInfo?.id, rideState]);


  const openGoogleMaps = () => {
    if (destination) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lon}`;
      window.open(url, '_blank');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(val).replace('NGN', '₦');
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return 'Just now';
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };



  const handleCategoryTap = async (categoryType: string) => {
    const queries: Record<string, string> = {
      'Airport': 'airport',
      'Hotel': 'hotels',
      'Commercial': 'restaurants dining',
      'Shopping': 'shopping mall',
    };

    const query = queries[categoryType] || categoryType;
    setIsSearching(true);
    const bias = getSearchBias();

    try {
      const results = await LocationService.search(
        query,
        bias.lat,
        bias.lng,
      );

      // Sort by distance from pickup if pickup is set
      if (pickup && results.length > 0) {
        results.sort((a, b) => {
          const distA = Math.sqrt(
            Math.pow(a.lat - pickup.lat, 2) + Math.pow(a.lon - pickup.lon, 2),
          );
          const distB = Math.sqrt(
            Math.pow(b.lat - pickup.lat, 2) + Math.pow(b.lon - pickup.lon, 2),
          );
          return distA - distB;
        });
      }

      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const bias = getSearchBias();
      try {
        const results = await LocationService.search(searchQuery, bias.lat, bias.lng);
        setSearchResults(results);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, pickup]); // ← removed isSearching from deps




  const renderSearchModal = (type: 'pickup' | 'dest') => (
    <div className="fixed inset-0 z-50 bg-background-light dark:bg-background-dark flex flex-col animate-slide-up">
      <div className="px-4 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => type === 'pickup' ? setIsSearchingPickup(false) : setIsSearchingDest(false)}
          className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <div className="flex-1 bg-slate-100 dark:bg-surface-dark rounded-xl flex items-center px-4 h-12">
          <span className="material-symbols-outlined text-slate-400 mr-2">search</span>
          <input
            autoFocus
            className="bg-transparent border-none w-full text-base font-medium focus:ring-0 p-0 text-slate-900 dark:text-white"
            placeholder={type === 'pickup' ? "Where are you?" : "Where to?"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {type === 'pickup' && searchQuery === '' && (
          <div className="mb-6">
            <button
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className="w-full flex items-center gap-4 p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors text-left mb-2"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                {isLocating ? (
                  <span className="material-symbols-outlined text-primary animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-primary">my_location</span>
                )}
              </div>
              <div>
                <p className="font-bold text-primary text-sm">Use My Live Location</p>
                <p className="text-xs text-slate-500">Tap to set pickup to your current position</p>
              </div>
            </button>
            <p className="text-[10px] text-slate-400 px-2 text-center">
              Location is only used for this ride request.
            </p>
          </div>
        )}

        {searchQuery === '' && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Categories</h3>
            <div className="grid grid-cols-4 gap-4">
              {DISCOVERY_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => handleCategoryTap(cat.type)}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">{cat.icon}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Locations</h3>
        <div className="space-y-2">
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-primary">refresh</span>
            </div>
          )}
          {!isSearching && searchResults.map(loc => (
            <button
              key={loc.id}
              onClick={() => handleSelectLocation(loc, type)}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-surface-dark transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-slate-500 text-lg">location_on</span>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{loc.display_name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 rounded text-slate-500 font-bold uppercase">{loc.category}</span>
                  <p className="text-xs text-slate-500">{loc.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

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
      {isSearchingPickup && renderSearchModal('pickup')}
      {isSearchingDest && renderSearchModal('dest')}

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
      <header className="relative z-10 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
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

      <div className="flex-1"></div>

      {/* Bottom Sheet UI */}
      <div className="relative z-20 px-4 pb-8">
        {rideState === 'IDLE' && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up">
            <h2 className="text-lg font-bold mb-4">Plan your ride</h2>

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
                onClick={() => setIsSearchingPickup(true)}
                className="flex items-center gap-4 relative z-10"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-primary text-xl">trip_origin</span>
                </div>
                <div className="flex-1 h-14 bg-slate-50 dark:bg-black/20 rounded-xl flex items-center px-4 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                  <p className={`text-sm font-medium truncate ${pickup ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    {pickup ? pickup.display_name : "Current Location"}
                  </p>
                </div>
              </button>

              {/* Destination Input */}
              <button
                onClick={() => setIsSearchingDest(true)}
                className="flex items-center gap-4 relative z-10"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-slate-900 dark:text-white text-xl">location_on</span>
                </div>
                <div className="flex-1 h-14 bg-slate-50 dark:bg-black/20 rounded-xl flex items-center px-4 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                  <p className={`text-sm font-medium truncate ${destination ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    {destination ? destination.display_name : "Enter Destination"}
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

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Recent Trips</p>
                      <span className="text-[10px] text-slate-400">{recentTrips.length} total</span>
                    </div>
                    {isLoadingHistory ? (
                      <p className="text-sm text-slate-400">Loading trip history...</p>
                    ) : recentTrips.length > 0 ? (
                      <div className="space-y-3">
                        {recentTrips.slice(0, 3).map((trip) => (
                          <div key={trip.id} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{trip.location}</p>
                              <p className="text-xs text-slate-500">{formatShortDate(trip.createdAt || trip.date)}</p>
                            </div>
                            <span className="text-xs font-bold text-slate-500 uppercase">{trip.status.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No trips yet.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Payment History</p>
                      <span className="text-[10px] text-slate-400">{recentPayments.length} records</span>
                    </div>
                    {isLoadingHistory ? (
                      <p className="text-sm text-slate-400">Loading payments...</p>
                    ) : recentPayments.length > 0 ? (
                      <div className="space-y-3">
                        {recentPayments.slice(0, 3).map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {payment.trip.pickupAddress.split(',')[0]} to {payment.trip.destAddress.split(',')[0]}
                              </p>
                              <p className="text-xs text-slate-500">{formatShortDate(payment.paidAt)}</p>
                            </div>
                            <span className="text-sm font-black text-primary">{formatCurrency(payment.totalAmount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No completed payments yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {rideState === 'SEARCHING' && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-slide-up">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4 relative">
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
              Request sent — driver has 60 seconds to accept
            </p>

            {/* 60 second countdown */}
            <CountdownTimer
              seconds={60}
              onExpire={() => {
                // UI will update via WebSocket when backend auto-declines
                // This just shows the user how long is left
              }}
            />

            <button
              onClick={resetRide}
              className="mt-6 text-slate-400 font-bold text-sm hover:text-slate-600"
            >
              Cancel Request
            </button>
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
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {rideState === 'ASSIGNED' ? 'Driver Found!' : 'Trip in progress'}
                </span>
              </div>
              <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">
                {rideState === 'ASSIGNED' ? `${driverInfo.timeAway} mins away` : `Heading to Destination`}
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

            {rideState === 'IN_PROGRESS' && (
              <button
                onClick={handleArrivedAtDestination}
                className="mt-4 w-full py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/25 hover:bg-green-700 transition-colors active:scale-95 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">flag</span>
                I have arrived
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
              <p className="text-slate-500 text-sm mt-1">Please complete payment below</p>
            </div>

            {/* Fare breakdown — shown to owner too */}
            {currentTripFareBreakdown && (
              <div className="bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Final Fare Breakdown</p>
                </div>

                <div className="px-4 py-3 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">Base fare</span>
                    <span className="font-bold text-sm">
                      NGN {(currentTripFareBreakdown.baseFare ?? settings.baseFare).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">
                      Distance ({currentTripFareBreakdown.distanceKm ?? 0}km x NGN 100)
                    </span>
                    <span className="font-bold text-sm">
                      NGN {(currentTripFareBreakdown.distanceComponent ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">
                      Time ({currentTripFareBreakdown.totalMins ?? currentTripFareBreakdown.actualMins ?? 0} mins x NGN 50)
                    </span>
                    <span className="font-bold text-sm">
                      NGN {(currentTripFareBreakdown.timeComponent ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Actual trip time: {currentTripFareBreakdown.actualMins ?? currentTripFareBreakdown.totalMins ?? 0} mins</span>
                    <span>Estimated route time: {currentTripFareBreakdown.estimatedMins ?? 0} mins</span>
                  </div>
                </div>

                <div className="mx-4 border-t border-slate-200 dark:border-slate-700"></div>

                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="font-black text-slate-900 dark:text-white">Total</span>
                  <span className="text-2xl font-black text-primary">
                    NGN {currentTripFareBreakdown.finalFare.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Pay button */}
            <button
              onClick={handlePayNow}
              disabled={isInitiatingPayment}
              className="w-full h-14 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isInitiatingPayment ? (
                <>
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                  Opening payment...
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
          <div className="w-full bg-surface-light dark:bg-surface-dark rounded-[2rem] p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
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
