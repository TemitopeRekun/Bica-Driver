import React, { useEffect, useState } from 'react';
import { useConnectivityStore } from '@/stores/connectivityStore';

const BANNER_DEBOUNCE_MS = 2500;

const ConnectivityBanner: React.FC = () => {
  const { isOnline, isSocketConnected, isReconnecting, socketEverConnected, locationStatus } = useConnectivityStore();

  // Debounce both offline and reconnecting banners — avoids false positives from brief signal drops
  const [showDelayedOffline, setShowDelayedOffline] = useState(false);
  const [showDelayedReconnect, setShowDelayedReconnect] = useState(false);
  // Brief "back online" confirmation so users know connectivity was restored
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (!isOnline) {
      timer = setTimeout(() => setShowDelayedOffline(true), BANNER_DEBOUNCE_MS);
    } else {
      if (showDelayedOffline) {
        // Was showing offline — briefly show "back online" confirmation
        setShowDelayedOffline(false);
        setShowBackOnline(true);
        timer = setTimeout(() => setShowBackOnline(false), 2000);
      } else {
        setShowDelayedOffline(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Only show when actively reconnecting after a drop — intentional disconnects (navigation) set isReconnecting=false
    const shouldReconnect = isOnline && socketEverConnected && isReconnecting;
    if (shouldReconnect) {
      timer = setTimeout(() => setShowDelayedReconnect(true), BANNER_DEBOUNCE_MS);
    } else {
      setShowDelayedReconnect(false);
    }
    return () => clearTimeout(timer);
  }, [isOnline, isSocketConnected, isReconnecting, socketEverConnected]);

  const showOffline = showDelayedOffline;
  const showReconnecting = showDelayedReconnect;
  const showLocationIssue = isOnline && locationStatus !== 'available' && locationStatus !== 'unavailable';

  if (!showOffline && !showReconnecting && !showLocationIssue && !showBackOnline) return null;

  let message = '';
  let bgColor = '';
  let icon = '';

  if (showBackOnline) {
    message = 'Back online.';
    bgColor = 'bg-emerald-600';
    icon = 'wifi';
  } else if (showOffline) {
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
