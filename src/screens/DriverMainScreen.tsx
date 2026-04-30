import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Stores & Hooks
import { useAuthStore } from '@/stores/authStore';
import { useRideStore } from '@/stores/rideStore';
import { useUIStore } from '@/stores/uiStore';
import { useDriverManager } from '@/hooks/useDriverManager';
import { useDriverRealtime, DriverRideRequest } from '@/hooks/useDriverRealtime';
import { useCarVerification } from '@/hooks/useCarVerification';

// Components
import InteractiveMap from '@/components/InteractiveMap';
import TripProgressTimeline from '@/components/Driver/TripProgressTimeline';
import TripPaymentSummary from '@/components/RequestRide/TripPaymentSummary';
import RideRequestCard from '@/components/Driver/RideRequestCard';
import CarConditionModal from '@/components/Driver/CarConditionModal';
import { CapacitorService } from '@/services/CapacitorService';
import { IMAGES } from '@/constants';
import { CameraSource, CameraDirection } from '@capacitor/camera';
import { api } from '@/services/api.service';

const DriverMainScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuthStore();
  const { addToast } = useUIStore();
  const { rideMilestone, setRideState, setRideMilestone } = useRideStore();
  const { 
    walletSummary, loadWalletSummary, updateRideStatus, acceptRide, declineRide, syncCurrentRide 
  } = useDriverManager();

  const [activeRide, setActiveRide] = useState<DriverRideRequest | null>(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [pendingRide, setPendingRide] = useState<DriverRideRequest | null>(null);
  const [completedTripSummary, setCompletedTripSummary] = useState<any | null>(null);

  // Car Condition State (Refactored to Hook)
  const [showConditionModal, setShowConditionModal] = useState(false);
  const {
    conditionStep, setConditionStep, carPhotos, isCapturing, handleSnap, reset: resetCondition, isComplete: isConditionComplete, sides
  } = useCarVerification(activeRide?.id || '');

  // OTP Verification State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // For selfie

  const {
    isOnline, driverPos, liveRideRequests, enableOnline, disableOnline, removeRideRequest
  } = useDriverRealtime({
    user: currentUser,
    approvalStatus: currentUser?.approvalStatus || 'PENDING',
    onOnlineStatusChange: () => {},
    onForcedLogout: (msg) => { addToast(msg || 'Session expired.', 'error'); logout(); },
    onRideProgress: (payload) => {
       const m = payload.milestone?.toLowerCase();
       if (m === 'inprogress' || m === 'in_progress' || m === 'trip') setRideMilestone('in_progress');
       else if (m === 'arrived') setRideMilestone('arrived');
       else if (m === 'assigned') setRideMilestone('assigned');
       else if (m === 'completed') setRideMilestone('completed');
    },
    onPaymentUpdated: (payload) => {
       if (payload.paymentStatus === 'PAID') {
          addToast('Payment received! Fare settled.', 'success');
          setCompletedTripSummary((prev: any) => prev ? { ...prev, paymentStatus: 'PAID' } : null);
       }
    }
  });

  useEffect(() => {
    loadWalletSummary();
    const recoverSession = async () => {
      try {
        const trip = await syncCurrentRide();
        if (trip && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(trip.status)) {
           if (trip.driverId === currentUser?.id && trip.status !== 'PENDING_ACCEPTANCE') {
             setActiveRide({
               id: trip.id,
               ownerName: trip.owner?.name || 'Car Owner',
               pickup: trip.pickupAddress,
               destination: trip.destAddress,
               distance: `${trip.distanceKm?.toFixed(1)} km`,
               price: trip.driverEarnings?.toLocaleString() || trip.amount?.toLocaleString(),
               timeToPickup: `${trip.estimatedArrivalMins || 5}m to pickup`,
               tripDuration: `${trip.estimatedMins || 10}m trip`,
               avatar: trip.owner?.avatarUrl || IMAGES.USER_AVATAR,
               coords: [trip.pickupLat, trip.pickupLng],
               destCoords: [trip.destLat, trip.destLng],
             });
           }
        }
      } catch (e) {}
    };
    recoverSession();
  }, [syncCurrentRide, currentUser?.id, loadWalletSummary]);

  const handleToggleOnline = () => {
    CapacitorService.triggerHaptic();
    if (isOnline) disableOnline();
    else enableOnline();
  };

  const handleAcceptRide = (ride: DriverRideRequest) => {
    setPendingRide(ride);
    setShowSelfieModal(true);
  };

  const handleCaptureSelfie = () => {
    if (isUploading || selfieImage) return;
    
    console.log('Attempting to trigger camera...');
    
    // 🛡️ IMPORTANT: Call takePhoto immediately to preserve User Gesture context for Web browsers
    CapacitorService.takePhoto(CameraSource.Camera, CameraDirection.Front)
      .then(async (base64) => {
        if (!base64) {
          console.log('Capture cancelled by user');
          return;
        }

        console.log('Photo captured, starting upload...');
        setIsUploading(true);
        try {
          const { url } = await api.post<{ url: string }>('/rides/upload-photo', { 
            image: base64, 
            folder: 'selfies' 
          });
          setSelfieImage(url);
          addToast('Selfie verified!', 'success');
        } catch (error: any) {
          console.error('Selfie upload failed:', error);
          addToast('Upload failed. Please try again.', 'error');
        } finally {
          setIsUploading(false);
        }
      })
      .catch((error) => {
        console.error('Camera trigger failed:', error);
        addToast('Could not open camera.', 'error');
      });
  };

  const confirmSelfieAndRide = async () => {
    if (!pendingRide || !selfieImage) return;
    try {
      setIsUploading(true);
      await acceptRide(pendingRide.id, selfieImage);
      setActiveRide({ ...pendingRide, acceptanceImageUrl: selfieImage });
      setShowSelfieModal(false);
      setSelfieImage(null);
      removeRideRequest(pendingRide.id);
    } catch (e: any) {
      addToast(e.message || 'Verification failed.', 'error');
    } finally { setIsUploading(false); }
  };

  const confirmConditionAndNext = () => {
    if (!isConditionComplete) {
      addToast('Please take all 4 photos before starting.', 'warning');
      return;
    }
    setShowConditionModal(false);
    setShowOtpModal(true);
  };

  const verifyOtpAndStart = async () => {
    if (!activeRide || !otpValue) return;
    try {
      setIsVerifyingOtp(true);
      await updateRideStatus(activeRide.id, 'IN_PROGRESS', {
        otp: otpValue,
        carFrontUrl: carPhotos.FRONT,
        carBackUrl: carPhotos.BACK,
        carLeftUrl: carPhotos.LEFT,
        carRightUrl: carPhotos.RIGHT
      });
      setShowOtpModal(false);
      setOtpValue('');
      setOtpAttempts(0);
      addToast('Ride started! Drive safely.', 'success');
    } catch (error: any) {
      setOtpAttempts(prev => prev + 1);
    } finally { setIsVerifyingOtp(false); }
  };

  const handleUpdateStatus = async (status: 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED') => {
    if (!activeRide) return;
    try {
      const result = await updateRideStatus(activeRide.id, status);
      if (status === 'COMPLETED') {
        setCompletedTripSummary({ ...result, pickup: activeRide.pickup, destination: activeRide.destination });
        setActiveRide(null);
        resetCondition();
      }
    } catch (error: any) {
      if (error.status === 400) {
        const trip = await syncCurrentRide();
        if (!trip) setActiveRide(null);
      }
    }
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

       <header className="relative z-10 p-4 pt-8 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <button onClick={() => navigate('/profile')} className="size-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 overflow-hidden" aria-label="Profile">
             {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt="" /> : <span className="material-symbols-outlined text-white">person</span>}
          </button>
          <div className="flex-1 mx-4 h-12 bg-white/10 backdrop-blur-md rounded-full border border-white/10 p-1 flex">
             <button onClick={handleToggleOnline} className={`flex-1 rounded-full text-[10px] font-black uppercase transition-all ${!isOnline ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Offline</button>
             <button onClick={handleToggleOnline} className={`flex-1 rounded-full text-[10px] font-black uppercase transition-all ${isOnline ? 'bg-primary text-white' : 'text-slate-400'}`}>Online</button>
          </div>
          <button onClick={() => navigate('/driver/activity')} className="size-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white" aria-label="Activity">
             <span className="material-symbols-outlined">receipt_long</span>
          </button>
       </header>

       <div className="flex-1"></div>

       <div className="relative z-20 w-full bg-surface-dark rounded-t-[2.5rem] shadow-2xl p-6 border-t border-white/5">
          {!activeRide ? (
             <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold text-white">Ride Requests</h3>
                   {isOnline && <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-black rounded-full border border-primary/20 animate-pulse uppercase">Searching</span>}
                </div>
                {liveRideRequests.length > 0 ? (
                   liveRideRequests.map((req) => <RideRequestCard key={req.id} request={req} onAccept={handleAcceptRide} onDecline={(r) => declineRide(r.id)} />)
                ) : (
                   <div className="py-12 text-center text-slate-500">
                      <span className="material-symbols-outlined text-4xl mb-4 block">radar</span>
                      <p className="text-sm">{isOnline ? 'Waiting for requests...' : 'Go online to start'}</p>
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
                      <button className="size-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center" aria-label="Call Owner"><span className="material-symbols-outlined">call</span></button>
                   </div>
                    {rideMilestone === 'assigned' && <button onClick={() => handleUpdateStatus('ARRIVED')} className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg">I Have Arrived</button>}
                    {rideMilestone === 'arrived' && <button onClick={() => setShowConditionModal(true)} className="w-full bg-accent py-5 rounded-2xl text-white font-black text-lg">Upload Car Photos</button>}
                    {rideMilestone === 'in_progress' && <button onClick={() => handleUpdateStatus('COMPLETED')} className="w-full bg-red-500 py-5 rounded-2xl text-white font-black text-lg">End Trip</button>}
                 </div>
              </div>
           )}
        </div>

        {showConditionModal && (
          <CarConditionModal 
            conditionStep={conditionStep} carPhotos={carPhotos} isCapturing={isCapturing}
            onSnap={handleSnap} onBack={() => {}} onConfirm={confirmConditionAndNext}
            onCancel={() => setShowConditionModal(false)} setConditionStep={setConditionStep} sides={sides}
          />
        )}

        {showOtpModal && (
          <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl">
            <div className="w-full max-w-sm bg-surface-dark rounded-[3rem] p-8 border border-white/10 shadow-2xl space-y-8">
              <div className="text-center space-y-2">
                <div className="size-16 rounded-3xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
                </div>
                <h3 className="text-2xl font-black text-white uppercase italic">Verify Start Code</h3>
                <p className="text-slate-400 text-sm">Ask the owner for their 4-digit verification PIN</p>
              </div>
              <div className="space-y-4">
                <input 
                  type="number" value={otpValue} onChange={(e) => setOtpValue(e.target.value.slice(0, 4))}
                  placeholder="0000" className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-6 text-center text-4xl font-black text-white tracking-[1rem] focus:border-primary outline-none"
                />
                {otpAttempts > 0 && <p className="text-center text-red-400 text-xs font-bold animate-shake">Incorrect PIN. Attempt {otpAttempts} of 5.</p>}
              </div>
              <div className="space-y-3">
                <button onClick={verifyOtpAndStart} disabled={otpValue.length < 4 || isVerifyingOtp} className="w-full bg-primary disabled:bg-slate-700 py-5 rounded-2xl text-white font-black text-xl flex items-center justify-center gap-3">
                  {isVerifyingOtp ? <div className="size-6 border-3 border-white/30 border-t-white rounded-full animate-spin" /> : 'Start Trip'}
                </button>
                <button onClick={() => setShowOtpModal(false)} className="w-full py-4 text-slate-500 font-bold text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

       {showSelfieModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6">
             <div className="w-full max-w-sm bg-surface-dark rounded-[2rem] p-8 flex flex-col items-center gap-6">
                <h3 className="text-xl font-bold text-white">Security Check</h3>
                <p className="text-sm text-slate-400 text-center">Take a quick selfie to confirm identity.</p>
                <div 
                   onClick={() => !selfieImage && handleCaptureSelfie()} 
                   className={`size-48 rounded-full bg-white/5 border-2 border-dashed border-primary/40 flex items-center justify-center overflow-hidden transition-all active:scale-95 cursor-pointer ${!selfieImage ? 'hover:bg-primary/5 hover:border-primary' : ''}`}
                >
                   {selfieImage ? <img src={selfieImage} className="w-full h-full object-cover" alt="" /> : <span className="material-symbols-outlined text-4xl text-primary animate-pulse">face_retouching_natural</span>}
                </div>
                {selfieImage ? (
                   <button onClick={confirmSelfieAndRide} disabled={isUploading} className="w-full bg-primary py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2">
                     {isUploading && <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                     Verify & Accept
                   </button>
                ) : ( <button onClick={() => setShowSelfieModal(false)} className="text-slate-500 font-bold">Cancel</button> )}
             </div>
          </div>
       )}

       {completedTripSummary && (
          <TripPaymentSummary 
            role="DRIVER" pickup={completedTripSummary.pickup} destination={completedTripSummary.destination}
            fareBreakdown={{
              distanceKm: completedTripSummary.distanceKm || 0,
              actualMins: completedTripSummary.actualMins || 0,
              finalFare: completedTripSummary.finalFare || 0,
              driverEarnings: completedTripSummary.driverEarnings || 0
            }}
            paymentStatus={completedTripSummary.paymentStatus || 'UNPAID'}
            paymentMessage={completedTripSummary.paymentStatus === 'PAID' ? 'Payment confirmed! Thank you.' : ''}
            onClose={() => { setCompletedTripSummary(null); setRideState('IDLE'); }}
          />
       )}
    </div>
  );
};

export default DriverMainScreen;
