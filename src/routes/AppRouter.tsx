import { createHashRouter, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRatingGateStore } from '../stores/ratingGateStore';
import { UserRole } from '@/types';
import GlobalRouteError from '@/components/Common/GlobalRouteError';
import ErrorBoundary from '@/components/Common/ErrorBoundary';

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
import VerificationScreen from '../screens/VerificationScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const RouteErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fallback = (
    <div className="min-h-[400px] flex items-center justify-center p-6 text-center font-display">
       <div className="w-full max-w-sm p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-red-500/20 shadow-2xl">
         <div className="size-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
           <span className="material-symbols-outlined text-3xl filled">error</span>
         </div>
         <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Something went wrong</h2>
         <p className="text-slate-500 text-xs font-bold leading-relaxed mb-8 uppercase tracking-widest">
           An unexpected error occurred in this section.
         </p>
         <button 
           onClick={() => window.location.reload()}
           className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-primary/20"
         >
           Retry
         </button>
       </div>
    </div>
  );
  return <ErrorBoundary fallback={fallback}>{children}</ErrorBoundary>;
};

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
  {
    path: '/verify-email',
    element: <VerificationScreen />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordScreen />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordScreen />,
  },
  // Owner Routes
  {
    path: '/owner',
    element: (
      <ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]} strictOwnerGate>
        <RouteErrorBoundary>
          <RequestRideScreen />
        </RouteErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner/status',
    element: (
      <ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]} strictOwnerGate>
        <RouteErrorBoundary>
          <TripStatusScreen />
        </RouteErrorBoundary>
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
        <RouteErrorBoundary>
          <DriverMainScreen />
        </RouteErrorBoundary>
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
