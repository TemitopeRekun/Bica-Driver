import React, { useState } from 'react';
import { useRidesAuthority } from '@/hooks/useRidesAuthority';
import LoadingScreen from '@/screens/LoadingScreen';

/**
 * 🛡️ AUTHORITY GATE
 * Enforces /rides/current authority before showing a dashboard.
 * If user has an active trip, redirects automatically.
 * If fetch fails and no cache, shows error with retry.
 * Otherwise shows the component.
 */
export const AuthorityGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRide, isLoading, error } = useRidesAuthority({ autoRedirect: true });
  const [isRetrying, setIsRetrying] = useState(false);

  if (isLoading || isRetrying) {
    return <LoadingScreen message="Checking active trips..." />;
  }

  // If we got an error AND have no cached ride data, show error UI instead of silently rendering dashboard
  if (error && !activeRide && !isRetrying) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-8 text-center shadow-lg border border-orange-500/30">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            Connection Issue
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            We couldn't verify your active trips. Please check your connection and try again.
          </p>
          <button
            onClick={() => {
              setIsRetrying(true);
              setTimeout(() => window.location.reload(), 500);
            }}
            className="w-full h-12 bg-primary text-white rounded-xl font-bold text-sm uppercase active:scale-95 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If we get here without redirecting, no active trip or it wasn't redirectable
  return <>{children}</>;
};

