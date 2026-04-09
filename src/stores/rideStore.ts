import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';
import { Trip, LocationData, UserProfile } from '../types';

// Configure localforage for production reliability
localforage.config({
  name: 'BicaDriver',
  storeName: 'ride_state'
});

// Custom storage bridge for localforage
const forageStorage = {
  getItem: async (name: string) => {
    const value = await localforage.getItem(name);
    return value ? JSON.stringify(value) : null;
  },
  setItem: async (name: string, value: string) => {
    await localforage.setItem(name, JSON.parse(value));
  },
  removeItem: async (name: string) => {
    await localforage.removeItem(name);
  },
};

export type RideState = 'IDLE' | 'SEARCHING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SCHEDULED';
export type RideMilestone = 'requested' | 'scheduled' | 'assigned' | 'arrived' | 'in_progress' | 'completed';

interface RideStateData {
  rideState: RideState;
  rideMilestone: RideMilestone;
  currentTripId: string | null;
  selectedDriver: any | null;
  driverInfo: any | null;
  trackedDriverPos: [number, number] | null;
  availableDrivers: any[];
  completedTripData: any | null;
  routePreview: { distanceKm: number; estimatedMins: number } | null;
  
  // Setters
  setRideState: (state: RideState) => void;
  setRideMilestone: (milestone: RideMilestone) => void;
  setCurrentTripId: (id: string | null) => void;
  setSelectedDriver: (driver: any | null) => void;
  setDriverInfo: (info: any | null) => void;
  setTrackedDriverPos: (pos: [number, number] | null) => void;
  setAvailableDrivers: (drivers: any[]) => void;
  setCompletedTripData: (data: any | null) => void;
  setRoutePreview: (route: { distanceKm: number; estimatedMins: number } | null) => void;
  
  resetRide: () => void;
}

export const useRideStore = create<RideStateData>()(
  persist(
    (set) => ({
      rideState: 'IDLE',
      rideMilestone: 'requested',
      currentTripId: null,
      selectedDriver: null,
      driverInfo: null,
      trackedDriverPos: null,
      availableDrivers: [],
      completedTripData: null,
      routePreview: null,

      setRideState: (rideState) => set({ rideState }),
      setRideMilestone: (rideMilestone) => set({ rideMilestone }),
      setCurrentTripId: (currentTripId) => set({ currentTripId }),
      setSelectedDriver: (selectedDriver) => set({ selectedDriver }),
      setDriverInfo: (driverInfo) => set({ driverInfo }),
      setTrackedDriverPos: (trackedDriverPos) => set({ trackedDriverPos }),
      setAvailableDrivers: (availableDrivers) => set({ availableDrivers }),
      setCompletedTripData: (completedTripData) => set({ completedTripData }),
      setRoutePreview: (routePreview) => set({ routePreview }),

      resetRide: () => set({
        rideState: 'IDLE',
        rideMilestone: 'requested',
        currentTripId: null,
        selectedDriver: null,
        driverInfo: null,
        trackedDriverPos: null,
        availableDrivers: [],
        completedTripData: null,
        routePreview: null,
      }),
    }),
    {
      name: 'ride-storage',
      storage: createJSONStorage(() => forageStorage),
      // Only persist critical live state, skip volatile data like availableDrivers
      partialize: (state) => ({
        rideState: state.rideState,
        rideMilestone: state.rideMilestone,
        currentTripId: state.currentTripId,
        driverInfo: state.driverInfo,
        trackedDriverPos: state.trackedDriverPos,
        completedTripData: state.completedTripData,
      }),
    }
  )
);
