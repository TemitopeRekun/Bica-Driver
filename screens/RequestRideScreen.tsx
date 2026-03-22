
import React, { useState, useEffect, useRef } from 'react';
import { CapacitorService } from '../services/CapacitorService';
import InteractiveMap from '../components/InteractiveMap';
import { IMAGES } from '../constants';
import { SystemSettings, Trip, UserProfile, UserRole } from '../types';

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

// Comprehensive Lagos Database
const LAGOS_LOCATIONS: SearchResult[] = [
  { id: 'lm_mmia', display_name: 'Murtala Muhammed Int. Airport', description: 'Ikeja, Lagos', lat: 6.5774, lon: 3.3210, category: 'Airport' },
  { id: 'lm_mma2', display_name: 'MMA2 Terminal', description: 'Ikeja, Lagos', lat: 6.5732, lon: 3.3338, category: 'Airport' },
  { id: 'lm_civic', display_name: 'The Civic Centre', description: 'Victoria Island, Lagos', lat: 6.4368, lon: 3.4413, category: 'Tourism' },
  { id: 'lm_eko_hotel', display_name: 'Eko Hotels & Suites', description: 'Victoria Island, Lagos', lat: 6.4267, lon: 3.4301, category: 'Hotel' },
  { id: 'lm_ikeja_mall', display_name: 'Ikeja City Mall', description: 'Alausa, Ikeja', lat: 6.6136, lon: 3.3578, category: 'Shopping' },
  { id: 'lm_palms', display_name: 'The Palms Shopping Mall', description: 'Lekki, Lagos', lat: 6.4339, lon: 3.4456, category: 'Shopping' },
  { id: 'lm_landmark', display_name: 'Landmark Beach', description: 'Victoria Island, Lagos', lat: 6.4217, lon: 3.4468, category: 'Tourism' },
  { id: 'lga_ikeja', display_name: 'Ikeja', description: 'State Capital & LGA', lat: 6.6018, lon: 3.3515, category: 'LGA' },
  { id: 'lga_lekki', display_name: 'Lekki Phase 1', description: 'Eti-Osa, Lagos', lat: 6.4478, lon: 3.4737, category: 'Residential' },
  { id: 'lga_vi', display_name: 'Victoria Island', description: 'Eti-Osa, Lagos', lat: 6.4281, lon: 3.4219, category: 'Commercial' },
  { id: 'lga_ikoyi', display_name: 'Ikoyi', description: 'Lagos', lat: 6.4549, lon: 3.4246, category: 'Residential' },
  { id: 'lga_surulere', display_name: 'Surulere', description: 'Lagos Mainland', lat: 6.4975, lon: 3.3653, category: 'LGA' },
  { id: 'lga_yaba', display_name: 'Yaba', description: 'Lagos Mainland', lat: 6.5163, lon: 3.3768, category: 'Education' },
];

