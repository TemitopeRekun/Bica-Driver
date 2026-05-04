import { createHashRouter, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRatingGateStore } from '../stores/ratingGateStore';
import { UserRole } from '@/types';
import GlobalRouteError from '@/components/Common/GlobalRouteError';

// Screens
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import RequestRideScreen from '../screens/RequestRideScreen';
import DriverMainScreen from '../screens/DriverMainScreen';
import DriverActivityScreen from '../screens/DriverActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminDashboardPage from '../screens/AdminDashboardPage';
import OwnerActivityScreen from '../screens/OwnerActivityScreen';
import TripStatusScreen from '../screens/TripStatusScreen';
import LoadingScreen from '../screens/LoadingScreen';
import PaymentCompleteScreen from '../screens/PaymentCompleteScreen';
import RateDriverScreen from '../screens/RateDriverScreen';
import AwaitingPaymentScreen from '../screens/AwaitingPaymentScreen';

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: UserRole[], strictOwnerGate?: boolean, strictDriverGate?: boolean }> = ({ children, roles, strictOwnerGate = false, strictDriverGate = false }) => {
  const { currentUser, isAuthenticated, isInitializing } = useAuthStore();
  const { pendingRating } = useRatingGateStore();
  const location = useLocation();

  if (isInitializing) return <LoadingScreen message="Restoring Secure Session..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && currentUser && !roles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  // Strict Rating Gate for Owners
  if (strictOwnerGate && currentUser?.role === UserRole.OWNER && pendingRating) {
    if (!location.pathname.startsWith('/rate-driver/')) {
      return <Navigate to={`/rate-driver/${pendingRating.tripId}`} replace />;
    }
  }

  // Strict Payment Gate for Drivers is handled by App.tsx bootstrap and TripStatusScreen transitions.
  // If we needed a strict gate here, we would check a global `awaitingPaymentTripId` state.

  return <>{children}</>;
};

const ProfileWrapper: React.FC = () => {
  const { currentUser, logout, updateProfile } = useAuthStore();
  const navigate = useNavigate();

  if (!currentUser) return <Navigate to="/login" replace />;

  const handleUpdateAvatar = async (newAvatar: string) => {
    // Optimistically update or wait for API - here we wait for safety
    await import('@/services/api.service').then(async ({ api }) => {
      await api.patch('/users/profile', { avatarUrl: newAvatar });
    });
    updateProfile({ avatar: newAvatar });
  };

  return (
    <ProfileScreen
      user={currentUser}
      initialRole={currentUser.role}
      onBack={() => navigate(-1)}
      onLogout={logout}
      onUpdateAvatar={handleUpdateAvatar}
    />
  );
};

const DriverActivityWrapper: React.FC = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <DriverActivityScreen
      initialTab="trips"
      onBack={() => navigate(-1)}
      onForcedLogout={logout}
    />
  );
};

const OwnerActivityWrapper: React.FC = () => {
  const navigate = useNavigate();

  return (
    <OwnerActivityScreen
      initialTab="trips"
      onBack={() => navigate(-1)}
    />
  );
};

export const router = createHashRouter([
  {
    path: '/',
    element: <WelcomeScreen />, 
    errorElement: <GlobalRouteError />,
  },
  {
    path: '/login',
    element: <LoginScreen />,
  },
  {
    path: '/register',
    element: <SignUpScreen />,
  },
  {
    path: '/role-selection',
    element: <RoleSelectionScreen />,
  },
  // Owner Routes
  {
    path: '/owner',
    element: (
      <ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]} strictOwnerGate>
        <RequestRideScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner/status',
    element: (
      <ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]} strictOwnerGate>
        <TripStatusScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner/activity',
    element: (
      <ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]} strictOwnerGate>
        <OwnerActivityWrapper />
      </ProtectedRoute>
    ),
  },
  // Driver Routes
  {
    path: '/driver',
    element: (
      <ProtectedRoute roles={[UserRole.DRIVER, UserRole.ADMIN]}>
        <DriverMainScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: '/driver/activity',
    element: (
      <ProtectedRoute roles={[UserRole.DRIVER, UserRole.ADMIN]}>
        <DriverActivityWrapper />
      </ProtectedRoute>
    ),
  },
  // Driver Awaiting Payment Lock
  {
    path: '/driver/awaiting-payment/:tripId',
    element: (
      <ProtectedRoute roles={[UserRole.DRIVER, UserRole.ADMIN]}>
        <AwaitingPaymentScreen />
      </ProtectedRoute>
    ),
  },
  // Admin Routes
  {
    path: '/admin',
    element: (
      <ProtectedRoute roles={[UserRole.ADMIN]}>
        <AdminDashboardPage />
      </ProtectedRoute>
    ),
  },
  // Common
  {
    path: '/profile',
    element: (
      <ProtectedRoute strictOwnerGate>
        <ProfileWrapper />
      </ProtectedRoute>
    ),
  },
  // Rate Driver
  {
    path: '/rate-driver/:tripId',
    element: (
      <ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]}>
        <RateDriverScreen />
      </ProtectedRoute>
    ),
  },
  // Payment redirect handler (public — screen handles its own auth guard)
  {
    path: '/payment/complete',
    element: <PaymentCompleteScreen />,
  },
]);
