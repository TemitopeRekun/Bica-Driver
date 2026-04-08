import { create } from 'zustand';
import { Trip, LocationData, UserProfile } from '../types';

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
  
  // Setters
  setRideState: (state: RideState) => void;
  setRideMilestone: (milestone: RideMilestone) => void;
  setCurrentTripId: (id: string | null) => void;
  setSelectedDriver: (driver: any | null) => void;
  setDriverInfo: (info: any | null) => void;
  setTrackedDriverPos: (pos: [number, number] | null) => void;
  setAvailableDrivers: (drivers: any[]) => void;
  
  resetRide: () => void;
}

export const useRideStore = create<RideStateData>((set) => ({
  rideState: 'IDLE',
  rideMilestone: 'requested',
  currentTripId: null,
  selectedDriver: null,
  driverInfo: null,
  trackedDriverPos: null,
  availableDrivers: [],

  setRideState: (rideState) => set({ rideState }),
  setRideMilestone: (rideMilestone) => set({ rideMilestone }),
  setCurrentTripId: (currentTripId) => set({ currentTripId }),
  setSelectedDriver: (selectedDriver) => set({ selectedDriver }),
  setDriverInfo: (driverInfo) => set({ driverInfo }),
  setTrackedDriverPos: (trackedDriverPos) => set({ trackedDriverPos }),
  setAvailableDrivers: (availableDrivers) => set({ availableDrivers }),

  resetRide: () => set({
    rideState: 'IDLE',
    rideMilestone: 'requested',
    currentTripId: null,
    selectedDriver: null,
    driverInfo: null,
    trackedDriverPos: null,
    availableDrivers: [],
  }),
}));
