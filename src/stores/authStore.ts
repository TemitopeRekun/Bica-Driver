import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/types';
import { clearToken, saveToken } from '@/services/api.service';
import localforage from 'localforage';

interface AuthState {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setCurrentUser: (user: UserProfile | null) => void;
  login: (user: UserProfile, token: string) => Promise<void>;
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

      setInitializing: (val) => set({ isInitializing: val }),

      login: async (user, token) => {
        saveToken(token);
        await localforage.setItem('bicadriver_current_user', user);
        set({ currentUser: user, isAuthenticated: true });
        
        // Initialize notifications and sync token upon login
        const { notificationService } = await import('@/services/NotificationService');
        await notificationService.init();
        await notificationService.syncTokenWithBackend();
      },

      logout: async () => {
        clearToken();
        await localforage.removeItem('bicadriver_current_user');
        set({ currentUser: null, isAuthenticated: false });
      },
    }),
    {
      name: 'bica-auth-storage',
      partialize: (state) => ({ currentUser: state.currentUser, isAuthenticated: state.isAuthenticated }),
    }
  )
);
