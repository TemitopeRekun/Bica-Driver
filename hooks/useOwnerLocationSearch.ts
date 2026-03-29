import { useCallback, useEffect, useRef, useState } from 'react';
import { CapacitorService } from '../services/CapacitorService';
import { LocationService, LocationData } from '../services/LocationService';
import { SystemSettings } from '../types';

interface UseOwnerLocationSearchOptions {
  settings: SystemSettings;
  onPickupChanged?: () => void;
}

const DISTANCE_RATE = 100;
const TIME_RATE = 50;
const FALLBACK_MINUTES_PER_KM = 3;
const MIN_FALLBACK_MINUTES = 5;
const DEFAULT_MAP_CENTER: [number, number] = [6.4549, 3.4246];

export const useOwnerLocationSearch = ({ settings, onPickupChanged }: UseOwnerLocationSearchOptions) => {
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [destination, setDestination] = useState<LocationData | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_MAP_CENTER);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [estimatedDistance, setEstimatedDistance] = useState<string>('');
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [estimatedMins, setEstimatedMins] = useState<number>(0);
  const [fareRange, setFareRange] = useState<{ low: number; high: number } | null>(null);
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const pickupExistsRef = useRef(false);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    pickupExistsRef.current = Boolean(pickup);
  }, [pickup]);

  const clearSearchState = useCallback(() => {
    searchRequestIdRef.current += 1;
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(false);
  }, []);

  const getSearchBias = useCallback((): { lat?: number; lng?: number } => {
    if (pickup) {
      return { lat: pickup.lat, lng: pickup.lon };
    }
    if (Number.isFinite(mapCenter[0]) && Number.isFinite(mapCenter[1])) {
      return { lat: mapCenter[0], lng: mapCenter[1] };
    }
    return {};
  }, [pickup, mapCenter]);

  function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const r = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return r * c;
  }

  const refreshRoute = useCallback(async () => {
    if (!pickup || !destination) return;

    setIsFetchingRoute(true);
    try {
      const route = await LocationService.getRoute(
        pickup.lat,
        pickup.lon,
        destination.lat,
        destination.lon,
      );

      setEstimatedDistance(route.distanceKm.toFixed(1));
      setEstimatedMins(route.estimatedMins);
      setFareRange({ low: route.fareEstimate.low, high: route.fareEstimate.high });
      setEstimatedPrice(route.fareEstimate.low);
    } catch {
      const dist = Math.max(
        calculateDistance(pickup.lat, pickup.lon, destination.lat, destination.lon),
        1,
      );
      const fallbackEstimatedMins = Math.max(
        Math.round(dist * FALLBACK_MINUTES_PER_KM),
        MIN_FALLBACK_MINUTES,
      );
      const fallbackLowEstimate =
        settings.baseFare + dist * DISTANCE_RATE + fallbackEstimatedMins * TIME_RATE;
      const bufferMins = Math.max(Math.ceil(fallbackEstimatedMins * 0.15), MIN_FALLBACK_MINUTES);
      const fallbackHighEstimate =
        settings.baseFare + dist * DISTANCE_RATE + (fallbackEstimatedMins + bufferMins) * TIME_RATE;
      const roundedLow = Math.round(fallbackLowEstimate / 50) * 50;
      const roundedHigh = Math.max(roundedLow, Math.round(fallbackHighEstimate / 50) * 50);

      setEstimatedDistance(dist.toFixed(1));
      setEstimatedMins(fallbackEstimatedMins);
      setEstimatedPrice(roundedLow);
      setFareRange({ low: roundedLow, high: roundedHigh });
    } finally {
      setIsFetchingRoute(false);
    }
  }, [destination, pickup, settings.baseFare]);

  const handleUseMyLocation = async () => {
    setIsLocating(true);
    try {
      const position = await CapacitorService.getCurrentLocation();
      const latitude = position?.coords?.latitude;
      const longitude = position?.coords?.longitude;
      const accuracy = position?.coords?.accuracy;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Current location is unavailable.');
      }

      const location = await LocationService.reverseGeocode(latitude, longitude);
      setPickup({ ...location, accuracy: Number.isFinite(accuracy) ? accuracy : 0 });
      setMapCenter([latitude, longitude]);
      clearSearchState();
      setIsSearchingPickup(false);
      onPickupChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('permission')) {
        alert('Location permission denied. Please enter pickup manually.');
      } else {
        alert('We could not read your live location. Please ensure GPS is on and try again.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  const handleMarkerDragEnd = async (id: string, newPos: [number, number]) => {
    if (id === 'pickup') {
      const newLocation = await LocationService.reverseGeocode(newPos[0], newPos[1]);
      setPickup({ ...newLocation, accuracy: 0 });
      onPickupChanged?.();
    }
  };

  const handleSelectLocation = (loc: LocationData, type: 'pickup' | 'dest') => {
    if (type === 'pickup') {
      setPickup(loc);
      setIsSearchingPickup(false);
      setMapCenter([loc.lat, loc.lon]);
      onPickupChanged?.();
    } else {
      setDestination(loc);
      setIsSearchingDest(false);
    }
    clearSearchState();
  };

  const handleCategoryTap = async (categoryType: string) => {
    const queries: Record<string, string> = {
      Airport: 'airport',
      Hotel: 'hotel',
      Commercial: 'restaurants dining',
      Shopping: 'shopping mall',
    };

    const query = queries[categoryType] || categoryType;
    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setSearchError(null);
    const bias = getSearchBias();

    try {
      const results = await LocationService.search(query, bias.lat, bias.lng);
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults(results);
    } catch {
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults([]);
      setSearchError('We could not load category locations right now.');
    } finally {
      if (requestId !== searchRequestIdRef.current) return;
      setIsSearching(false);
    }
  };

  const restoreLocations = (nextPickup: LocationData | null, nextDestination: LocationData | null) => {
    setPickup(nextPickup);
    setDestination(nextDestination);
    if (nextPickup) {
      setMapCenter([nextPickup.lat, nextPickup.lon]);
    }
    clearSearchState();
    setIsSearchingPickup(false);
    setIsSearchingDest(false);
  };

  const resetLocationSearch = () => {
    setPickup(null);
    setDestination(null);
    clearSearchState();
    setEstimatedPrice(0);
    setEstimatedDistance('');
    setEstimatedMins(0);
    setFareRange(null);
    setIsSearchingPickup(false);
    setIsSearchingDest(false);
  };

  useEffect(() => {
    let isMounted = true;

    const hydrateInitialLocation = async () => {
      const pos = await CapacitorService.getCurrentLocation();
      if (!pos || !isMounted) return;

      const nextCenter: [number, number] = [pos.coords.latitude, pos.coords.longitude];

      if (pickupExistsRef.current) return;

      const location = await LocationService.reverseGeocode(
        pos.coords.latitude,
        pos.coords.longitude,
      );

      if (!isMounted || pickupExistsRef.current) return;

      setPickup({ ...location, accuracy: pos.coords.accuracy || 0 });
      setMapCenter(nextCenter);
      onPickupChanged?.();
    };

    hydrateInitialLocation().catch((error) => {
      console.error('Failed to hydrate initial owner location:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [onPickupChanged]);

  useEffect(() => {
    if (!pickup || !destination) return;
    refreshRoute().catch(() => {});
  }, [pickup, destination, refreshRoute]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < 2) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      const bias = getSearchBias();
      try {
        const results = await LocationService.search(normalizedQuery, bias.lat, bias.lng);
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults(results);
      } catch {
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults([]);
        setSearchError('We could not fetch place suggestions. Check your connection and try again.');
      } finally {
        if (requestId !== searchRequestIdRef.current) return;
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, getSearchBias]);

  return {
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
  };
};
