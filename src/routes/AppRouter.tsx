import React from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { UserRole } from '@/types';

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
import OwnerActivityScreen from '../screens/OwnerActivityScreen';
import LoadingScreen from '../screens/LoadingScreen';

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: UserRole[] }> = ({ children, roles }) => {
  const { currentUser, isAuthenticated, isInitializing } = useAuthStore();

  if (isInitializing) return <LoadingScreen onComplete={() => {}} />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && currentUser && !roles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const router = createHashRouter([
  {
    path: '/',
    element: <WelcomeScreen />, 
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
      <ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]}>
        <RequestRideScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner/activity',
    element: (
      <ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]}>
        <OwnerActivityScreen initialTab="trips" onBack={() => {}} />
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
        <DriverActivityScreen initialTab="trips" onBack={() => {}} onForcedLogout={() => {}} />
      </ProtectedRoute>
    ),
  },
  // Admin Routes
  {
    path: '/admin',
    element: (
      <ProtectedRoute roles={[UserRole.ADMIN]}>
        <AdminDashboardScreen 
          users={[]} 
          trips={[]} 
          pendingPayments={[]} 
          paymentHistory={[]} 
          settings={{} as any} 
          isLoading={false} 
          error={null} 
          onUpdateStatus={() => {}} 
          onBlockUser={() => {}} 
          onRetrySubAccount={() => {}} 
          onUpdateSettings={() => {}} 
          onRetry={() => {}} 
          onBack={() => {}} 
          onSimulate={() => {}} 
          onForcedLogout={() => {}}
        />
      </ProtectedRoute>
    ),
  },
  // Common
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <ProfileScreen user={null as any} initialRole={UserRole.UNSET} onBack={() => {}} onLogout={() => {}} onUpdateAvatar={() => {}} />
      </ProtectedRoute>
    ),
  },
]);
