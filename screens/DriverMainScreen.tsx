
import React, { useState, useEffect, useRef } from 'react';
import InteractiveMap from '../components/InteractiveMap';
import { CapacitorService } from '../services/CapacitorService';
import { DriverActivityTab, UserProfile, Trip, WalletSummary } from '../types';
import { api } from '../services/api.service';
import { IMAGES } from '@/constants';
import { DriverRideRequest, useDriverRealtime } from '../hooks/useDriverRealtime';
import TripProgressTimeline from '../components/Driver/TripProgressTimeline';
import { useToast } from '../hooks/useToast';

type RidePhase = 'pickup' | 'arrived' | 'trip' | 'completed';

interface DriverMainScreenProps {
  user: UserProfile | null;
  onOpenProfile: () => void;
  onOpenActivity: (tab: DriverActivityTab) => void;
  onBack: () => void;
  onForcedLogout: (message?: string) => void;
  onUpdateEarnings: (amount: number) => void;
  onUpdateOnlineStatus: (isOnline: boolean) => void;
  onRideComplete: (trip: Trip) => void;
}

import { CameraSource, CameraDirection } from '@capacitor/camera';


// Outside DriverMainScreen  not recreated on every render
const CountUpTimer: React.FC = () => {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const display = mins > 0
    ? `${mins}m${secs.toString().padStart(2, '0')}s`
    : `${secs}s`;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="px-2 py-1 rounded-xl bg-primary/20 border border-primary/30">
        <span className="text-xs font-black text-primary">{display}</span>
      </div>
      <span className="text-[10px] text-slate-400">waiting</span>
    </div>
  );
};

// ... existing imports