import { LocationService, LocationData } from '../services/LocationService';
import { api } from '@/services/api.service';

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

  // Booking Type State
  const [bookingType, setBookingType] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Vehicle Details State
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleData, setVehicleData] = useState({
    make: '',
    model: '',
    year: '',
    transmission: 'Automatic'
  });

  // Simulation State
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [noDriversFound, setNoDriversFound] = useState(false);
  const timerRefs = useRef<any[]>([]);

  const [isLocating, setIsLocating] = useState(false);


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

  // Pre-fill vehicle data from profile
  useEffect(() => {
    if (currentUser) {
      setVehicleData(prev => ({
        ...prev,
        make: currentUser.carType || '',
        transmission: (currentUser.transmission as string) || 'Automatic'
      }));
    }
  }, [currentUser]);

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
    if (pickup && destination) {
      const dist = Math.max(calculateDistance(pickup.lat, pickup.lon, destination.lat, destination.lon), 1);
      setEstimatedDistance(dist.toFixed(1));

      // Calculate Price based on Admin Settings
      const price = settings.baseFare + (dist * settings.pricePerKm);
      setEstimatedPrice(Math.round(price / 50) * 50); // Round to nearest 50
    }
  }, [pickup, destination, settings]);

  const handleSelectLocation = (loc: LocationData, type: 'pickup' | 'dest') => {
    if (type === 'pickup') {
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

  const handleInitiateRequest = () => {
    CapacitorService.triggerHaptic();
    if (bookingType === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        alert("Please select both date and time for your scheduled ride.");
        return;
      }
    }
    setShowVehicleForm(true);
  };

  const handleConfirmRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleData.make || !vehicleData.model || !vehicleData.year) {
      alert("Please fill in all vehicle details to proceed.");
      return;
    }
    setShowVehicleForm(false);

    if (bookingType === 'schedule') {
      finalizeScheduledRide();
    } else {
      startRideRequest();
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

  const startRideRequest = async () => {
    if (!pickup || !destination) return;

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
        vehicleMake: vehicleData.make,
        vehicleModel: vehicleData.model,
        vehicleYear: vehicleData.year,
        transmission: vehicleData.transmission,
      });

      if (trip.driver) {
        setDriverInfo({
          id: trip.driverId,
          name: trip.driver.name,
          car: 'Professional Driver',
          plate: `ID-${trip.driverId?.substr(0, 4).toUpperCase()}`,
          rating: trip.driver.rating,
          trips: 0,
          avatar: trip.driver.avatarUrl || IMAGES.DRIVER_CARD,
          timeAway: trip.estimatedArrivalMins || 5,
          tripId: trip.id,
        });
        setCurrentTripId(trip.id);
        setRideState('ASSIGNED');
      } else {
        setNoDriversFound(true);
        setTimeout(() => {
          setRideState('IDLE');
          setNoDriversFound(false);
        }, 3000);
      }
    } catch (error: any) {
      alert(error.message || 'Could not book ride. Please try again.');
      setRideState('IDLE');
    }
  };

  const handleArrivedAtDestination = async () => {
    setRideState('COMPLETED');
    if (currentTripId) {
      try {
        // Initiate Monnify payment
        const payment = await api.post<any>(`/payments/initiate/${currentTripId}`);
        if (payment.checkoutUrl) {
          window.open(payment.checkoutUrl, '_blank');
        }
      } catch (error) {
        console.error('Payment initiation failed:', error);
      }
    }
  };

  const resetRide = () => {
    clearTimers();
    setRideState('IDLE');
    setPickup(null);
    setDestination(null);
    setDriverInfo(null);
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

  const openGoogleMaps = () => {
    if (destination) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lon}`;
      window.open(url, '_blank');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(val).replace('NGN', '₦');
  };

  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await LocationService.search(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
                  onClick={() => setSearchQuery(cat.type)}
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
      position: [pickup!.lat + 0.002, pickup!.lon + 0.002], // Simulated pos
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

                <div className="flex items-center justify-between mb-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Fare</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(estimatedPrice)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distance</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{estimatedDistance} km</p>
                  </div>
                </div>

                <button
                  onClick={handleInitiateRequest}
                  className="w-full h-14 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {bookingType === 'schedule' ? 'Schedule Ride' : 'Request Driver'}
                  <span className="material-symbols-outlined">{bookingType === 'schedule' ? 'event_available' : 'arrow_forward'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {rideState === 'SEARCHING' && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-slide-up">
            {!noDriversFound ? (
              <>
                <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                  <span className="material-symbols-outlined text-primary text-3xl">radar</span>
                </div>
                <h3 className="text-xl font-bold mb-1">Scanning Nearby</h3>
                <p className="text-slate-500">Locating the closest available professional...</p>
                <button onClick={resetRide} className="mt-6 text-slate-400 font-bold text-sm hover:text-slate-600">Cancel Request</button>
              </>
            ) : (
              <div className="animate-fade-in">
                <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-red-500 text-3xl">error_outline</span>
                </div>
                <h3 className="text-xl font-bold mb-1">No Drivers Nearby</h3>
                <p className="text-slate-500">All our drivers are currently busy or too far away. Please try again later.</p>
              </div>
            )}
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
          <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-scale-in">
            <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
              <span className="material-symbols-outlined text-white text-4xl filled">check</span>
            </div>
            <h3 className="text-2xl font-black mb-2">Ride Completed!</h3>
            <p className="text-slate-500 mb-6">Please make payment to the company account below.</p>

            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 mb-6 text-left relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs font-bold text-slate-500 uppercase">Payment Details</p>
                <button
                  onClick={() => copyToClipboard(`Bank: Zenith Bank\nAccount Name: Bica Driver LTD\nAccount Number: 9090390581\nAmount: ${formatCurrency(estimatedPrice)}`, 'All details')}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  Copy All
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center group">
                  <span className="text-sm text-slate-500">Bank Name</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Zenith Bank</span>
                    <button onClick={() => copyToClipboard('Zenith Bank', 'Bank Name')} className="text-slate-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center group">
                  <span className="text-sm text-slate-500">Account Name</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Bica Driver LTD</span>
                    <button onClick={() => copyToClipboard('Bica Driver LTD', 'Account Name')} className="text-slate-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white dark:bg-input-dark p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-sm text-slate-500">Account Number</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-primary tracking-widest">9090390581</span>
                    <button onClick={() => copyToClipboard('9090390581', 'Account Number')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors">
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3 mt-1">
                  <span className="text-sm font-medium text-slate-500">Amount Due</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(estimatedPrice)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} className="text-slate-300 hover:text-yellow-400 transition-colors">
                  <span className="material-symbols-outlined text-4xl filled">star</span>
                </button>
              ))}
            </div>

            <button
              onClick={resetRide}
              className="w-full h-14 bg-primary text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all"
            >
              I have made payment
            </button>
          </div>
        )}
      </div>

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
