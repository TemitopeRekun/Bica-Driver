
import React, { useState, useEffect, useRef } from 'react';
import InteractiveMap from '../components/InteractiveMap';
import { CapacitorService } from '../services/CapacitorService';
import { UserProfile, Trip, WalletSummary } from '../types';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api.service';
import { IMAGES } from '@/constants';
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface RideRequest {
  id: string;
  ownerName: string;
  pickup: string;
  destination: string;
  distance: string;
  price: string;
  time: string;
  avatar: string;
  coords: [number, number];
  destCoords: [number, number];
  estimatedMins?: number;
}

type RidePhase = 'pickup' | 'arrived' | 'trip' | 'completed';

interface DriverMainScreenProps {
  user: UserProfile | null;
  onOpenProfile: () => void;
  onBack: () => void;
  onUpdateEarnings: (amount: number) => void;
  onRideComplete: (trip: Trip) => void;
}

import { CameraSource, CameraDirection } from '@capacitor/camera';


// Outside DriverMainScreen — not recreated on every render
const CountdownTimer: React.FC<{ seconds: number; onExpire: () => void }> = ({
  seconds,
  onExpire,
}) => {
  const [remaining, setRemaining] = React.useState(seconds);

  React.useEffect(() => {
    if (remaining <= 0) {
      onExpire();
      return;
    }
    const timer = setTimeout(() => setRemaining(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-10 h-10 rounded-full border-4 border-primary/30 flex items-center justify-center"
        style={{
          background: `conic-gradient(#045828 ${(remaining / seconds) * 360}deg, transparent 0deg)`,
        }}
      >
        <div className="w-7 h-7 bg-surface-dark rounded-full flex items-center justify-center">
          <span className="text-xs font-black text-primary">{remaining}</span>
        </div>
      </div>
      <span className="text-[10px] text-slate-400">sec</span>
    </div>
  );
};

// ... existing imports

const DriverMainScreen: React.FC<DriverMainScreenProps> = ({
  user, onOpenProfile, onBack, onUpdateEarnings, onRideComplete
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isLocationRefreshing, setIsLocationRefreshing] = useState(false); // overlay on first login
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [ridePhase, setRidePhase] = useState<RidePhase>('pickup');
  const [driverPos, setDriverPos] = useState<[number, number]>([6.4549, 3.3896]);
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [pendingRide, setPendingRide] = useState<RideRequest | null>(null);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const lastRulesAccepted = useRef<number>(0);
  const trackingInterval = useRef<any>(null);

  const approvalStatus = user?.approvalStatus || 'PENDING';
  const totalEarnings = walletSummary?.currentBalance ?? user?.walletBalance ?? 0;
  const socketRef = useRef<Socket | null>(null);
  const [liveRideRequests, setLiveRideRequests] = useState<RideRequest[]>([]);

  const [tripTimer, setTripTimer] = useState<number>(0); // seconds elapsed
  const timerInterval = useRef<any>(null);
  const [fareBreakdown, setFareBreakdown] = useState<any>(null);
  const loadWalletSummary = async () => {
    try {
      const summary = await api.get<WalletSummary>('/payments/wallet');
      setWalletSummary(summary);
    } catch (error) {
      console.error('Failed to load wallet summary:', error);
    }
  };
  const loadRecentTrips = async () => {
    setIsLoadingTrips(true);
    try {
      const trips = await api.get<any[]>('/rides/history');
      setRecentTrips(trips.map((trip) => ({
        ...trip,
        ownerId: trip.ownerId || trip.owner?.id,
        driverId: trip.driverId || trip.driver?.id,
        ownerName: trip.owner?.name || trip.ownerName || 'Owner',
        driverName: trip.driver?.name || trip.driverName || 'Driver',
        date: trip.createdAt ? new Date(trip.createdAt).toLocaleString() : '',
        location: `${trip.pickupAddress?.split(',')[0] || 'Unknown'} -> ${trip.destAddress?.split(',')[0] || 'Unknown'}`,
      })));
    } catch (error) {
      console.error('Failed to load driver trip history:', error);
      setRecentTrips([]);
    } finally {
      setIsLoadingTrips(false);
    }
  };
  const registerDriverSocket = () => {
    if (!socketRef.current?.connected || !user?.id) return;
    socketRef.current.emit('driver:register', { driverId: user.id });
  };
  const pushDriverLocation = async (latitude: number, longitude: number) => {
    if (!user?.id) return;
    setDriverPos([latitude, longitude]);
    await api.patch('/users/location', { lat: latitude, lng: longitude });
    if (socketRef.current?.connected) {
      socketRef.current.emit('driver:location', {
        driverId: user.id,
        lat: latitude,
        lng: longitude,
      });
    }
  };


  // Effect 1 - Socket connection (only reconnects when user ID changes)
  useEffect(() => {
    if (approvalStatus !== 'APPROVED' || !user?.id) return;

    socketRef.current = io(`${API_URL}/rides`, {
      transports: ['websocket'],
      autoConnect: false,
    });

    socketRef.current.on('connect', () => {
      registerDriverSocket();
    });

    socketRef.current.on('ride:assigned', (trip: any) => {
      const rideRequest: RideRequest = {
        id: trip.id,
        ownerName: trip.owner?.name || 'Car Owner',
        pickup: trip.pickupAddress,
        destination: trip.destAddress,
        distance: `${trip.distanceKm?.toFixed(1)} km`,
        price: trip.driverEarnings?.toLocaleString() || trip.amount?.toLocaleString(),
        time: `${trip.estimatedArrivalMins || 5} mins`,
        avatar: trip.owner?.avatarUrl || IMAGES.USER_AVATAR,
        coords: [trip.pickupLat, trip.pickupLng],
        destCoords: [trip.destLat, trip.destLng],
        estimatedMins: trip.estimatedMins ?? null,
      };

      setLiveRideRequests(prev => {
        if (prev.some(r => r.id === trip.id)) return prev;
        return [rideRequest, ...prev];
      });
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [approvalStatus, user?.id]);

  useEffect(() => {
    if (approvalStatus !== 'APPROVED' || !user?.id) return;
    loadWalletSummary();
    loadRecentTrips();
  }, [approvalStatus, user?.id]);

  // Effect 2 - Location tracking (responds to isOnline changes)
  useEffect(() => {
    if (approvalStatus !== 'APPROVED' || !user?.id || !socketRef.current) return;

    if (!isOnline) {
      // Going offline — clear interval, location already cleared in toggleOnline
      clearInterval(trackingInterval.current);
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
      return;
    }

    // Going online — set backend status and get location
    const initLocation = async () => {
      setIsLocationRefreshing(true);
      try {
        if (!socketRef.current?.connected) {
          socketRef.current.connect();
        } else {
          registerDriverSocket();
        }
        await api.patch('/users/online', { isOnline: true });

        const pos = await CapacitorService.getCurrentLocation();
        if (pos) {
          const { latitude, longitude } = pos.coords;
          await pushDriverLocation(latitude, longitude);
        }
      } catch (e) {
        console.error('Initial location failed:', e);
      } finally {
        setIsLocationRefreshing(false);
      }
    };

    initLocation();

    // Start interval for ongoing tracking
    trackingInterval.current = setInterval(async () => {
      try {
        const pos = await CapacitorService.getCurrentLocation();
        if (pos) {
          const { latitude, longitude } = pos.coords;
          await pushDriverLocation(latitude, longitude);
        }
      } catch (e) {
        console.error('Location interval failed:', e);
      }
    }, 10000);

    return () => {
      clearInterval(trackingInterval.current);
    };
  }, [isOnline, approvalStatus, user?.id]);

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
        // Going offline — clear location immediately
        await api.patch('/users/online', { isOnline: false });
        await api.patch('/users/location', { lat: null, lng: null }).catch(() => { });
      }
      // Going online — the useEffect watching isOnline will handle
      // setting backend status and getting location
      setIsOnline(goingOnline);
    } catch (error) {
      console.error('Failed to update online status:', error);
      setIsOnline(goingOnline);
    }
  };


  const handleAcceptRules = async () => {
    lastRulesAccepted.current = Date.now();
    setShowRulesModal(false);
    setIsOnline(true); // ← this triggers the location useEffect automatically
  };

  const handleAcceptRide = (ride: RideRequest) => {
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
      // Remove from pending requests list
      setLiveRideRequests(prev =>
        prev.filter(r => r.id !== pendingRide.id),
      );
      setPendingRide(null);
      setSelfieImage(null);
    } catch (error: any) {
      alert(error.message || 'Failed to accept ride. It may have been cancelled.');
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
      alert(error.message || 'Failed to start trip. Please try again.');
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
      alert(error.message || 'Failed to complete trip. Please try again.');
    }
  };

  const handleDeclineRide = async (ride: RideRequest) => {
    CapacitorService.triggerHaptic();
    try {
      await api.post(`/rides/${ride.id}/decline`);
      // Remove from list
      setLiveRideRequests(prev => prev.filter(r => r.id !== ride.id));
    } catch (error: any) {
      alert(error.message || 'Failed to decline ride');
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

  const formatShortDate = (value?: string | null) => {
    if (!value) return 'Just now';
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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
      </div>

      <div className="flex-1"></div>

      <div className="relative z-20 w-full bg-surface-dark rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.6)] flex flex-col border-t border-white/5 transition-all duration-500">
        <div className="p-6 pt-2 pb-10 flex flex-col gap-5">
          {!activeRide ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Live Radar</h3>
                  <p className="text-slate-400 text-xs font-medium">{isOnline ? 'Scanning for nearby jobs...' : 'Go online to receive jobs'}</p>
                </div>
                {isOnline && (
                  <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></div>
                    <span className="text-primary text-[10px] font-black uppercase tracking-widest">Active</span>
                  </div>
                )}
              </div>

              {isOnline ? (
                liveRideRequests.length > 0 ? (
                  liveRideRequests.map(req => (
                    <div key={req.id} className="bg-input-dark/40 p-5 rounded-3xl border border-white/5 flex flex-col gap-4 shadow-lg animate-slide-up">

                      {/* Owner info */}
                      <div className="flex items-center gap-4">
                        <img
                          src={req.avatar}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10"
                          alt=""
                        />
                        <div className="flex-1">
                          <h4 className="font-bold text-white text-base">{req.ownerName}</h4>
                          <p className="text-slate-400 text-xs mt-0.5">Verified Car Owner</p>
                        </div>
                        {/* 60s countdown on driver side too */}
                        <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                          <CountdownTimer
                            seconds={60}
                            onExpire={() => {
                              // Backend already auto-declined — remove from list
                              setLiveRideRequests(prev =>
                                prev.filter(r => r.id !== req.id),
                              );
                            }}
                          />
                        </div>
                      </div>

                      {/* Trip details */}
                      <div className="space-y-2 bg-white/5 rounded-2xl p-3">
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-accent text-sm mt-0.5">trip_origin</span>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Pickup</p>
                            <p className="text-white text-sm font-medium">{req.pickup}</p>
                          </div>
                        </div>
                        <div className="w-0.5 h-3 bg-slate-700 ml-[9px]"></div>
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-primary text-sm mt-0.5">flag</span>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Destination</p>
                            <p className="text-white text-sm font-medium">{req.destination}</p>
                          </div>
                        </div>
                      </div>

                      {/* Fare and distance */}
                      <div className="flex gap-3">
                        <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Distance</p>
                          <p className="text-white font-black">{req.distance}</p>
                        </div>
                        <div className="flex-1 bg-primary/20 rounded-xl p-3 text-center border border-primary/30">
                          <p className="text-[10px] text-primary uppercase font-bold">Your Earnings</p>
                          <p className="text-primary font-black">₦{req.price}</p>
                        </div>
                        <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Est. Time</p>
                          <p className="text-white font-black">
                            {req.estimatedMins ? `${req.estimatedMins}m` : req.time}
                          </p>
                        </div>
                      </div>

                      {/* Accept / Decline */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleDeclineRide(req)}
                          className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all active:scale-95"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleAcceptRide(req)}
                          className="flex-2 flex-grow py-3.5 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all"
                        >
                          Accept Ride
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  // Scanning state — no requests yet
                  <div className="py-12 text-center flex flex-col items-center gap-6 animate-fade-in">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 border-dashed">
                      <span className="material-symbols-outlined text-4xl text-primary animate-pulse">radar</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Scanning for rides</h3>
                      <p className="text-slate-400 text-xs font-medium max-w-[200px] mx-auto leading-relaxed">
                        You'll be notified instantly when an owner selects you.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                // Offline state
                <div className="py-12 text-center flex flex-col items-center gap-6 animate-fade-in">
                  <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center border-2 border-slate-700 border-dashed">
                    <span className="material-symbols-outlined text-4xl text-slate-500">wifi_off</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">You're Offline</h3>
                    <p className="text-slate-400 text-xs font-medium max-w-[200px] mx-auto leading-relaxed">
                      Switch to online mode above to start receiving ride requests.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-4">
                <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recent Settlements</p>
                    <span className="text-[10px] text-slate-400">{walletSummary?.recentPayments?.length || 0} records</span>
                  </div>
                  {walletSummary?.recentPayments?.length ? (
                    <div className="space-y-3">
                      {walletSummary.recentPayments.slice(0, 3).map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{formatCurrency(payment.driverAmount)}</p>
                            <p className="text-xs text-slate-400">{formatShortDate(payment.paidAt)}</p>
                          </div>
                          <span className="text-[10px] uppercase tracking-widest text-primary">
                            {payment.paymentMethod || 'Monnify'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No settlements recorded yet.</p>
                  )}
                </div>

                <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recent Trips</p>
                    <span className="text-[10px] text-slate-400">{recentTrips.length} total</span>
                  </div>
                  {isLoadingTrips ? (
                    <p className="text-sm text-slate-400">Loading trips...</p>
                  ) : recentTrips.length > 0 ? (
                    <div className="space-y-3">
                      {recentTrips.slice(0, 3).map((trip) => (
                        <div key={trip.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{trip.location}</p>
                            <p className="text-xs text-slate-400">{formatShortDate(trip.createdAt || trip.date)}</p>
                          </div>
                          <span className="text-xs font-bold text-primary">{formatCurrency(trip.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No trips recorded yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* ... Active Ride UI ... */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={activeRide.avatar} className="w-12 h-12 rounded-full object-cover ring-2 ring-primary" alt="" />
                  <div>
                    <h4 className="font-bold text-white text-base">{activeRide.ownerName}</h4>
                    <p className="text-slate-400 text-xs">Verified Owner</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-primary active:scale-90">
                    <span className="material-symbols-outlined text-[20px]">chat</span>
                  </button>
                  <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-green-500 active:scale-90">
                    <span className="material-symbols-outlined text-[20px]">call</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <div className={`w-3 h-3 rounded-full border-2 ${ridePhase === 'pickup' || ridePhase === 'arrived' ? 'border-primary animate-pulse' : 'border-slate-500 bg-slate-500'}`}></div>
                  <div className="w-0.5 flex-1 bg-slate-700 my-1"></div>
                  <div className={`w-3 h-3 rounded-sm ${ridePhase === 'trip' ? 'bg-primary animate-pulse' : 'bg-slate-700'}`}></div>
                </div>
                <div className="flex-1 flex flex-col gap-4">
                  <div onClick={() => openNavigation(activeRide.coords)} className="group cursor-pointer hover:bg-white/5 p-2 -ml-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pick up</p>
                      <span className="material-symbols-outlined text-[14px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">navigation</span>
                    </div>
                    <p className="text-sm font-bold text-white truncate flex items-center gap-2">
                      {activeRide.pickup}
                      <span className="material-symbols-outlined text-[14px] text-slate-500">open_in_new</span>
                    </p>
                  </div>
                  <div onClick={() => openNavigation(activeRide.destCoords)} className="group cursor-pointer hover:bg-white/5 p-2 -ml-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Drop off</p>
                      <span className="material-symbols-outlined text-[14px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">navigation</span>
                    </div>
                    <p className="text-sm font-bold text-white truncate flex items-center gap-2">
                      {activeRide.destination}
                      <span className="material-symbols-outlined text-[14px] text-slate-500">open_in_new</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-input-dark/50 p-4 rounded-2xl flex justify-between items-center border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Est. Earnings</span>
                  <span className="text-xl font-black text-white">₦{activeRide.price}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Distance</span>
                  <span className="text-sm font-bold text-white">{activeRide.distance}</span>
                </div>
              </div>

              {ridePhase === 'pickup' && (
                <button onClick={handleArrival} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all">
                  I Have Arrived
                </button>
              )}
              {ridePhase === 'arrived' && (
                <button onClick={handleStartTrip} className="w-full bg-green-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-green-500/20 active:scale-95 transition-all">
                  Start Trip
                </button>
              )}
              {ridePhase === 'trip' && (
                <>
                  {/* Live trip timer */}
                  <div className="bg-input-dark/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-500 uppercase">Trip Duration</span>
                      <span className="text-2xl font-black text-white font-mono">
                        {formatTimer(tripTimer)}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-black text-slate-500 uppercase">Est. Time</span>
                      <span className="text-sm font-bold text-slate-400">
                        {activeRide.estimatedMins ? `~${activeRide.estimatedMins} mins` : 'Calculating...'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCompleteTrip}
                    className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
                  >
                    Complete Trip
                  </button>
                </>
              )}
              {ridePhase === 'completed' && fareBreakdown && (
                <div className="flex flex-col gap-4 animate-scale-in">
                  {/* Success header */}
                  <div className="text-center py-4">
                    <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-green-500/40">
                      <span className="material-symbols-outlined text-3xl filled">verified</span>
                    </div>
                    <p className="text-green-500 text-xl font-black">Trip Complete!</p>
                    <p className="text-slate-400 text-xs mt-1">Earnings added to your wallet</p>
                  </div>

                  {/* Fare breakdown */}
                  <div className="bg-input-dark/50 rounded-2xl border border-white/10 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Trip Summary</p>
                    </div>

                    <div className="px-4 py-3 space-y-3">
                      {fareBreakdown.distanceComponent > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">
                            Distance ({fareBreakdown.distanceKm}km × ₦100)
                          </span>
                          <span className="text-white font-bold text-sm">
                            ₦{fareBreakdown.distanceComponent.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {fareBreakdown.distanceComponent === 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">Base (short trip flat rate)</span>
                          <span className="text-white font-bold text-sm">₦2,000</span>
                        </div>
                      )}

                      {fareBreakdown.extraMins > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-orange-400 text-sm flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            Traffic ({fareBreakdown.extraMins}mins × ₦50)
                          </span>
                          <span className="text-orange-400 font-bold text-sm">
                            +₦{fareBreakdown.timeComponent.toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs text-slate-500">
                        <span>
                          Actual: {fareBreakdown.actualMins}mins
                          · Est: {fareBreakdown.estimatedMins}mins
                        </span>
                        <span>{fareBreakdown.extraMins > 0 ? `+${fareBreakdown.extraMins}mins over` : 'On time ✓'}</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="mx-4 border-t border-white/10"></div>

                    <div className="px-4 py-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Total fare</span>
                        <span className="text-white font-bold">
                          ₦{fareBreakdown.finalFare.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">BICA commission (25%)</span>
                        <span className="text-slate-400 text-sm">
                          -₦{fareBreakdown.commissionAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <span className="text-primary font-black text-sm uppercase tracking-wide">Your earnings</span>
                        <span className="text-primary font-black text-xl">
                          ₦{fareBreakdown.driverEarnings.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-slate-400 text-xs">
                    Owner has been notified to make payment
                  </p>

                  <button
                    onClick={() => {
                      setActiveRide(null);
                      setRidePhase('pickup');
                      setFareBreakdown(null);
                      setTripTimer(0);
                    }}
                    className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold active:scale-95 transition-all"
                  >
                    Back to Radar
                  </button>
                </div>
              )}

              {ridePhase === 'completed' && !fareBreakdown && (
                <div className="w-full py-6 text-center bg-green-500/10 border-2 border-green-500/30 rounded-[2rem] animate-scale-in flex flex-col items-center gap-2">
                  <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white mb-2 shadow-lg shadow-green-500/40">
                    <span className="material-symbols-outlined text-3xl filled">verified</span>
                  </div>
                  <p className="text-green-500 text-xl font-black">Trip Success!</p>
                  <button
                    onClick={() => {
                      setActiveRide(null);
                      setRidePhase('pickup');
                      setFareBreakdown(null);
                      setTripTimer(0);
                    }}
                    className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold active:scale-95 transition-all"
                  >
                    Back to Radar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showSelfieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-dark border border-white/10 p-6 rounded-[2rem] w-full max-w-sm text-center flex flex-col">
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


