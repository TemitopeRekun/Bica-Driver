import React, { useEffect, useState } from 'react';
import { useConnectivityStore } from '@/stores/connectivityStore';

const ConnectivityBanner: React.FC = () => {
  const { isOnline, isSocketConnected, isReconnecting, socketEverConnected, locationStatus } = useConnectivityStore();

  // Delay showing the reconnecting banner by 2s to avoid flashing during fast reconnects
  const [showDelayedReconnect, setShowDelayedReconnect] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const shouldReconnect = isOnline && socketEverConnected && (!isSocketConnected || isReconnecting);
    if (shouldReconnect) {
      // Only show after 2 seconds — avoids flash on page load or quick reconnects
      timer = setTimeout(() => setShowDelayedReconnect(true), 2000);
    } else {
      setShowDelayedReconnect(false);
    }
    return () => clearTimeout(timer);
  }, [isOnline, isSocketConnected, isReconnecting, socketEverConnected]);

  const showOffline = !isOnline;
  // Only warn about socket if we were previously connected (i.e. user is logged in)
  const showReconnecting = showDelayedReconnect;
  const showLocationIssue = isOnline && locationStatus !== 'available' && locationStatus !== 'unavailable';

  if (!showOffline && !showReconnecting && !showLocationIssue) return null;

  let message = '';
  let bgColor = '';
  let icon = '';

  if (showOffline) {
    message = 'No internet connection.';
    bgColor = 'bg-red-600';
    icon = 'cloud_off';
  } else if (showReconnecting) {
    message = 'Reconnecting to live server...';
    bgColor = 'bg-amber-500';
    icon = 'sync';
  } else if (showLocationIssue) {
    if (locationStatus === 'denied') {
      message = 'Location permission required for live tracking.';
      bgColor = 'bg-rose-600';
      icon = 'location_off';
    } else {
      message = 'GPS signal is weak. Tracking may be delayed.';
      bgColor = 'bg-amber-600';
      icon = 'gps_fixed';
    }
  }

  return (
    // Uses fixed positioning to float at the very top of the app container
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[100] ${bgColor} text-white px-4 py-3 flex items-center justify-center gap-3 shadow-lg shadow-black/20 backdrop-blur-md animate-slide-down`}
    >
      <span className={`material-symbols-outlined text-sm ${showReconnecting ? 'animate-spin' : ''}`}>
        {icon}
      </span>
      <p className="text-[10px] font-black uppercase tracking-widest">{message}</p>
    </div>
  );
};

export default ConnectivityBanner;
