import React from 'react';
import { useConnectivityStore } from '@/stores/connectivityStore';

const ConnectivityBanner: React.FC = () => {
  const { isOnline, isSocketConnected, isReconnecting, locationStatus } = useConnectivityStore();

  const showOffline = !isOnline;
  const showReconnecting = isOnline && (!isSocketConnected || isReconnecting);
  const showLocationIssue = isOnline && locationStatus !== 'available';

  if (!showOffline && !showReconnecting && !showLocationIssue) return null;

  let message = '';
  let bgColor = '';
  let icon = '';

  if (showOffline) {
    message = 'You are offline. Please check your internet connection.';
    bgColor = 'bg-red-500';
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
      message = 'GPS signal is weak. Live tracking may be delayed.';
      bgColor = 'bg-amber-600';
      icon = 'gps_fixed';
    }
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] ${bgColor} text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg animate-in slide-in-from-top duration-300`}>
      <span className={`material-symbols-outlined text-lg ${showReconnecting ? 'animate-spin' : ''}`}>
        {icon}
      </span>
      <p className="text-[10px] font-black uppercase tracking-widest">{message}</p>
    </div>
  );
};

export default ConnectivityBanner;
