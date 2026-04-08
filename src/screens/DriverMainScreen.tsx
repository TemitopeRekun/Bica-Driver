import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Stores & Hooks
import { useAuthStore } from '@/stores/authStore';
import { useRideStore } from '@/stores/rideStore';
import { useUIStore } from '@/stores/uiStore';
import { useDriverManager } from '@/hooks/useDriverManager';
import { useDriverRealtime, DriverRideRequest } from '@/hooks/useDriverRealtime';

// Components
import InteractiveMap from '@/components/InteractiveMap';
import TripProgressTimeline from '@/components/Driver/TripProgressTimeline';
import { CapacitorService } from '@/services/CapacitorService';
import { IMAGES } from '@/constants';
import { CameraSource, CameraDirection } from '@capacitor/camera';

const DriverMainScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuthStore();
  const { addToast } = useUIStore();
  const { rideState, setRideState, rideMilestone, setRideMilestone } = useRideStore();
  const { 
    walletSummary, loadWalletSummary, updateRideStatus, acceptRide, declineRide 
  } = useDriverManager();

  const [activeRide, setActiveRide] = useState<DriverRideRequest | null>(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [pendingRide, setPendingRide] = useState<DriverRideRequest | null>(null);

  const handleOnlineStatusChange = React.useCallback((nextIsOnline: boolean) => {
    // Optional: Log status change or update local UI state if needed
  }, []);

  const handleForcedLogout = React.useCallback((message?: string) => {
     addToast(message || 'Session expired.', 'error');
     logout();
  }, [addToast, logout]);

  const {
    isOnline, isLocationRefreshing, availabilityIssue, driverPos,
    liveRideRequests, enableOnline, disableOnline, removeRideRequest
  } = useDriverRealtime({
    user: currentUser,
    approvalStatus: currentUser?.approvalStatus || 'PENDING',
    onOnlineStatusChange: handleOnlineStatusChange,
    onForcedLogout: handleForcedLogout,
  });

  useEffect(() => {
    loadWalletSummary();
  }, [loadWalletSummary]);

  const handleToggleOnline = () => {
    CapacitorService.triggerHaptic();
    if (isOnline) disableOnline();
    else enableOnline();
  };

  const handleAcceptRide = (ride: DriverRideRequest) => {
    setPendingRide(ride);
    setShowSelfieModal(true);
  };

  const confirmSelfieAndRide = async () => {
    if (!pendingRide || !selfieImage) return;
    try {
      await acceptRide(pendingRide.id);
      setActiveRide(pendingRide);
      setShowSelfieModal(false);
      removeRideRequest(pendingRide.id);
    } catch (e) {}
  };

  const handleUpdateStatus = async (status: 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED') => {
    if (!activeRide) return;
    try {
      await updateRideStatus(activeRide.id, status);
      if (status === 'COMPLETED') {
        setActiveRide(null);
      }
    } catch (e) {}
  };

  const mapMarkers: any[] = [{ id: 'driver-me', position: driverPos, title: 'You', icon: 'taxi' }];
  if (activeRide) {
    if (rideMilestone === 'assigned' || rideMilestone === 'arrived') {
      mapMarkers.push({ id: 'pickup', position: activeRide.coords, title: 'Pickup', icon: 'pickup' });
    } else if (rideMilestone === 'in_progress') {
      mapMarkers.push({ id: 'dest', position: activeRide.destCoords, title: 'Destination', icon: 'destination' });
    }
  }

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col relative bg-background-dark font-display">
      <div className={`absolute inset-0 z-0 transition-all duration-700 ${!isOnline ? 'grayscale brightness-50' : ''}`}>
        <InteractiveMap center={driverPos} markers={mapMarkers} />
      </div>

       {/* Header */}
       <header className="relative z-10 p-4 pt-8 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <button onClick={() => navigate('/profile')} className="size-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 overflow-hidden">
             {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt="" /> : <span className="material-symbols-outlined text-white">person</span>}
          </button>

          <div className="flex-1 mx-4 h-12 bg-white/10 backdrop-blur-md rounded-full border border-white/10 p-1 flex">
             <button onClick={handleToggleOnline} className={`flex-1 rounded-full text-[10px] font-black uppercase transition-all ${!isOnline ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Offline</button>
             <button onClick={handleToggleOnline} className={`flex-1 rounded-full text-[10px] font-black uppercase transition-all ${isOnline ? 'bg-primary text-white' : 'text-slate-400'}`}>Online</button>
          </div>

          <button onClick={() => navigate('/driver/activity')} className="size-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white">
             <span className="material-symbols-outlined">history</span>
          </button>
       </header>

       <div className="flex-1"></div>

       {/* Bottom Sheet */}
       <div className="relative z-20 w-full bg-surface-dark rounded-t-[2.5rem] shadow-2xl p-6 border-t border-white/5">
          {!activeRide ? (
             <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold text-white">Ride Requests</h3>
                   {isOnline && <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-black rounded-full border border-primary/20 animate-pulse uppercase">Searching</span>}
                </div>

                {liveRideRequests.length > 0 ? (
                   liveRideRequests.map(req => (
                      <div key={req.id} className="bg-white/5 p-5 rounded-3xl border border-white/5 flex flex-col gap-4">
                         <div className="flex justify-between">
                            <div className="flex items-center gap-3">
                               <img src={req.avatar} className="size-10 rounded-full" alt="" />
                               <div>
                                  <p className="font-bold text-white text-sm">{req.ownerName}</p>
                                  <p className="text-[10px] text-slate-400">4.9 · Verified Owner</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] text-slate-500 font-bold uppercase">Reward</p>
                               <p className="text-xl font-black text-primary italic">₦{req.price}</p>
                            </div>
                         </div>
                         <button onClick={() => handleAcceptRide(req)} className="w-full bg-primary py-4 rounded-2xl text-white font-black shadow-lg">Accept Request</button>
                      </div>
                   ))
                ) : (
                   <div className="py-12 text-center text-slate-500">
                      <span className="material-symbols-outlined text-4xl mb-4 block">radar</span>
                      <p className="text-sm">{isOnline ? 'Waiting for requests in your area...' : 'Go online to start earning'}</p>
                   </div>
                )}
             </div>
          ) : (
             <div className="flex flex-col gap-6 animate-slide-up">
                <TripProgressTimeline milestone={rideMilestone as any} />
                <div className="bg-white/5 p-5 rounded-3xl space-y-4">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <img src={activeRide.avatar} className="size-12 rounded-full border-2 border-primary" alt="" />
                        <h4 className="font-bold text-white text-lg">{activeRide.ownerName}</h4>
                      </div>
                      <button className="size-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center"><span className="material-symbols-outlined">call</span></button>
                   </div>
                   
                   {rideMilestone === 'assigned' && <button onClick={() => handleUpdateStatus('ARRIVED')} className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg">I Have Arrived</button>}
                   {rideMilestone === 'arrived' && <button onClick={() => handleUpdateStatus('IN_PROGRESS')} className="w-full bg-accent py-5 rounded-2xl text-white font-black text-lg">Start Trip</button>}
                   {rideMilestone === 'in_progress' && <button onClick={() => handleUpdateStatus('COMPLETED')} className="w-full bg-red-500 py-5 rounded-2xl text-white font-black text-lg">End Trip</button>}
                </div>
             </div>
          )}
       </div>

       {/* Selfie Modal */}
       {showSelfieModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6">
             <div className="w-full max-w-sm bg-surface-dark rounded-[2rem] p-8 flex flex-col items-center gap-6">
                <h3 className="text-xl font-bold text-white">Security Check</h3>
                <p className="text-sm text-slate-400 text-center">Please take a quick selfie to confirm your identity before starting.</p>
                <div onClick={() => !selfieImage && CapacitorService.takePhoto(CameraSource.Camera, CameraDirection.Front).then(setSelfieImage)} className="size-48 rounded-full bg-white/5 border-2 border-dashed border-primary/40 flex items-center justify-center overflow-hidden">
                   {selfieImage ? <img src={selfieImage} className="w-full h-full object-cover" alt="" /> : <span className="material-symbols-outlined text-4xl text-primary">face_retouching_natural</span>}
                </div>
                {selfieImage ? (
                   <button onClick={confirmSelfieAndRide} className="w-full bg-primary py-4 rounded-2xl text-white font-bold">Verify & Accept</button>
                ) : (
                   <button onClick={() => setShowSelfieModal(false)} className="text-slate-500 font-bold">Cancel</button>
                )}
             </div>
          </div>
       )}
    </div>
  );
};

export default DriverMainScreen;
