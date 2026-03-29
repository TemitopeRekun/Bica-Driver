import { api } from './api.service';

export interface LocationData {
  id: string;
  display_name: string;
  description: string;
  lat: number;
  lon: number;
  category: string;
  accuracy?: number;
  formatted_address?: string;
  street_number?: string;
  street?: string;
  area?: string;
  city?: string;
  lga?: string;
  state?: string;
  country?: string;
  place_types?: string[];
}

export interface RouteData {
  distanceKm: number;
  estimatedMins: number;
  currentTrafficMins: number;
  fareEstimate: {
    low: number;
    high: number;
  };
}

export const LocationService = {

  // Calls GET /locations/search?q=query
  // Returns real Google Places results from backend
  async search(query: string, biasLat?: number, biasLng?: number): Promise<LocationData[]> {
    const normalizedQuery = query?.trim();
    if (!normalizedQuery || normalizedQuery.length < 2) return [];
    try {
      let url = `/locations/search?q=${encodeURIComponent(normalizedQuery)}`;

      // Pass pickup coords so backend biases results to pickup location
      if (Number.isFinite(biasLat) && Number.isFinite(biasLng)) {
        url += `&biasLat=${biasLat}&biasLng=${biasLng}`;
      }

      const results = await api.get<LocationData[]>(url, false);
      return Array.isArray(results) ? results : [];
    } catch (error) {
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
  return location.display_name || location.area || location.city || location.formatted_address || 'Unknown Location';
};

export const getLocationSecondaryText = (location?: LocationData | null): string => {
  if (!location) return '';

  const streetLabel = [location.street_number, location.street].filter(Boolean).join(' ').trim();
  const structured = [streetLabel, location.area, location.city || location.lga, location.state, location.country]
    .filter(Boolean)
    .join(', ');

  return structured || location.description || location.formatted_address || '';
};

export const getLocationAddress = (location?: LocationData | null): string => {
  if (!location) return 'Unknown Location';
  return location.formatted_address || location.description || location.display_name;
};

export const getLocationShortText = (location?: LocationData | null): string => {
  if (!location) return 'Unknown';
  return (
    location.display_name?.split(',')[0] ||
    location.area ||
    location.city ||
    location.lga ||
    location.formatted_address?.split(',')[0] ||
    'Unknown'
  );
};
