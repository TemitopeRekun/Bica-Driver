import { api } from './api.service';
import { LocationData, RouteData } from '../types';


const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

export const LocationService = {

  // Calls GET /locations/search?q=query
  // Returns real Google Places results from backend
<<<<<<< HEAD
  async search(query: string, biasLat?: number, biasLng?: number): Promise<LocationData[]> {
=======
  async search(
    query: string,
    biasLat?: number,
    biasLng?: number,
    signal?: AbortSignal,
  ): Promise<LocationData[]> {
>>>>>>> main
    const normalizedQuery = query?.trim();
    if (!normalizedQuery || normalizedQuery.length < 2) return [];
    try {
      let url = `/locations/search?q=${encodeURIComponent(normalizedQuery)}`;

      // Pass pickup coords so backend biases results to pickup location
      const hasBiasLat = Number.isFinite(biasLat);
      const hasBiasLng = Number.isFinite(biasLng);
      if (hasBiasLat && hasBiasLng) {
        url += `&biasLat=${biasLat}&biasLng=${biasLng}`;
      }

<<<<<<< HEAD
      const results = await api.get<LocationData[]>(url, false);
=======
      const results = await api.get<LocationData[]>(url, false, { signal });
>>>>>>> main
      return Array.isArray(results) ? results : [];
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      console.error('Location search failed:', error);
      throw error;
    }
  },

  // Calls GET /locations/reverse?lat=&lng=
  // Returns real street address from Google Geocoding
  async reverseGeocode(lat: number, lon: number): Promise<LocationData> {
    try {
      const result = await api.get<LocationData>(
        `/locations/reverse?lat=${lat}&lng=${lon}`,
        false,
      );
      return result;
    } catch (error) {
      console.error('Reverse geocode failed:', error);
      return {
        id: `gps_${lat}_${lon}`,
        display_name: 'Current Location',
        description: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        lat,
        lon,
        category: 'Residential',
      };
    }
  },

  async getRoute(originLat: number, originLng: number, destLat: number, destLng: number): Promise<RouteData> {
    return api.get<RouteData>(
      `/locations/route?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`,
      false,
    );
  },
};

export const getLocationPrimaryText = (location?: LocationData | null): string => {
  if (!location) return 'Unknown Location';

  const streetLabel = [location.street_number, location.street].filter(Boolean).join(' ').trim();
  const formatted = location.formatted_address?.trim();

  return (
    formatted ||
    streetLabel ||
    location.display_name ||
    location.area ||
    location.city ||
    location.description ||
    'Unknown Location'
  );
};

export const getLocationSecondaryText = (location?: LocationData | null): string => {
  if (!location) return '';

  const streetLabel = [location.street_number, location.street].filter(Boolean).join(' ').trim();
  const structured = [streetLabel, location.area, location.city || location.lga, location.state, location.country]
    .filter(Boolean)
    .join(', ');

  if (structured && structured !== location.formatted_address?.trim()) {
    return structured;
  }

  return location.description || '';
};

export const getLocationAddress = (location?: LocationData | null): string => {
  if (!location) return 'Unknown Location';
  return location.formatted_address || location.description || location.display_name;
};

export const getLocationShortText = (location?: LocationData | null): string => {
  if (!location) return 'Unknown';
  const formattedFirst = location.formatted_address?.split(',')[0]?.trim();
  return (
    formattedFirst ||
    location.display_name?.split(',')[0] ||
    location.area ||
    location.city ||
    location.lga ||
    location.formatted_address?.split(',')[0] ||
    'Unknown'
  );
};
