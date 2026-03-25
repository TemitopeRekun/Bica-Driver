import React, { useState, useEffect } from 'react';
import localforage from 'localforage';
import { AppScreen, UserRole, UserProfile, ApprovalStatus, Trip, Payout, SystemSettings } from './types';
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

// Helper to map backend user to frontend UserProfile shape
const mapUser = (backendUser: any): UserProfile => ({
  ...backendUser,
  // Map backend field names to frontend field names
  trips: backendUser.totalTrips ?? 0,
  avatar: backendUser.avatarUrl || (backendUser.role === UserRole.DRIVER ? IMAGES.DRIVER_CARD : IMAGES.USER_AVATAR),
  licenseImage: backendUser.licenseImageUrl,
  selfieImage: backendUser.selfieImageUrl,
  ninImage: backendUser.ninImageUrl,
  currentLocation: backendUser.locationLat
    ? { lat: backendUser.locationLat, lng: backendUser.locationLng }
    : undefined,
});

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.LOADING);
  const [selectedSignupRole, setSelectedSignupRole] = useState<UserRole>(UserRole.UNSET);

  // Settings loaded from backend
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    baseFare: 500,
    pricePerKm: 100,
    commission: 25,
    autoApprove: false,
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
            setCurrentScreen(mapped.role === UserRole.DRIVER ? AppScreen.DRIVER_DASHBOARD : AppScreen.MAIN_REQUEST);
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
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      await api.patch(`/users/${userId}/block`, { isBlocked: blocked });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleUpdateSettings = async (newSettings: SystemSettings) => {
    try {
      await api.patch('/settings', newSettings);
      setSystemSettings(newSettings);
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

  const handleRequestPayout = async (amount: number) => {
    // No-op — payout flow now goes through Monnify automatically
    // Wallet balance reflects earnings, not a withdrawable balance
    alert('Your earnings are paid directly to your registered bank account after each trip.');
  };

  const renderScreen = () => {
    switch (currentScreen) {
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
            allUsers={[]}
          />
        );
      case AppScreen.DRIVER_DASHBOARD:
        return (
          <DriverMainScreen
            user={currentUser}
            onOpenProfile={() => navigateTo(AppScreen.PROFILE)}
            onBack={handleLogout}
            onUpdateEarnings={handleUpdateEarnings}
            onRequestPayout={handleRequestPayout}
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
            onUpdateAvatar={(a) => setCurrentUser(prev => prev ? { ...prev, avatar: a } : null)}
          />
        );
      case AppScreen.ADMIN_DASHBOARD:
        return (
          <AdminDashboardScreen
            users={[]}
            trips={[]}
            payouts={[]}
            settings={systemSettings}
            onUpdateStatus={handleUpdateDriverStatus}
            onBlockUser={handleBlockUser}
            onApprovePayout={async (id) => { /* handled in admin screen */ }}
            onUpdateSettings={handleUpdateSettings}
            onBack={() => navigateTo(AppScreen.WELCOME)}
            onSimulate={handleSimulate}
          />
        );
      default:
        return <WelcomeScreen onCreateAccount={handleStart} onLogin={() => navigateTo(AppScreen.LOGIN)} />;
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen bg-slate-950">
      <div className="w-full max-w-md min-h-screen bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden relative">
        <div key={currentScreen} className="h-full w-full screen-transition overflow-hidden">
          {renderScreen()}
        </div>
        {currentUser && currentScreen !== AppScreen.ADMIN_DASHBOARD && (
          <SupportChatbot user={currentUser} />
        )}
      </div>
    </div>
  );
};

export default App;