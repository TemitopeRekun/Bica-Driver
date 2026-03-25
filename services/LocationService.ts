import { api } from './api.service';

export interface LocationData {
  id: string;
  display_name: string;
  description: string;
  lat: number;
  lon: number;
  category: string;
  accuracy?: number;
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
    if (!query || query.trim().length < 2) return [];
    try {
      let url = `/locations/search?q=${encodeURIComponent(query)}`;

      // Pass pickup coords so backend biases results to pickup location
      if (Number.isFinite(biasLat) && Number.isFinite(biasLng)) {
        url += `&biasLat=${biasLat}&biasLng=${biasLng}`;
      }

      const results = await api.get<LocationData[]>(url, false);
      return results;
    } catch (error) {
      console.error('Location search failed:', error);
      return [];
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
