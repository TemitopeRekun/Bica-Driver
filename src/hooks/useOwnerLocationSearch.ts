import { useCallback, useEffect, useRef, useState } from 'react';
import { CapacitorService } from '@/services/CapacitorService';
import { LocationService } from '@/services/LocationService';
import { SystemSettings, LocationData } from '@/types';
import { useToast } from './useToast';

interface UseOwnerLocationSearchOptions {
  settings: SystemSettings;
  onPickupChanged?: () => void;
}

const FALLBACK_MINUTES_PER_KM = 3;
const MIN_FALLBACK_MINUTES = 5;
const DEFAULT_MAP_CENTER: [number, number] = [6.4549, 3.4246];

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

export const useOwnerLocationSearch = ({ settings, onPickupChanged }: UseOwnerLocationSearchOptions) => {
  const { toast } = useToast();
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [destination, setDestination] = useState<LocationData | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_MAP_CENTER);
  const [deviceGpsBias, setDeviceGpsBias] = useState<{ lat: number; lng: number } | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [estimatedDistance, setEstimatedDistance] = useState<string>('');
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [estimatedMins, setEstimatedMins] = useState<number>(0);
  const [fareRange, setFareRange] = useState<{ low: number; high: number } | null>(null);
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const pickupExistsRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const onPickupChangedRef = useRef(onPickupChanged);
  const hasHydratedInitialLocationRef = useRef(false);
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  // Added/Renamed state to match expected use in the file
  const [searchQueryState, setSearchQuery] = useState('');

  useEffect(() => {
    pickupExistsRef.current = Boolean(pickup);
  }, [pickup]);

  useEffect(() => {
    onPickupChangedRef.current = onPickupChanged;
  }, [onPickupChanged]);

  const cancelActiveSearch = useCallback(() => {
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
  }, []);

  const clearSearchState = useCallback(() => {
    cancelActiveSearch();
    searchRequestIdRef.current += 1;
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(false);
  }, [cancelActiveSearch]);

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
      const pricePerKm = settings.pricePerKm || 100;
      const timeRate = settings.timeRate || 50;

      const fallbackLowEstimate =
        settings.baseFare + dist * pricePerKm + fallbackEstimatedMins * timeRate;
      const bufferMins = Math.max(Math.ceil(fallbackEstimatedMins * 0.15), MIN_FALLBACK_MINUTES);
      const fallbackHighEstimate =
        settings.baseFare + dist * pricePerKm + (fallbackEstimatedMins + bufferMins) * timeRate;
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
      // forPickup=true forces maximumAge:0 — always a fresh GPS read, never cached
      const position = await CapacitorService.getCurrentLocation(true);
      const latitude = position?.coords?.latitude;
      const longitude = position?.coords?.longitude;
      const accuracy = position?.coords?.accuracy;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Current location is unavailable.');
      }

      setDeviceGpsBias({ lat: latitude, lng: longitude });
      const location = await LocationService.reverseGeocode(latitude, longitude);
      setPickup({ ...location, accuracy: Number.isFinite(accuracy) ? accuracy : 0 });
      setMapCenter([latitude, longitude]);
      clearSearchState();
      setIsSearchingPickup(false);
      onPickupChangedRef.current?.();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('permission')) {
        toast.error('Location permission denied. Please enter pickup manually.');
      } else {
        toast.error('We could not read your live location. Please ensure GPS is on and try again.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  const handleMarkerDragEnd = async (id: string, newPos: [number, number]) => {
    if (id === 'pickup') {
      const newLocation = await LocationService.reverseGeocode(newPos[0], newPos[1]);
      setPickup({ ...newLocation, accuracy: 0 });
      onPickupChangedRef.current?.();
    }
  };

  const handleSelectLocation = (loc: LocationData, type: 'pickup' | 'dest') => {
    if (type === 'pickup') {
      setPickup(loc);
      setIsSearchingPickup(false);
      setMapCenter([loc.lat, loc.lon]);
      onPickupChangedRef.current?.();
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

    if (!pickup) {
      setSearchResults([]);
      setSearchError('Select pickup first to discover nearby categories.');
      setIsSearching(false);
      return;
    }

    cancelActiveSearch();
    const query = queries[categoryType] || categoryType;
    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setSearchError(null);
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    try {
      const results = await LocationService.search(
        query,
        pickup.lat,
        pickup.lon,
        controller.signal,
      );
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults(results);
    } catch (error) {
      if (isAbortError(error)) return;
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults([]);
      setSearchError('We could not load category locations right now.');
    } finally {
      if (searchAbortControllerRef.current === controller) {
        searchAbortControllerRef.current = null;
      }
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
    if (hasHydratedInitialLocationRef.current) return;
    hasHydratedInitialLocationRef.current = true;

    let isMounted = true;

    const hydrateInitialLocation = async () => {
      // On web, proactively query permission state so the browser prompt
      // appears automatically when this screen mounts — not just on button tap
      if ('permissions' in navigator) {
        try {
          const permStatus = await navigator.permissions.query({ name: 'geolocation' });
          if (permStatus.state === 'denied') {
            // No point trying — don't waste the GPS attempt
            return;
          }
          // state === 'prompt' → getCurrentPosition will trigger the dialog
          // state === 'granted' → will read silently
        } catch {
          // Browser may not support permissions.query for geolocation — continue anyway
        }
      }

      // forPickup=true forces maximumAge:0 — always a fresh GPS read, never cached
      const pos = await CapacitorService.getCurrentLocation(true);
      if (!pos || !isMounted) return;

      const nextCenter: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setDeviceGpsBias({ lat: pos.coords.latitude, lng: pos.coords.longitude });

      if (pickupExistsRef.current) return;

      const location = await LocationService.reverseGeocode(
        pos.coords.latitude,
        pos.coords.longitude,
      );

      if (!isMounted || pickupExistsRef.current) return;

      setPickup({ ...location, accuracy: pos.coords.accuracy || 0 });
      setMapCenter(nextCenter);
      onPickupChangedRef.current?.();
    };

    hydrateInitialLocation().catch((error) => {
      // Silently suppress permission errors on initial hydration — user hasn't
      // clicked anything yet so we don't want intrusive error messages
      if (!String(error?.message ?? error).toLowerCase().includes('permission')) {
        console.error('Failed to hydrate initial owner location:', error);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!pickup || !destination) return;
    refreshRoute().catch(() => {});
  }, [pickup, destination, refreshRoute]);

  useEffect(() => {
    const activeSearchMode = isSearchingDest
      ? 'destination'
      : isSearchingPickup
        ? 'pickup'
        : null;

    if (!activeSearchMode) {
      cancelActiveSearch();
      setIsSearching(false);
      return;
    }

    const normalizedQuery = searchQueryState.trim();

    if (normalizedQuery.length < 2) {
      cancelActiveSearch();
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
      cancelActiveSearch();
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;
      const bias =
        activeSearchMode === 'destination' && pickup
          ? { lat: pickup.lat, lng: pickup.lon }
          : activeSearchMode === 'pickup' && deviceGpsBias
            ? deviceGpsBias
            : null;

      try {
        const results = await LocationService.search(
          normalizedQuery,
          bias?.lat,
          bias?.lng,
          controller.signal,
        );
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults(results);
      } catch (error) {
        if (isAbortError(error)) return;
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults([]);
        setSearchError('We could not fetch place suggestions. Check your connection and try again.');
      } finally {
        if (searchAbortControllerRef.current === controller) {
          searchAbortControllerRef.current = null;
        }
        if (requestId !== searchRequestIdRef.current) return;
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    searchQueryState,
    isSearchingDest,
    isSearchingPickup,
    pickup,
    deviceGpsBias,
    cancelActiveSearch,
  ]);

  useEffect(() => {
    return () => {
      cancelActiveSearch();
    };
  }, [cancelActiveSearch]);

  return {
    pickup,
    destination,
    mapCenter,
    estimatedPrice,
    estimatedDistance,
    isSearchingPickup,
    isSearchingDest,
    searchQuery: searchQueryState,
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
