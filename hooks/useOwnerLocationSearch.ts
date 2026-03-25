import { useCallback, useEffect, useState } from 'react';
import { CapacitorService } from '../services/CapacitorService';
import { LocationService, LocationData } from '../services/LocationService';
import { SystemSettings } from '../types';

interface UseOwnerLocationSearchOptions {
  settings: SystemSettings;
  onPickupChanged?: () => void;
}

export const useOwnerLocationSearch = ({ settings, onPickupChanged }: UseOwnerLocationSearchOptions) => {
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [destination, setDestination] = useState<LocationData | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.4549, 3.4246]);
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
        onPickupChanged?.();
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
    setSearchQuery('');
  };

  const handleCategoryTap = async (categoryType: string) => {
    const queries: Record<string, string> = {
      Airport: 'airport',
      Hotel: 'hotels',
      Commercial: 'restaurants dining',
      Shopping: 'shopping mall',
    };

    const query = queries[categoryType] || categoryType;
    setIsSearching(true);
    const bias = getSearchBias();

    try {
      const results = await LocationService.search(query, bias.lat, bias.lng);

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
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const resetLocationSearch = () => {
    setPickup(null);
    setDestination(null);
    setSearchQuery('');
    setSearchResults([]);
    setEstimatedPrice(0);
    setEstimatedDistance('');
    setEstimatedMins(0);
    setFareRange(null);
    setIsSearchingPickup(false);
    setIsSearchingDest(false);
  };

  useEffect(() => {
    CapacitorService.getCurrentLocation().then((pos) => {
      if (pos) {
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
      }
    });
  }, []);

  useEffect(() => {
    if (!pickup || !destination) return;

    const fetchRoute = async () => {
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
        setEstimatedDistance(dist.toFixed(1));
        const price = settings.baseFare + dist * settings.pricePerKm;
        const rounded = Math.round(price / 50) * 50;
        setEstimatedPrice(rounded);
        setFareRange({ low: rounded, high: Math.round((rounded * 1.5) / 50) * 50 });
      } finally {
        setIsFetchingRoute(false);
      }
    };

    fetchRoute();
  }, [pickup, destination, settings.baseFare, settings.pricePerKm]);

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
      } catch {
        setSearchResults([]);
      } finally {
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
    setIsSearchingPickup,
    setIsSearchingDest,
    setSearchQuery,
    handleUseMyLocation,
    handleMarkerDragEnd,
    handleSelectLocation,
    handleCategoryTap,
    resetLocationSearch,
  };
};
