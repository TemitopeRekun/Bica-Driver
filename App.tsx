import React, { useState, useEffect, useRef } from 'react';
import localforage from 'localforage';
import { AppScreen, UserRole, UserProfile, ApprovalStatus, Trip, SystemSettings } from './types';
import WelcomeScreen from './screens/WelcomeScreen';
import SignUpScreen from './screens/SignUpScreen';
import LoginScreen from './screens/LoginScreen';
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import RequestRideScreen from './screens/RequestRideScreen';
import DriverMainScreen from './screens/DriverMainScreen';
import ProfileScreen from './screens/ProfileScreen';
import AdminDashboardScreen from './screens/AdminDashboardScreen';
import SupportChatbot from './components/SupportChatbot';
import { IMAGES } from './constants';
import { CapacitorService } from './services/CapacitorService';
import LoadingScreen from './screens/LoadingScreen';
import { api, saveToken, clearToken } from './services/api.service';
import { mapUser } from './mappers/appMappers';
import { useAdminDashboard } from './hooks/useAdminDashboard';
import { useAdminRealtime } from './hooks/useAdminRealtime';
import { useOwnerVisibleDrivers } from './hooks/useOwnerVisibleDrivers';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.LOADING);
  const [selectedSignupRole, setSelectedSignupRole] = useState<UserRole>(UserRole.UNSET);

  // Settings loaded from backend
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    baseFare: 500,
    pricePerKm: 100,
    timeRate: 50,
    commission: 25,
    autoApprove: false,
  });
  const {
    adminUsers,
    adminTrips,
    adminPendingPayments,
    adminPaymentHistory,
    adminDashboardLoading,
    adminDashboardError,
    setAdminDashboardError,
    loadAdminDashboard,
  } = useAdminDashboard({
    onSettingsLoaded: (settings) => {
      setSystemSettings(prev => ({ ...prev, ...settings }));
    },
  });
  const { ownerVisibleDrivers } = useOwnerVisibleDrivers({
    enabled: currentScreen === AppScreen.MAIN_REQUEST,
    role: currentUser?.role,
  });

  // Initialize — check for existing session
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load settings from backend (public endpoint)
        try {
          const settings = await api.get<SystemSettings>('/settings', false);
          setSystemSettings(settings);
        } catch (e) {
          console.warn('Could not load settings, using defaults');
        }

        // Check for saved session
        const savedUser = await localforage.getItem<UserProfile>('bicadriver_current_user');
        if (savedUser && typeof savedUser === 'object' && savedUser.id !== 'admin_preview') {
          // Verify the token is still valid
          try {
            const freshUser = await api.get<any>('/auth/me');
            const mapped = mapUser(freshUser);
            setCurrentUser(mapped);
            await localforage.setItem('bicadriver_current_user', mapped);
            setCurrentScreen(
              mapped.role === UserRole.ADMIN
                ? AppScreen.ADMIN_DASHBOARD
                : mapped.role === UserRole.DRIVER
                  ? AppScreen.DRIVER_DASHBOARD
                  : AppScreen.MAIN_REQUEST,
            );
          } catch {
            // Token expired — clear session
            clearToken();
            await localforage.removeItem('bicadriver_current_user');
          }
        }
      } catch (e) {
        console.error('Init failed', e);
      } finally {
        setIsInitializing(false);
      }
    };
    initializeApp();
  }, []);

  useEffect(() => {
    CapacitorService.initStatusBar();
  }, []);

  useEffect(() => {
    if (currentScreen !== AppScreen.ADMIN_DASHBOARD || currentUser?.role !== UserRole.ADMIN) return;

    loadAdminDashboard().catch((error: any) => {
      console.error('Failed to load admin dashboard:', error);
      setAdminDashboardError(error.message || 'Could not load admin dashboard.');
    });
  }, [currentScreen, currentUser?.role]);

  useAdminRealtime({
    enabled: currentScreen === AppScreen.ADMIN_DASHBOARD && currentUser?.role === UserRole.ADMIN,
    adminId: currentUser?.id,
    onRefresh: loadAdminDashboard,
  });

  const navigateTo = (screen: AppScreen) => {
    CapacitorService.triggerHaptic();
    setCurrentScreen(screen);
  };

  const handleStart = () => navigateTo(AppScreen.ROLE_SELECTION);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedSignupRole(role);
    navigateTo(AppScreen.SIGN_UP);
  };

  const handleSignUpComplete = async (userData: Partial<UserProfile>) => {
    try {
      const body: any = {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: userData.password,
        role: selectedSignupRole,
        // Owner fields
        carType: userData.carType,
        carModel: userData.carModel,
        carYear: userData.carYear,
        gender: userData.gender,
        address: userData.address,
        nationality: userData.nationality,
        age: userData.age,
        // Driver fields
        nin: userData.nin,
        transmission: userData.transmission,
        licenseImageUrl: userData.licenseImage,
        ninImageUrl: userData.ninImage,
        selfieImageUrl: userData.selfieImage,
        backgroundCheckAccepted: userData.backgroundCheckAccepted,
        bankName: userData.bankName,
        bankCode: userData.bankCode,
        accountNumber: userData.accountNumber,
        accountName: userData.accountName,
      };

      const response = await api.post<{ token: string; user: any }>(
        '/auth/register',
        body,
        false,
      );

      saveToken(response.token);
      const mapped = mapUser(response.user);
      setCurrentUser(mapped);
      await localforage.setItem('bicadriver_current_user', mapped);

      if (mapped.role === UserRole.DRIVER) {
        navigateTo(AppScreen.DRIVER_DASHBOARD);
      } else {
        navigateTo(AppScreen.MAIN_REQUEST);
      }
    } catch (error: any) {
      alert(error.message || 'Registration failed. Please try again.');
    }
  };

  const handleLogin = async (email?: string, password?: string) => {
    if (!email || !password) {
      alert('Please enter both email and password.');
      return;
    }

    // Admin shortcut — still hits real backend
    try {
      const response = await api.post<{ token: string; user: any }>(
        '/auth/login',
        { email, password },
        false,
      );

      saveToken(response.token);
      const mapped = mapUser(response.user);
      setCurrentUser(mapped);
      await localforage.setItem('bicadriver_current_user', mapped);

      if (mapped.role === UserRole.ADMIN) {
        navigateTo(AppScreen.ADMIN_DASHBOARD);
      } else if (mapped.role === UserRole.DRIVER) {
        if (mapped.approvalStatus === 'REJECTED') {
          alert('Login Denied: Your driver application was rejected. Please contact support.');
          clearToken();
          return;
        }
        navigateTo(AppScreen.DRIVER_DASHBOARD);
      } else {
        navigateTo(AppScreen.MAIN_REQUEST);
      }
    } catch (error: any) {
      alert(error.message || 'Invalid credentials. Please try again.');
    }
  };

  const handleLogout = async () => {
    clearToken();
    setCurrentUser(null);
    await localforage.removeItem('bicadriver_current_user');
    navigateTo(AppScreen.WELCOME);
  };

  // Admin simulate — kept for admin dashboard functionality
  const handleSimulate = (role: UserRole) => {
    const adminUser: UserProfile = {
      id: 'admin_preview',
      name: 'Admin Preview',
      email: 'admin@bicadrive.app',
      phone: '+000 000 0000',
      role: role,
      rating: 5.0,
      trips: 0,
      avatar: role === UserRole.DRIVER ? IMAGES.DRIVER_CARD : IMAGES.USER_AVATAR,
      approvalStatus: 'APPROVED',
      backgroundCheckAccepted: true,
      walletBalance: 500000,
      carType: 'Admin Vehicle',
      gender: 'N/A',
      address: 'Admin HQ',
      nationality: 'Global',
      age: '99',
      transmission: 'Automatic',
      isBlocked: false,
      currentLocation: { lat: 6.5244, lng: 3.3792 },
    };
    setCurrentUser(adminUser);
    navigateTo(role === UserRole.DRIVER ? AppScreen.DRIVER_DASHBOARD : AppScreen.MAIN_REQUEST);
  };

  // Admin actions — call real backend
  const handleUpdateDriverStatus = async (userId: string, status: ApprovalStatus) => {
    try {
      await api.patch(`/users/${userId}/approval`, { approvalStatus: status });
      if (currentUser?.role === UserRole.ADMIN) {
        await loadAdminDashboard();
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      await api.patch(`/users/${userId}/block`, { isBlocked: blocked });
      if (currentUser?.role === UserRole.ADMIN) {
        await loadAdminDashboard();
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleUpdateSettings = async (newSettings: SystemSettings) => {
    try {
      await api.patch('/settings', newSettings);
      setSystemSettings(newSettings);
      if (currentUser?.role === UserRole.ADMIN) {
        await loadAdminDashboard();
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAddTrip = (trip: Trip) => {
    // Trips are now persisted in backend — this is a no-op
    // History is fetched fresh from GET /rides/history
  };

  const handleUpdateEarnings = (amount: number) => {
    // Wallet is now managed by backend — update local display only
    if (!currentUser) return;
    setCurrentUser(prev => prev ? { ...prev, walletBalance: (prev.walletBalance || 0) + amount } : null);
  };

  const handleUpdateDriverOnlineStatus = (isOnline: boolean) => {
    setCurrentUser((prev) => {
      if (!prev || prev.role !== UserRole.DRIVER) return prev;
      const nextUser = { ...prev, isOnline };
      void localforage.setItem('bicadriver_current_user', nextUser);
      return nextUser;
    });
  };

  const resolveAvatarUser = (response: any, existingUser: UserProfile): UserProfile | null => {
    const backendUser = response?.user || response?.profile;
    if (backendUser && typeof backendUser === 'object') {
      return {
        ...existingUser,
        ...mapUser({ ...existingUser, ...backendUser }),
      };
    }

    const avatarUrl = response?.avatarUrl;
    if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
      return {
        ...existingUser,
        avatar: avatarUrl,
        avatarUrl,
      };
    }

    return null;
  };

  const applyUpdatedAvatar = (nextUser: UserProfile) => {
    setCurrentUser(nextUser);
    void localforage.setItem('bicadriver_current_user', nextUser);
  };

  const handleUpdateAvatar = async (image: string) => {
    if (!currentUser) {
      throw new Error('You must be logged in to update your avatar.');
    }

    const tryRequest = async (fn: () => Promise<any>) => {
      const response = await fn();
      const nextUser = resolveAvatarUser(response, currentUser);
      if (!nextUser) {
        throw new Error('Avatar upload completed but no avatarUrl was returned.');
      }

      applyUpdatedAvatar(nextUser);
    };

    try {
      await tryRequest(() => api.post('/users/upload-avatar', { image }));
    } catch (postError: any) {
      try {
        await tryRequest(() => api.patch('/users/avatar', { image }));
      } catch (patchError: any) {
        throw new Error(
          patchError.message || postError.message || 'Could not update your avatar.',
        );
      }
    }
  };

  const renderScreen = (screen: AppScreen) => {
    switch (screen) {
      case AppScreen.LOADING:
        return <LoadingScreen onComplete={() => navigateTo(AppScreen.WELCOME)} />;
      case AppScreen.WELCOME:
        return <WelcomeScreen onCreateAccount={handleStart} onLogin={() => navigateTo(AppScreen.LOGIN)} />;
      case AppScreen.ROLE_SELECTION:
        return <RoleSelectionScreen onSelectRole={handleRoleSelect} onBack={() => navigateTo(AppScreen.WELCOME)} onGoToLogin={() => navigateTo(AppScreen.LOGIN)} />;
      case AppScreen.SIGN_UP:
        return <SignUpScreen role={selectedSignupRole} onSignUp={handleSignUpComplete} onBack={() => navigateTo(AppScreen.ROLE_SELECTION)} onGoToLogin={() => navigateTo(AppScreen.LOGIN)} />;
      case AppScreen.LOGIN:
        return <LoginScreen onLogin={handleLogin} onBack={() => navigateTo(AppScreen.WELCOME)} onGoToSignUp={handleStart} />;
      case AppScreen.MAIN_REQUEST:
        return (
          <RequestRideScreen
            settings={systemSettings}
            onOpenProfile={() => navigateTo(AppScreen.PROFILE)}
            onBack={handleLogout}
            onRideComplete={handleAddTrip}
            currentUser={currentUser}
            allUsers={ownerVisibleDrivers}
          />
        );
      case AppScreen.DRIVER_DASHBOARD:
        return (
          <DriverMainScreen
            user={currentUser}
            onOpenProfile={() => navigateTo(AppScreen.PROFILE)}
            onBack={handleLogout}
            onUpdateEarnings={handleUpdateEarnings}
            onUpdateOnlineStatus={handleUpdateDriverOnlineStatus}
            onRideComplete={handleAddTrip}
          />
        );
      case AppScreen.PROFILE:
        if (!currentUser) return <WelcomeScreen onCreateAccount={handleStart} onLogin={() => navigateTo(AppScreen.LOGIN)} />;
        return (
          <ProfileScreen
            user={currentUser}
            initialRole={currentUser.role}
            onBack={() => currentUser.role === UserRole.DRIVER ? navigateTo(AppScreen.DRIVER_DASHBOARD) : navigateTo(AppScreen.MAIN_REQUEST)}
            onLogout={handleLogout}
            onUpdateAvatar={handleUpdateAvatar}
          />
        );
      case AppScreen.ADMIN_DASHBOARD:
        return (
          <AdminDashboardScreen
            users={adminUsers}
            trips={adminTrips}
            pendingPayments={adminPendingPayments}
            paymentHistory={adminPaymentHistory}
            settings={systemSettings}
            isLoading={adminDashboardLoading}
            error={adminDashboardError}
            onUpdateStatus={handleUpdateDriverStatus}
            onBlockUser={handleBlockUser}
            onUpdateSettings={handleUpdateSettings}
            onRetry={loadAdminDashboard}
            onBack={() => navigateTo(AppScreen.WELCOME)}
            onSimulate={handleSimulate}
          />
        );
      default:
        return <WelcomeScreen onCreateAccount={handleStart} onLogin={() => navigateTo(AppScreen.LOGIN)} />;
    }
  };

  const isDriverProfileOverlay = currentScreen === AppScreen.PROFILE && currentUser?.role === UserRole.DRIVER;
  const baseScreen = isDriverProfileOverlay ? AppScreen.DRIVER_DASHBOARD : currentScreen;

  return (
    <div className="flex justify-center items-start min-h-screen bg-slate-950">
      <div className="w-full max-w-md min-h-screen bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden relative">
        <div key={baseScreen} className="h-full w-full screen-transition overflow-hidden">
          {renderScreen(baseScreen)}
        </div>
        {isDriverProfileOverlay && currentUser && (
          <div className="absolute inset-0 z-30 bg-background-light dark:bg-background-dark overflow-hidden">
            <ProfileScreen
              user={currentUser}
              initialRole={currentUser.role}
              onBack={() => navigateTo(AppScreen.DRIVER_DASHBOARD)}
              onLogout={handleLogout}
              onUpdateAvatar={handleUpdateAvatar}
            />
          </div>
        )}
        {currentUser && currentScreen !== AppScreen.ADMIN_DASHBOARD && (
          <SupportChatbot user={currentUser} />
        )}
      </div>
    </div>
  );
};

export default App;
