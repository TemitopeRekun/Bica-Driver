import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile } from '@/types';
import { clearToken, saveToken, saveRefreshToken, clearRefreshToken, api } from '@/services/api.service';
import { telemetry } from '@/services/TelemetryService';
import localforage from 'localforage';
import { authForageStorage } from '@/utils/storage';

interface AuthState {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setCurrentUser: (user: UserProfile | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  login: (user: UserProfile, token: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  setInitializing: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,
      isInitializing: true,

      setCurrentUser: (user) => set({ 
        currentUser: user, 
        isAuthenticated: !!user 
      }),

      updateProfile: (updates) => set((state) => ({
        currentUser: state.currentUser ? { ...state.currentUser, ...updates } : null
      })),

      setInitializing: (val) => set({ isInitializing: val }),

      login: async (user, token, refreshToken?: string) => {
        // Clear any stale ride data that may belong to a previous user on this device
        const { useRideStore } = await import('./rideStore');
        useRideStore.getState().resetRide();
        // 🛡️ Stamp the incoming user's identity immediately after reset.
        // This ensures the session guard in RequestRideScreen always has a valid
        // user reference even before syncCurrentRide() runs or returns a trip.
        // Without this, lastUserId stays null and the guard never fires, meaning
        // stale persisted rideStore state from a previous session could bleed through.
        useRideStore.getState().setLastUserId(user.id);

        saveToken(token);
        if (refreshToken) saveRefreshToken(refreshToken);
        await localforage.setItem('bicadriver_current_user', user);
        set({ currentUser: user, isAuthenticated: true });
        
        // Initialize notifications and sync token upon login
        const { notificationService } = await import('@/services/NotificationService');
        await notificationService.init();
        await notificationService.syncTokenWithBackend();
      },

      logout: async () => {
        try {
          // Trigger optional backend logout to invalidate remote session if supported
          await api.post('/auth/logout').catch(() => {});
        } catch (e) {}

        clearToken();
        clearRefreshToken();
        await localforage.removeItem('bicadriver_current_user');
        set({ currentUser: null, isAuthenticated: false });
        
        telemetry.info('User logged out successfully');
        
        // 🛡️ Clear persistent ride state to prevent data leakage between users
        const { useRideStore } = await import('./rideStore');
        useRideStore.getState().resetRide();

        // Ensure the screen is cleared and sockets in hooks are disconnected by navigation
        window.location.hash = '/login';
      },
    }),
    {
      name: 'bica-auth-storage',
      storage: createJSONStorage(() => authForageStorage),
      partialize: (state) => ({ currentUser: state.currentUser, isAuthenticated: state.isAuthenticated }),
    }
  )
);
