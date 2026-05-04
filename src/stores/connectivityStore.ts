import { create } from 'zustand';

export type LocationStatus = 'available' | 'denied' | 'timeout' | 'unavailable';

interface ConnectivityState {
  isOnline: boolean;
  isSocketConnected: boolean;
  isReconnecting: boolean;
  lastSyncError: string | null;
  locationStatus: LocationStatus;
  
  setOnline: (status: boolean) => void;
  setSocketStatus: (connected: boolean, reconnecting: boolean) => void;
  setSyncError: (error: string | null) => void;
  setLocationStatus: (status: LocationStatus) => void;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: navigator.onLine,
  isSocketConnected: false,
  isReconnecting: false,
  lastSyncError: null,
  locationStatus: 'available',

  setOnline: (status) => set({ isOnline: status }),
  setSocketStatus: (connected, reconnecting) => set({ 
    isSocketConnected: connected, 
    isReconnecting: reconnecting 
  }),
  setSyncError: (error) => set({ lastSyncError: error }),
  setLocationStatus: (status) => set({ locationStatus: status }),
}));
