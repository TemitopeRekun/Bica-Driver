import { create } from 'zustand';

export type LocationStatus = 'available' | 'denied' | 'timeout' | 'unavailable';

interface ConnectivityState {
  isOnline: boolean;
  isSocketConnected: boolean;
  isReconnecting: boolean;
  socketEverConnected: boolean;   // True once a socket has connected at least once
  lastSyncError: string | null;
  locationStatus: LocationStatus;
  
  setOnline: (status: boolean) => void;
  setSocketStatus: (connected: boolean, reconnecting: boolean) => void;
  setSyncError: (error: string | null) => void;
  setLocationStatus: (status: LocationStatus) => void;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: true, // Assume online — navigator.onLine is unreliable on Android WebViews at boot
  isSocketConnected: false,
  isReconnecting: false,
  socketEverConnected: false,    // Starts false — no socket until login
  lastSyncError: null,
  locationStatus: 'available',

  setOnline: (status) => set({ isOnline: status }),
  setSocketStatus: (connected, reconnecting) => set((state) => ({ 
    isSocketConnected: connected, 
    isReconnecting: reconnecting,
    // Once true, stays true for the session — socket was opened at least once
    socketEverConnected: state.socketEverConnected || connected,
  })),
  setSyncError: (error) => set({ lastSyncError: error }),
  setLocationStatus: (status) => set({ locationStatus: status }),
}));
