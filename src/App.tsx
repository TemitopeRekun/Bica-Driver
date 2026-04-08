import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import localforage from 'localforage';

// Stores & Config
import { router } from './routes/AppRouter';
import { useAuthStore } from './stores/authStore';
import { useSettingsStore } from './stores/settingsStore';
import { useUIStore } from './stores/uiStore';
import { setOnUnauthorizedListener, api } from '@/services/api.service';
import { mapUser } from '@/mappers/appMappers';
import { CapacitorService } from '@/services/CapacitorService';
import { UserRole } from '@/types';

// Components
import SupportChatbot from '@/components/SupportChatbot';
import { ToastProvider as ToastContainer } from '@/components/Toast/ToastProvider';

const App: React.FC = () => {
  const { currentUser, setCurrentUser, logout, isAuthenticated, setInitializing, isInitializing } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const { addToast } = useUIStore();
  const { initStatusBar } = CapacitorService;

  useEffect(() => {
    initStatusBar();
    
    // Initialize notifications if already authenticated
    if (isAuthenticated) {
      import('@/services/NotificationService').then(({ notificationService }) => {
        notificationService.init();
        notificationService.syncTokenWithBackend();
      });
    }
    
    // Centralized 401 listener
    setOnUnauthorizedListener((message) => {
      addToast(message || 'Session expired', 'error');
      logout();
    });

    const initializeApp = async () => {
      try {
        // 1. Load system settings
        await loadSettings();

        // 2. Check for saved session
        const savedUser = await localforage.getItem<any>('bicadriver_current_user');
        if (savedUser && savedUser.id !== 'admin_preview') {
          try {
            const freshUser = await api.get<any>('/auth/me');
            const mapped = mapUser(freshUser);
            setCurrentUser(mapped);
            await localforage.setItem('bicadriver_current_user', mapped);
          } catch (e) {
            console.warn('Session restoration failed:', e);
            await logout();
          }
        }
      } catch (e) {
        console.error('Core init failed', e);
      } finally {
        setInitializing(false);
      }
    };

    initializeApp();
  }, []);

  return (
    <div className="flex justify-center items-start min-h-screen bg-slate-950">
      <div className="w-full max-w-md min-h-screen bg-background-light dark:bg-background-dark shadow-2xl overflow-x-hidden relative">
        
        {/* The Main Router - Logic moved to screens and Router hooks */}
        <RouterProvider router={router} />

        {/* Global Overlays */}
        {currentUser && (
          <SupportChatbot user={currentUser} />
        )}
        
        {/* Toast rendering is now handled by UIStore + ToastContainer */}
      </div>
    </div>
  );
};

export default App;