const DriverMainScreen: React.FC<DriverMainScreenProps> = ({
  user, onOpenProfile, onOpenActivity, onBack, onForcedLogout, onUpdateEarnings, onUpdateOnlineStatus, onRideComplete
}) => {
  const { toast } = useToast();
  const [activeRide, setActiveRide] = useState<DriverRideRequest | null>(null);
  const [ridePhase, setRidePhase] = useState<RidePhase>('pickup');
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [pendingRide, setPendingRide] = useState<DriverRideRequest | null>(null);
  const lastRulesAccepted = useRef<number>(0);

  const approvalStatus = user?.approvalStatus || 'PENDING';
  const totalEarnings = walletSummary?.currentBalance ?? user?.walletBalance ?? 0;
  const {
    isOnline,
    isLocationRefreshing,
    availabilityIssue,
    driverPos,
    liveRideRequests,
    enableOnline,
    disableOnline,
    removeRideRequest,
    restoreRideRequest,
  } = useDriverRealtime({
    user,
    approvalStatus,
    onOnlineStatusChange: onUpdateOnlineStatus,
    onForcedLogout,
  });

  const [tripTimer, setTripTimer] = useState<number>(0); // seconds elapsed
  const timerInterval = useRef<any>(null);
  const [fareBreakdown, setFareBreakdown] = useState<any>(null);
  const loadWalletSummary = async () => {
    try {
      const summary = await api.get<WalletSummary>('/payments/wallet');
      setWalletSummary(summary);
    } catch (error: any) {
      console.error('Failed to load wallet summary:', error);
      if (error.message?.includes('401') || error.message?.includes('403')) {
        onForcedLogout(error.message);
      }
    }
  };

  const buildRideRequestFromTrip = (trip: any): DriverRideRequest => ({
    id: trip.id,
    ownerName: trip.owner?.name || trip.ownerName || 'Car Owner',
    pickup: trip.pickupAddress,
    destination: trip.destAddress,
    distance: `${trip.distanceKm?.toFixed(1) || '0.0'} km`,
    price: `${trip.driverEarnings ?? trip.amount ?? 0}`,
    time: `${trip.estimatedArrivalMins || trip.estimatedMins || 5} mins`,
    avatar: trip.owner?.avatarUrl || IMAGES.USER_AVATAR,
    coords: [trip.pickupLat, trip.pickupLng],
    destCoords: [trip.destLat, trip.destLng],
    estimatedMins: trip.estimatedMins ?? null,
  });

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const bootstrapDriverState = async () => {
      await loadWalletSummary();

      if (approvalStatus !== 'APPROVED') return;

      try {
        const currentRide = await api.get<any | null>('/rides/current');
        if (!isMounted || !currentRide) return;

        const restoredRide = buildRideRequestFromTrip(currentRide);

        if (currentRide.status === 'PENDING_ACCEPTANCE') {
          restoreRideRequest(restoredRide);
          return;
        }

        setActiveRide(restoredRide);

        if (currentRide.status === 'IN_PROGRESS') {
          setRidePhase('trip');
          setFareBreakdown(currentRide.fareBreakdown || null);

          const elapsedSeconds = currentRide.startedAt
            ? Math.max(0, Math.floor((Date.now() - new Date(currentRide.startedAt).getTime()) / 1000))
            : 0;
          setTripTimer(elapsedSeconds);
          clearInterval(timerInterval.current);
          timerInterval.current = setInterval(() => {
            setTripTimer((prev) => prev + 1);
          }, 1000);
          return;
        }

        if (currentRide.status === 'COMPLETED') {
          setRidePhase('completed');
          setFareBreakdown(currentRide.fareBreakdown || null);
          setTripTimer(0);
          return;
        }

        setRidePhase('pickup');
      } catch (error: any) {
        console.error('Failed to restore driver ride context:', error);
        if (error.message?.includes('401') || error.message?.includes('403')) {
          onForcedLogout(error.message);
        }
      }
    };

    bootstrapDriverState();

    return () => {
      isMounted = false;
      clearInterval(timerInterval.current);
    };
  }, [user?.id, approvalStatus]);

  const formatTimer = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleOnline = async () => {
    if (activeRide) return;
    CapacitorService.triggerHaptic();

    const goingOnline = !isOnline;

    if (goingOnline) {
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;
      if (now - lastRulesAccepted.current > sixHours) {
        setShowRulesModal(true);
        return;
      }
    }

    try {
      if (!goingOnline) {
        await disableOnline();
      } else {
        enableOnline();
      }
    } catch (error) {
      console.error('Failed to update online status:', error);
    }
  };


  const handleAcceptRules = async () => {
    lastRulesAccepted.current = Date.now();
    setShowRulesModal(false);
    enableOnline();
  };

  const handleAcceptRide = (ride: DriverRideRequest) => {
    CapacitorService.triggerHaptic();
    setPendingRide(ride);
    setSelfieImage(null);
    setShowSelfieModal(true);
  };

  // Update confirmSelfieAndRide to call backend accept
  const confirmSelfieAndRide = async () => {
    if (!pendingRide || !selfieImage) return;

    try {
      // Accept the ride on backend
      await api.post(`/rides/${pendingRide.id}/accept`);

      setActiveRide(pendingRide);
      setRidePhase('pickup');
      setShowSelfieModal(false);
      removeRideRequest(pendingRide.id);
      setPendingRide(null);
      setSelfieImage(null);
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        onForcedLogout(error.message);
      } else {
        toast.error(error.message || 'Failed to accept ride. It may have been cancelled.');
      }
      setShowSelfieModal(false);
      setPendingRide(null);
      setSelfieImage(null);
    }
  };

  const handleTakeSelfie = async () => {
    try {
      const photo = await CapacitorService.takePhoto(CameraSource.Camera, CameraDirection.Front);
      if (photo) {
        setSelfieImage(photo);
      }
    } catch (e) {
      console.error("Selfie failed", e);
    }
  };

  const cancelSelfie = () => {
    setShowSelfieModal(false);
    setPendingRide(null);
    setSelfieImage(null);
  };

  const handleArrival = () => {
    CapacitorService.triggerHaptic();
    setRidePhase('arrived');
  };

  const handleStartTrip = async () => {
    CapacitorService.triggerHaptic();

    if (!activeRide) return;

    try {
      // Record startedAt on backend
      await api.patch(`/rides/${activeRide.id}/status`, {
        status: 'IN_PROGRESS',
      });

      setRidePhase('trip');

      // Start live elapsed timer
      setTripTimer(0);
      timerInterval.current = setInterval(() => {
        setTripTimer(prev => prev + 1);
      }, 1000);

    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        onForcedLogout(error.message);
      } else {
        toast.error(error.message || 'Failed to start trip. Please try again.');
      }
    }
  };

  const handleCompleteTrip = async () => {
    if (!activeRide) return;
    CapacitorService.triggerHaptic();

    // Stop the timer
    clearInterval(timerInterval.current);

    try {
      const result = await api.patch<any>(`/rides/${activeRide.id}/status`, {
        status: 'COMPLETED',
      });

      // Store fare breakdown for display
      if (result.fareBreakdown) {
        setFareBreakdown(result.fareBreakdown);
      }

      // Update local wallet display
      const earnings = result.fareBreakdown?.driverEarnings ?? result.driver?.walletBalance;
      if (earnings) {
        onUpdateEarnings(result.fareBreakdown?.driverEarnings ?? 0);
        setWalletSummary(prev => prev ? {
          ...prev,
          currentBalance: prev.currentBalance + (result.fareBreakdown?.driverEarnings ?? 0),
          totalEarned: prev.totalEarned + (result.fareBreakdown?.driverEarnings ?? 0),
          totalTrips: prev.totalTrips + 1,
        } : prev);
      }

      const newTrip: Trip = {
        id: activeRide.id,
        driverId: user?.id,
        driverName: user?.name || 'Unknown Driver',
        ownerName: activeRide.ownerName,
        date: new Date().toLocaleString(),
        amount: result.fareBreakdown?.finalFare ?? 0,
        status: 'COMPLETED',
        location: `${activeRide.pickup?.split(',')[0]} -> ${activeRide.destination?.split(',')[0]}`,
      };
      onRideComplete(newTrip);

      setRidePhase('completed');

    } catch (error: any) {
      clearInterval(timerInterval.current);
      if (error.message?.includes('401') || error.message?.includes('403')) {
        onForcedLogout(error.message);
      } else {
        toast.error(error.message || 'Failed to complete trip. Please try again.');
      }
    }
  };

  const handleDeclineRide = async (ride: DriverRideRequest) => {
    CapacitorService.triggerHaptic();
    try {
      await api.post(`/rides/${ride.id}/decline`);
      // Remove from list
      removeRideRequest(ride.id);
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        onForcedLogout(error.message);
      } else {
        toast.error(error.message || 'Failed to decline ride');
      }
    }
  };

  const openNavigation = (coords: [number, number]) => {
    CapacitorService.triggerHaptic();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`;
    window.open(url, '_blank');
  };

  const getPhaseText = () => {
    switch (ridePhase) {
      case 'pickup': return "Heading to Pickup";
      case 'arrived': return "Driver Arrived";
      case 'trip': return "Trip in Progress";
      case 'completed': return "Trip Completed";
      default: return "";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount).replace('NGN', '₦');
  };

  if (approvalStatus === 'PENDING') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-8 bg-background-dark text-center gap-6">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center animate-soft-pulse">
          <span className="material-symbols-outlined text-primary text-5xl">manage_search</span>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-black text-white">Verification Pending</h2>
          <p className="text-slate-400 font-medium">Your application is currently being reviewed by our administration team. This usually takes 24-48 hours.</p>
        </div>
        <button onClick={onBack} className="mt-6 w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all active:scale-95">
          Logout & Wait
        </button>
      </div>
    );
  }

  if (approvalStatus === 'REJECTED') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-8 bg-background-dark text-center gap-6">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-red-500 text-5xl">cancel</span>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-black text-white">Application Rejected</h2>
          <p className="text-slate-400 font-medium">Unfortunately, your driver application does not meet our current requirements.</p>
        </div>
        <button onClick={onBack} className="mt-6 w-full py-4 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all">
          Log Out
        </button>
      </div>
    );
  }

  // Ensure all markers have a unique 'id' property
  const mapMarkers: any[] = [{ id: 'driver-me', position: driverPos, title: 'You', icon: 'taxi' }];
  if (activeRide) {
    if (ridePhase === 'pickup' || ridePhase === 'arrived') {
      mapMarkers.push({ id: 'pickup-point', position: activeRide.coords, title: 'Pickup Location', icon: 'pickup' });
    } else if (ridePhase === 'trip') {
      mapMarkers.push({ id: 'dest-point', position: activeRide.destCoords, title: 'Destination', icon: 'destination' });
    }
  }

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col relative bg-background-dark font-display">
      <div className={`absolute inset-0 z-0 transition-all duration-700 ${!isOnline ? 'grayscale brightness-50 contrast-125' : ''}`}>
        <InteractiveMap center={driverPos} markers={mapMarkers} />
        {/* Location refreshing overlay — shown on first login or when going back online */}
        {isOnline && isLocationRefreshing && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background-dark/80 backdrop-blur-sm gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/40 border-dashed animate-pulse">
              <span className="material-symbols-outlined text-primary text-3xl">my_location</span>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-base">Updating your location</p>
              <p className="text-slate-400 text-xs mt-1">Please wait a moment...</p>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-[#101622]/40 via-transparent to-[#101622]/90 pointer-events-none"></div>
      </div>

      <div className="relative z-10 p-4 pt-8 bg-gradient-to-b from-background-dark/90 to-transparent flex flex-col gap-4">
        <div className="flex items-center justify-between">
          {!activeRide && (
            <button onClick={onBack} className="bg-surface-dark/80 backdrop-blur-md text-white flex size-10 items-center justify-center rounded-full shadow-lg active:scale-90 transition-all border border-white/10">
              <span className="material-symbols-outlined">logout</span>
            </button>
          )}

          {!activeRide ? (
            <div className="flex-1 mx-3 h-12 bg-surface-dark/80 backdrop-blur-xl border border-white/10 rounded-full p-1 flex items-stretch relative shadow-lg">
              {/* Background Slider */}
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 shadow-md ${isOnline ? 'translate-x-full left-0 ml-1 bg-primary' : 'left-1 bg-slate-600'
                  }`}
              ></div>

              <button
                onClick={() => isOnline && toggleOnline()}
                className={`flex-1 relative z-10 flex items-center justify-center gap-2 rounded-full transition-all active:scale-95 ${!isOnline ? 'text-white cursor-default' : 'text-slate-400 hover:text-white'}`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">Offline</span>
              </button>

              <button
                onClick={() => !isOnline && toggleOnline()}
                className={`flex-1 relative z-10 flex items-center justify-center gap-2 rounded-full transition-all active:scale-95 ${isOnline ? 'text-white cursor-default' : 'text-slate-400 hover:text-white'}`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">Online</span>
              </button>
            </div>
          ) : (
            // Active Ride Status Bar (Locked)
            <div className="flex-1 mx-3 h-12 bg-primary/90 backdrop-blur-md border border-primary/50 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
              </span>
              <span className="text-white text-xs font-black uppercase tracking-wider">{getPhaseText()}</span>
            </div>
          )}

          <button onClick={onOpenProfile} className="bg-surface-dark/80 backdrop-blur-md text-white flex size-10 items-center justify-center rounded-full shadow-lg active:scale-90 transition-all border border-white/10">
            <span className="material-symbols-outlined">person</span>
          </button>
        </div>

        {/* Global Wallet Display */}
        {!activeRide && (
          <div className="animate-fade-in flex justify-center mt-2">
            <div className={`bg-surface-dark/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 px-6 flex items-center gap-4 shadow-2xl transition-all duration-500 ${!isOnline ? 'opacity-50' : 'opacity-100'}`}>
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined filled">account_balance_wallet</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Cleared Earnings</span>
                <span className="text-xl font-black text-white tracking-tight">{formatCurrency(totalEarnings)}</span>
                {walletSummary?.accountNumber && (
                  <span className="text-[10px] text-slate-400 mt-1">
                    Settled to {walletSummary.accountNumber}
                  </span>
                )}
              </div>
              <div className="w-px h-8 bg-white/10 mx-2"></div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Monnify</p>
                <p className="text-[10px] text-slate-400">Paid directly</p>
              </div>
            </div>
          </div>
        )}

        {!activeRide && (
          <div className="animate-fade-in grid grid-cols-2 gap-3">
            <button
              onClick={() => onOpenActivity('trips')}
              className="group relative overflow-hidden rounded-[1.35rem] border border-cyan-400/25 bg-gradient-to-br from-cyan-500/20 via-sky-500/10 to-transparent px-4 py-3 text-left shadow-lg shadow-cyan-900/10 transition-all hover:border-cyan-300/40 hover:brightness-110 active:scale-[0.98]"
            >
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-cyan-400/15 to-transparent pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                  <span className="material-symbols-outlined">route</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/80">Activity</p>
                  <p className="text-sm font-black text-white">Trips</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => onOpenActivity('settlements')}
              className="group relative overflow-hidden rounded-[1.35rem] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/20 via-lime-400/10 to-transparent px-4 py-3 text-left shadow-lg shadow-emerald-900/10 transition-all hover:border-emerald-300/40 hover:brightness-110 active:scale-[0.98]"
            >
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-emerald-400/15 to-transparent pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/80">Activity</p>
                  <p className="text-sm font-black text-white">Settlements</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {!activeRide && availabilityIssue && (
          <div className="animate-fade-in rounded-[1.35rem] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-900/10">
            <p className="font-bold text-amber-200">Driver not visible yet</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/90">{availabilityIssue}</p>
          </div>
        )}
      </div>

      <div className="flex-1"></div>

      <div className="relative z-20 w-full max-h-[72vh] bg-surface-dark rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.6)] flex flex-col border-t border-white/5 transition-all duration-500">
        <div className="p-6 pt-2 pb-10 flex flex-col gap-5 overflow-y-auto no-scrollbar">
          {!activeRide ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Incoming Requests</h3>
                  <p className="text-slate-400 text-xs font-medium">{isOnline ? 'Waiting for owner ride requests' : 'Go online to receive owner requests'}</p>
                </div>
                {isOnline && (
                  <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></div>
                    <span className="text-primary text-[10px] font-black uppercase tracking-widest">Available</span>
                  </div>
                )}
              </div>

              {isOnline ? (
                liveRideRequests.length > 0 ? (
                  liveRideRequests.map(req => (
                    <div key={req.id} className="bg-input-dark/40 p-5 rounded-3xl border border-white/5 flex flex-col gap-5 shadow-2xl animate-slide-up relative overflow-hidden group">

                      {/* Top Header: Owner and Earnings */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={req.avatar}
                            className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
                            alt=""
                          />
                          <div>
                            <h4 className="font-bold text-white text-sm">{req.ownerName}</h4>
                            <div className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px] text-yellow-500 filled">star</span>
                              <span className="text-[10px] text-slate-400 font-bold">4.9 · Verified</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Est. Earnings</p>
                          <p className="text-2xl font-black text-primary leading-none">₦{req.price}</p>
                        </div>
                      </div>

                      {/* Route Summary */}
                      <div className="flex gap-4 items-stretch bg-white/5 rounded-2xl p-4 border border-white/5">
                        <div className="flex flex-col items-center gap-1 py-1">
                          <div className="w-2 h-2 rounded-full bg-accent"></div>
                          <div className="w-0.5 flex-1 bg-slate-700"></div>
                          <div className="w-2 h-2 rounded-sm bg-primary"></div>
                        </div>
                        <div className="flex-1 flex flex-col gap-3 justify-between">
                          <div className="overflow-hidden">
                            <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Pickup</p>
                            <p className="text-white text-xs font-bold truncate">{req.pickup}</p>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Destination</p>
                            <p className="text-white text-xs font-bold truncate">{req.destination}</p>
                          </div>
                        </div>
                        <div className="w-px bg-white/10 mx-1"></div>
                        <div className="flex flex-col justify-center items-center px-2 min-w-[70px]">
                          <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Impact</p>
                          <p className="text-white font-black text-sm">{req.distance}</p>
                          <p className="text-[10px] text-primary font-bold mt-1">
                            {req.estimatedMins ? `${req.estimatedMins}m away` : req.time}
                          </p>
                        </div>
                      </div>

                      {/* Decision Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleDeclineRide(req)}
                          className="flex-1 py-4 rounded-2xl bg-slate-800/50 text-slate-400 font-bold hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95 text-sm"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleAcceptRide(req)}
                          className="flex-[2] py-4 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/25 hover:brightness-110 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                        >
                          Accept Ride
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      </div>

                      {/* Expiry Timer Bar (Visual Polish) */}
                      <div className="absolute bottom-0 left-0 h-1 bg-primary/20 w-full overflow-hidden">
                        <div className="h-full bg-primary animate-shrink-width origin-left"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  // Scanning state — no requests yet
                  <div className="py-12 text-center flex flex-col items-center gap-6 animate-fade-in">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center border border-primary/20">
                        <span className="material-symbols-outlined text-4xl text-primary">radar</span>
                      </div>
                      {/* Live Radar Rings */}
                      <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping"></div>
                      <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping [animation-delay:0.5s]"></div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-white">Searching for Rides</h3>
                      <p className="text-slate-400 text-sm font-medium max-w-[260px] mx-auto leading-relaxed">
                        You're live and visible to nearby owners. Stay on this screen to catch the latest requests.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                // Offline state
                <div className="py-12 text-center flex flex-col items-center gap-6 animate-fade-in">
                  <div className="w-24 h-24 rounded-full bg-slate-800/30 flex items-center justify-center border border-slate-700/50 shadow-inner">
                    <span className="material-symbols-outlined text-5xl text-slate-600">power_settings_new</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white">You're Offline</h3>
                    <p className="text-slate-500 text-sm font-medium max-w-[240px] mx-auto leading-relaxed">
                      Your status is hidden from owners. Go online to start receiving ride requests.
                    </p>
                  </div>
                  <button
                    onClick={toggleOnline}
                    className="px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined">sensors</span>
                    Go Online Now
                  </button>
                </div>
              )}

            </>
          ) : (
            <div className="flex flex-col gap-6 animate-slide-up">

              {/* Timeline Header */}
              <TripProgressTimeline milestone={ridePhase} />

              <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <img src={activeRide.avatar} className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30" alt="" />
                  <div>
                    <h4 className="font-bold text-white text-base">{activeRide.ownerName}</h4>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Owner is waiting</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary active:scale-90 transition-all border border-primary/20">
                    <span className="material-symbols-outlined text-[22px]">chat</span>
                  </button>
                  <button className="w-11 h-11 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 active:scale-90 transition-all border border-green-500/20">
                    <span className="material-symbols-outlined text-[22px]">call</span>
                  </button>
                </div>
              </div>

              {/* Route Card */}
              <div className="bg-input-dark/40 rounded-3xl p-5 border border-white/5 space-y-5">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <div className={`w-3 h-3 rounded-full border-2 ${ridePhase === 'pickup' || ridePhase === 'arrived' ? 'border-primary animate-pulse' : 'border-slate-600 bg-slate-600'}`}></div>
                    <div className="w-0.5 flex-1 bg-slate-800 my-1"></div>
                    <div className={`w-3 h-3 rounded-sm ${ridePhase === 'trip' ? 'bg-primary animate-pulse' : 'bg-slate-800'}`}></div>
                  </div>
                  <div className="flex-1 flex flex-col gap-6">
                    <div onClick={() => openNavigation(activeRide.coords)} className="group cursor-pointer">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pick up point</p>
                        <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">navigation</span>
                          Navigate
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white leading-snug">
                        {activeRide.pickup}
                      </p>
                    </div>
                    <div onClick={() => openNavigation(activeRide.destCoords)} className="group cursor-pointer">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Destination</p>
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-primary transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">map</span>
                          Preview
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white leading-snug">
                        {activeRide.destination}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <div className="flex-1 bg-white/5 rounded-2xl p-3">
                    <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Trip Value</p>
                    <p className="text-lg font-black text-white leading-none">₦{activeRide.price}</p>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-2xl p-3 text-right">
                    <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Total Distance</p>
                    <p className="text-lg font-bold text-white leading-none">{activeRide.distance}</p>
                  </div>
                </div>
              </div>

              {/* Dynamic Action Area */}
              <div className="space-y-4">
                {ridePhase === 'pickup' && (
                  <button
                    onClick={handleArrival}
                    className="w-full bg-primary text-white font-black py-5 rounded-3xl shadow-2xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg"
                  >
                    <span className="material-symbols-outlined">location_on</span>
                    I Have Arrived
                  </button>
                )}

                {ridePhase === 'arrived' && (
                  <div className="flex flex-col gap-3">
                    <div className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20 text-center">
                      <p className="text-xs font-bold text-green-500">Wait for the owner before starting the trip</p>
                    </div>
                    <button
                      onClick={handleStartTrip}
                      className="w-full bg-green-500 text-white font-black py-5 rounded-3xl shadow-2xl shadow-green-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg"
                    >
                      <span className="material-symbols-outlined">play_arrow</span>
                      Start Trip
                    </button>
                  </div>
                )}

                {ridePhase === 'trip' && (
                  <div className="flex flex-col gap-4">
                    {/* Premium Live Timer */}
                    <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10 flex flex-col items-center gap-2">
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Live Trip Counter</span>
                      <span className="text-5xl font-black text-white font-mono tracking-tighter">
                        {formatTimer(tripTimer)}
                      </span>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-slate-500 uppercase font-black">Est. Duration</span>
                          <span className="text-xs font-bold text-white">
                            {activeRide.estimatedMins ? `${activeRide.estimatedMins}m` : '---'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCompleteTrip}
                      className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-2xl shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg"
                    >
                      <span className="material-symbols-outlined">flag</span>
                      Complete Trip
                    </button>
                  </div>
                )}
              </div>
              {ridePhase === 'completed' && (
                <div className="flex flex-col gap-6 animate-scale-in">

                  {/* Victory Header */}
                  <div className="text-center py-8 bg-primary/5 rounded-[2.5rem] border border-primary/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/20 rounded-full -ml-12 -mb-12 blur-2xl"></div>

                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                      <span className="material-symbols-outlined text-4xl filled">verified</span>
                    </div>
                    <h3 className="text-2xl font-black text-white">Trip Complete!</h3>
                    <p className="text-primary text-sm font-bold mt-1">Earnings updated in your wallet</p>
                  </div>

                  {fareBreakdown ? (
                    <div className="space-y-4">
                      {/* Trip Metadata */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex gap-4">
                        <div className="flex-1 text-center">
                          <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Total Distance</p>
                          <p className="text-sm font-bold text-white">{fareBreakdown.distanceKm ?? 0} km</p>
                        </div>
                        <div className="w-px bg-white/10"></div>
                        <div className="flex-1 text-center">
                          <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Trip Duration</p>
                          <p className="text-sm font-bold text-white">{fareBreakdown.actualMins ?? fareBreakdown.totalMins ?? 0} mins</p>
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="bg-input-dark/50 rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                        <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Financial Summary</p>
                          <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full italic">Verified</span>
                        </div>

                        <div className="p-5 space-y-4">
                          <div className="space-y-3 opacity-80">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-xs">Base Trip Fare</span>
                              <span className="text-white font-bold text-xs">
                                {formatCurrency(fareBreakdown.baseFare ?? 0)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-xs">Distance & Time</span>
                              <span className="text-white font-bold text-xs">
                                {formatCurrency((fareBreakdown.distanceComponent ?? 0) + (fareBreakdown.timeComponent ?? 0))}
                              </span>
                            </div>
                            {fareBreakdown.commissionAmount > 0 && (
                              <div className="flex justify-between items-center text-red-400/60">
                                <span className="text-xs">BICA Commission</span>
                                <span className="font-bold text-xs">
                                  -{formatCurrency(fareBreakdown.commissionAmount)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                            <div>
                              <p className="text-[10px] font-black text-primary uppercase mb-0.5">Your Take-home</p>
                              <p className="text-2xl font-black text-white">
                                {formatCurrency(fareBreakdown.driverEarnings ?? 0)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Total Paid</p>
                              <p className="text-sm font-bold text-slate-300">
                                {formatCurrency(fareBreakdown.finalFare ?? 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center">
                      <p className="text-slate-400 text-sm">Processing final trip details...</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setActiveRide(null);
                        setRidePhase('pickup');
                        setFareBreakdown(null);
                        setTripTimer(0);
                      }}
                      className="w-full py-5 rounded-3xl bg-white text-background-dark font-black shadow-xl active:scale-[0.98] transition-all text-base flex items-center justify-center gap-2 hover:bg-slate-100"
                    >
                      Done & Ready for Next
                      <span className="material-symbols-outlined text-base">refresh</span>
                    </button>
                    <p className="text-center text-[10px] text-slate-500 mt-5 leading-relaxed px-8">
                      The owner has been notified. Earnings are typically reflected in your wallet instantly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showSelfieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-dark border border-white/10 p-6 rounded-[2rem] w-full max-w-sm text-center flex flex-col max-h-[85vh] overflow-y-auto no-scrollbar">
            <span className="material-symbols-outlined text-4xl text-white mb-3 bg-white/10 p-4 rounded-full mx-auto">face</span>
            <h3 className="text-xl font-bold text-white mb-2">Verify Identity</h3>
            <p className="text-slate-400 text-xs mb-6">Take a quick selfie to confirm you are the driver for this ride.</p>

            <div className="w-full aspect-square bg-black/50 rounded-2xl mb-6 overflow-hidden relative border border-white/10">
              {selfieImage ? (
                <img src={selfieImage} className="w-full h-full object-cover" alt="Selfie" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <span className="material-symbols-outlined text-6xl">camera_front</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={cancelSelfie} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-bold hover:bg-white/10 transition-colors">Cancel</button>
              {selfieImage ? (
                <button onClick={confirmSelfieAndRide} className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20">Confirm</button>
              ) : (
                <button onClick={handleTakeSelfie} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">Take Photo</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-dark border border-white/10 p-6 rounded-[2rem] w-full max-w-sm text-center max-h-[80vh] flex flex-col">
            <span className="material-symbols-outlined text-4xl text-white mb-3 bg-white/10 p-4 rounded-full mx-auto">gavel</span>
            <h3 className="text-xl font-bold text-white mb-2">Rules of Engagement</h3>
            <p className="text-slate-400 text-xs mb-4">Please review and accept the driver guidelines before going online.</p>

            <div className="flex-1 overflow-y-auto text-left space-y-3 mb-6 pr-2 custom-scrollbar">
              {[
                "Dress clean and tidy (If possible apply cologne/perfume).",
                "Approach clients with courtesy and smile.",
                "Do a background check on the clients vehicle by asking questions about the vehicle.",
                "Remember to always use your seat belt while driving.",
                "Do not receive/make calls while driving.",
                "Do not text and drive.",
                "Obey all traffic rules.",
                "Drivers should keep to speed limits of all roads.",
                "Relax while driving no need to rush except in case of emergency.",
                "Be kind to other road user."
              ].map((rule, index) => (
                <div key={index} className="flex gap-3 text-sm text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="font-bold text-primary min-w-[20px]">{index + 1}.</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-auto pt-4 border-t border-white/10">
              <button onClick={() => setShowRulesModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-bold hover:bg-white/10 transition-colors">Cancel</button>
              <button onClick={handleAcceptRules} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">I Agree</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DriverMainScreen;




