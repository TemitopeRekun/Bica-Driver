
import React, { useState, useEffect, useRef } from 'react';
import InteractiveMap from '../components/InteractiveMap';
import { CapacitorService } from '../services/CapacitorService';
import { UserProfile, Trip } from '../types';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api.service';

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
}

const MOCK_REQUESTS: RideRequest[] = [
  {
    id: '1',
    ownerName: 'Sarah Johnson',
    pickup: 'Lekki Phase 1, Lagos',
    destination: 'Ikeja City Mall, Ikeja',
    distance: '15.5 km',
    price: '12,500',
    time: '5 mins',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    coords: [6.4478, 3.4737],
    destCoords: [6.5913, 3.3506]
  }
];

type RidePhase = 'pickup' | 'arrived' | 'trip' | 'completed';

interface DriverMainScreenProps {
  user: UserProfile | null;
  onOpenProfile: () => void;
  onBack: () => void;
  onUpdateEarnings: (amount: number) => void;
  onRequestPayout: (amount: number) => void;
  onRideComplete: (trip: Trip) => void;
}

import { CameraSource, CameraDirection } from '@capacitor/camera';

// ... existing imports

const DriverMainScreen: React.FC<DriverMainScreenProps> = ({ 
  user, onOpenProfile, onBack, onUpdateEarnings, onRequestPayout, onRideComplete 
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [ridePhase, setRidePhase] = useState<RidePhase>('pickup');
  const [driverPos, setDriverPos] = useState<[number, number]>([6.4549, 3.3896]);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [pendingRide, setPendingRide] = useState<RideRequest | null>(null);
  const lastRulesAccepted = useRef<number>(0);
  const trackingInterval = useRef<any>(null);

  const approvalStatus = user?.approvalStatus || 'PENDING';
  const totalEarnings = user?.walletBalance || 0;

  useEffect(() => {
    if (isOnline && approvalStatus === 'APPROVED') {
      const updateLocation = async () => {
        try {
          const pos = await CapacitorService.getCurrentLocation();
          if (pos) setDriverPos([pos.coords.latitude, pos.coords.longitude]);
        } catch (error) {
          console.error("Location update failed:", error);
        }
      };
      updateLocation();
      trackingInterval.current = setInterval(updateLocation, 10000);
    }
    return () => clearInterval(trackingInterval.current);
  }, [isOnline, approvalStatus]);

  const toggleOnline = () => {
    if (activeRide) return;
    CapacitorService.triggerHaptic();
    
    if (!isOnline) {
      // Going Online - Check if we need to show rules (every 6 hours)
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;
      if (now - lastRulesAccepted.current > sixHours) {
        setShowRulesModal(true);
        return;
      }
    }
    
    setIsOnline(prev => !prev);
  };

  const handleAcceptRules = () => {
    lastRulesAccepted.current = Date.now();
    setShowRulesModal(false);
    setIsOnline(true);
  };

  const handleAcceptRide = (ride: RideRequest) => {
    CapacitorService.triggerHaptic();
    setPendingRide(ride);
    setSelfieImage(null);
    setShowSelfieModal(true);
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

  const confirmSelfieAndRide = () => {
    if (pendingRide && selfieImage) {
      setActiveRide(pendingRide);
      setRidePhase('pickup');
      setShowSelfieModal(false);
      setPendingRide(null);
      setSelfieImage(null);
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

  const handleStartTrip = () => {
    CapacitorService.triggerHaptic();
    setRidePhase('trip');
  };

  const handleCompleteTrip = () => {
    if (!activeRide) return;
    
    CapacitorService.triggerHaptic();
    
    // Parse the price (strip commas)
    const tripPrice = parseInt((activeRide.price || '0').replace(/,/g, ''), 10);
    onUpdateEarnings(tripPrice);
    
    // Report to Admin Dashboard History
    const newTrip: Trip = {
      id: `t_${Math.random().toString(36).substr(2, 5)}`,
      driverId: user?.id,
      driverName: user?.name || 'Unknown Driver',
      ownerName: activeRide.ownerName,
      date: new Date().toLocaleString(),
      amount: tripPrice,
      status: 'COMPLETED',
      location: `${activeRide?.pickup?.split(',')[0] || 'Unknown'} -> ${activeRide?.destination?.split(',')[0] || 'Unknown'}`
    };
    onRideComplete(newTrip);
    
    setRidePhase('completed');
    
    // Return to radar after a delay
    setTimeout(() => {
      setActiveRide(null);
      setRidePhase('pickup');
    }, 4000);
  };

  const handleRequestPayoutClick = () => {
    if (totalEarnings < 5000) {
      alert("Minimum payout amount is ₦5,000");
      return;
    }
    setShowPayoutModal(true);
  };

  const confirmPayout = () => {
    onRequestPayout(totalEarnings);
    setShowPayoutModal(false);
    alert("Payout request sent to Admin successfully!");
  };

  const openNavigation = (coords: [number, number]) => {
    CapacitorService.triggerHaptic();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`;
    window.open(url, '_blank');
  };

  const getPhaseText = () => {
    switch(ridePhase) {
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
                 className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 shadow-md ${
                   isOnline ? 'translate-x-full left-0 ml-1 bg-primary' : 'left-1 bg-slate-600'
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
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Total Earnings</span>
                <span className="text-xl font-black text-white tracking-tight">{formatCurrency(totalEarnings)}</span>
              </div>
              <div className="w-px h-8 bg-white/10 mx-2"></div>
              <button 
                onClick={handleRequestPayoutClick}
                className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline active:scale-95 transition-all"
              >
                Payout
              </button>
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
                   MOCK_REQUESTS.map(req => (
                      <div key={req.id} className="bg-input-dark/40 p-5 rounded-3xl border border-white/5 flex flex-col gap-4 shadow-lg animate-slide-up">
                         <div className="flex items-center gap-4">
                            <img src={req.avatar} className="w-12 h-12 rounded-full object-cover ring-2 ring-white/5" alt="" />
                            <div className="flex-1">
                               <h4 className="font-bold text-white text-base leading-tight">{req.ownerName}</h4>
                               <p className="text-slate-500 text-xs mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">map</span>{req.pickup}</p>
                            </div>
                            <div className="text-right">
                               <p className="font-black text-white text-lg leading-none">₦{req.price}</p>
                               <p className="text-primary text-[10px] font-bold mt-1.5">{req.time} away</p>
                            </div>
                         </div>
                         <button 
                          onClick={() => handleAcceptRide(req)} 
                          className="w-full bg-primary text-white font-black py-4 rounded-2xl active:scale-[0.97] transition-all hover:brightness-110"
                         >
                          Accept Ride
                         </button>
                      </div>
                   ))
                 ) : (
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
                  <button onClick={handleCompleteTrip} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                    Complete Trip
                  </button>
                )}
                {ridePhase === 'completed' && (
                  <div className="w-full py-6 text-center bg-green-500/10 border-2 border-green-500/30 rounded-[2rem] animate-scale-in flex flex-col items-center gap-2">
                    <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white mb-2 shadow-lg shadow-green-500/40">
                       <span className="material-symbols-outlined text-3xl filled">verified</span>
                    </div>
                    <p className="text-green-500 text-xl font-black">Trip Success!</p>
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

      {showPayoutModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface-dark border border-white/10 p-6 rounded-[2rem] w-full max-w-sm text-center">
               <span className="material-symbols-outlined text-4xl text-white mb-3 bg-white/10 p-4 rounded-full">payments</span>
               <h3 className="text-xl font-bold text-white mb-2">Request Payout</h3>
               <p className="text-slate-400 text-sm mb-6">
                 Withdraw your full balance of <span className="text-white font-bold">{formatCurrency(totalEarnings)}</span>? 
                 <br/><br/>
                 This request will be sent to Admin for approval.
               </p>
               <div className="flex gap-3">
                  <button onClick={() => setShowPayoutModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-bold">Cancel</button>
                  <button onClick={confirmPayout} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold">Confirm</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default DriverMainScreen;
