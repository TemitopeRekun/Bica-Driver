import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Stores & Hooks
import { useAuthStore } from '@/stores/authStore';
import { useRideStore } from '@/stores/rideStore';
import { useUIStore } from '@/stores/uiStore';
import { useDriverManager } from '@/hooks/useDriverManager';
import { useDriverRealtime, DriverRideRequest } from '@/hooks/useDriverRealtime';
import { useCarVerification } from '@/hooks/useCarVerification';
import { useConnectivityStore } from '@/stores/connectivityStore';

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
import { Skeleton, CardSkeleton } from '@/components/Common/Skeleton';
import { InlineError } from '@/components/Common/InlineError';
import EmergencyHelpSheet from '@/components/EmergencyHelpSheet';
import { EmergencyHelpContext } from '@/types';

const DriverMainScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuthStore();
  const { addToast } = useUIStore();
  const { rideMilestone, setRideState, setRideMilestone } = useRideStore();
  const {
    walletSummary, loadWalletSummary, updateRideStatus, acceptRide, declineRide, syncCurrentRide, regenerateOtp
  } = useDriverManager();
  const { setSupportOpen, setSupportContext } = useUIStore();
  const { isReconnecting, isSocketConnected, isOnline: isNetworkOnline } = useConnectivityStore();

  // ── State ────────────────────────────────────────────────────────────────
  const [activeRide, setActiveRide] = useState<DriverRideRequest | null>(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [pendingRide, setPendingRide] = useState<DriverRideRequest | null>(null);
  const [completedTripSummary, setCompletedTripSummary] = useState<any | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [showEmergencyHelp, setShowEmergencyHelp] = useState(false);

  const [showConditionModal, setShowConditionModal] = useState(false);
  const {
    conditionStep, setConditionStep, carPhotos, isCapturing, handleSnap, reset: resetCondition, isComplete: isConditionComplete, sides
  } = useCarVerification(activeRide?.id || '');

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [regenCooldown, setRegenCooldown] = useState(0);

  // ── Stable realtime callbacks (prevent socket re-subscription on every render) ──
  const onForcedLogout = useCallback((msg?: string) => {
    addToast(msg || 'Session expired.', 'error');
    logout();
  }, [addToast, logout]);

  const onRideProgress = useCallback((payload: any) => {
    const m = payload.milestone?.toLowerCase();
    if (m === 'inprogress' || m === 'in_progress' || m === 'trip') setRideMilestone('in_progress');
    else if (m === 'arrived') setRideMilestone('arrived');
    else if (m === 'assigned') setRideMilestone('assigned');
    else if (m === 'completed') setRideMilestone('completed');
  }, [setRideMilestone]);

  const onRideCancelled = useCallback((payload: any) => {
    if (payload.tripId === activeRide?.id) {
      addToast(payload.message || 'Ride was cancelled by the owner.', 'info');
      setActiveRide(null);
      setRideMilestone('requested');
    }
  }, [activeRide?.id, addToast, setRideMilestone]);

  const onPaymentUpdated = useCallback((payload: any) => {
    if (payload.paymentStatus === 'PAID') {
      addToast('Payment received! Fare settled.', 'success');
      setCompletedTripSummary((prev: any) => {
        if (prev) return { ...prev, paymentStatus: 'PAID' };

        // Reconstruct summary if it was dismissed, using persisted store data
        const storedTrip = useRideStore.getState().completedTripData;
        if (!storedTrip) return null;

        return {
          ...storedTrip,
          paymentStatus: 'PAID',
          driverEarnings: payload.driverEarnings ?? storedTrip.driverEarnings,
          paidAt: payload.paidAt ?? new Date().toISOString(),
        };
      });
    }
  }, [addToast]);

  const {
    isOnline, driverPos, liveRideRequests, enableOnline, disableOnline, removeRideRequest, availabilityIssue,
  } = useDriverRealtime({
    user: currentUser,
    approvalStatus: currentUser?.approvalStatus || 'PENDING',
    onOnlineStatusChange: () => {},
    onForcedLogout,
    onRideProgress,
    onRideCancelled,
    onPaymentUpdated,
  });

  // ── Effects for Loading State ──
  useEffect(() => {
    if (isOnline && isSocketConnected && liveRideRequests.length === 0) {
      setIsInitialLoading(true);
      const timer = setTimeout(() => setIsInitialLoading(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setIsInitialLoading(false);
    }
  }, [isOnline, isSocketConnected, liveRideRequests.length]);

  // ── Derived memoized values ──────────────────────────────────────────────
  const emergencyContext = useMemo<EmergencyHelpContext>(() => ({
    tripId: activeRide?.id,
    tripStatus: activeRide?.status,
    pickupAddress: activeRide?.pickupAddress,
    destAddress: activeRide?.destAddress,
    ownerName: activeRide?.ownerName,
    ownerPhone: activeRide?.ownerPhone,
    driverName: currentUser?.name || 'Driver',
    driverPhone: currentUser?.phone || '',
    locationLat: driverPos?.[0],
    locationLng: driverPos?.[1],
  }), [activeRide, driverPos, currentUser?.name, currentUser?.phone]);

  const mapMarkers = useMemo(() => {
    const markers: any[] = [{ id: 'driver-me', position: driverPos, title: 'You', icon: 'taxi' }];
    if (activeRide) {
      if (rideMilestone === 'assigned' || rideMilestone === 'arrived') {
        markers.push({ id: 'pickup', position: activeRide.coords, title: 'Pickup', icon: 'pickup' });
      } else if (rideMilestone === 'in_progress') {
        markers.push({ id: 'dest', position: activeRide.destCoords, title: 'Destination', icon: 'destination' });
      }
    }
    return markers;
  }, [driverPos, activeRide, rideMilestone]);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadWalletSummary();
    const recoverSession = async () => {
      try {
        setRequestsError(null);
        const trip = await syncCurrentRide();
        if (trip && !['CANCELLED', 'REJECTED'].includes(trip.status)) {
           if (trip.status === 'COMPLETED') {
             setCompletedTripSummary({
               ...trip,
               pickup: trip.pickupAddress,
               destination: trip.destAddress
             });
           } else if (trip.driverId === currentUser?.id && trip.status !== 'PENDING_ACCEPTANCE') {
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
               status: trip.status,
               pickupAddress: trip.pickupAddress,
               destAddress: trip.destAddress,
               ownerPhone: trip.owner?.phone,
               driverEarnings: trip.driverEarnings,
             });
           }
        }
      } catch (e: any) {
        setRequestsError('Failed to synchronize with server. Please try again.');
      }
    };
    recoverSession();
  }, [syncCurrentRide, currentUser?.id, loadWalletSummary]);

  useEffect(() => {
    if (regenCooldown <= 0) return;
    const timer = setInterval(() => {
      setRegenCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [regenCooldown]);

  // ── Event handlers ───────────────────────────────────────────────────────
  const handleReportActiveTripIssue = useCallback(() => {
    if (!activeRide) return;
    setSupportContext({
      tripId: activeRide.id,
      tripStatus: (rideMilestone === 'in_progress' ? 'IN_PROGRESS' : 'ASSIGNED'),
      milestone: rideMilestone ?? undefined,
      driverEarnings: activeRide.driverEarnings ?? undefined,
      openedAt: new Date().toISOString(),
    });
    setSupportOpen(true);
  }, [activeRide, rideMilestone, setSupportContext, setSupportOpen]);

  const handleToggleOnline = useCallback(() => {
    CapacitorService.triggerHaptic();
    if (isOnline) disableOnline();
    else enableOnline();
  }, [isOnline, disableOnline, enableOnline]);

  const handleAcceptRide = useCallback((ride: DriverRideRequest) => {
    setPendingRide(ride);
    setShowSelfieModal(true);
  }, []);

  const handleCaptureSelfie = useCallback(() => {
    if (isUploading) return;

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
  }, [isUploading, addToast]);

  const confirmSelfieAndRide = useCallback(async () => {
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
  }, [pendingRide, selfieImage, acceptRide, addToast, removeRideRequest]);

  const confirmConditionAndNext = useCallback(() => {
    if (!isConditionComplete) {
      addToast('Please take all 4 photos before starting.', 'warning');
      return;
    }
    setShowConditionModal(false);
    setShowOtpModal(true);
  }, [isConditionComplete, addToast]);

  const verifyOtpAndStart = useCallback(async () => {
    if (!activeRide || !otpValue || isLockedOut) return;
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
      setIsLockedOut(false);
      addToast('Ride started! Drive safely.', 'success');
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('Maximum PIN attempts reached') || msg.includes('Too many failed attempts')) {
        setIsLockedOut(true);
      }
      setOtpAttempts(prev => prev + 1);
    } finally { setIsVerifyingOtp(false); }
  }, [activeRide, otpValue, isLockedOut, updateRideStatus, carPhotos, addToast]);

  const handleRegenerateOtp = useCallback(async () => {
    if (!activeRide || regenCooldown > 0) return;

    const res = await regenerateOtp(activeRide.id);
    if (res.success || res.cooldown) {
      setRegenCooldown(60);
      if (res.success) {
        setIsLockedOut(false);
        setOtpValue('');
        setOtpAttempts(0);
      }
    }
  }, [activeRide, regenCooldown, regenerateOtp]);

  const handleUpdateStatus = useCallback(async (status: 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED') => {
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
  }, [activeRide, updateRideStatus, resetCondition, syncCurrentRide]);

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col relative bg-background-dark font-display">
      <div className={`absolute inset-0 z-0 transition-all duration-700 ${!isOnline ? 'grayscale brightness-50' : ''}`}>
        <InteractiveMap center={driverPos} markers={mapMarkers} />
      </div>

       <header className="relative z-10 p-4 pt-8 flex flex-col gap-2 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/profile')} className="size-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 overflow-hidden" aria-label="Profile">
               {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt="" /> : <span className="material-symbols-outlined text-white">person</span>}
            </button>
            <div className={`flex-1 mx-4 h-12 bg-white/10 backdrop-blur-md rounded-full border border-white/10 p-1 flex ${activeRide || completedTripSummary ? 'opacity-50 pointer-events-none' : ''}`}>
               <button onClick={handleToggleOnline} className={`flex-1 rounded-full text-[10px] font-black uppercase transition-all ${!isOnline ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Offline</button>
               <button onClick={handleToggleOnline} className={`flex-1 rounded-full text-[10px] font-black uppercase transition-all ${isOnline ? 'bg-primary text-white' : 'text-slate-400'}`}>Online</button>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => !activeRide && !completedTripSummary && navigate('/driver/activity')}
                className={`size-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white ${activeRide || completedTripSummary ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Activity"
              >
                <span className="material-symbols-outlined">receipt_long</span>
              </button>
              {currentUser?.ratingPoints !== undefined && (
                <span className="text-[9px] font-black text-white/80 tracking-tight">
                  {(currentUser.ratingPoints / 100).toFixed(2)} ⭐
                </span>
              )}
            </div>
          </div>

          {/* Suspension banner */}
          {(currentUser?.isBlocked && currentUser?.suspendedUntil) && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-2xl bg-red-500/20 border border-red-500/30 backdrop-blur-md">
              <span className="material-symbols-outlined text-red-400 text-base mt-0.5 shrink-0">gavel</span>
              <p className="text-[10px] font-bold text-red-300 leading-snug">
                Account suspended until{' '}
                <span className="font-black text-red-200">
                  {new Date(currentUser.suspendedUntil).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </p>
            </div>
          )}

          {/* Server-side suspension or block message (e.g. after attempting to go online) */}
          {availabilityIssue && !availabilityIssue.includes('location') && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-2xl bg-red-500/20 border border-red-500/30 backdrop-blur-md">
              <span className="material-symbols-outlined text-red-400 text-base mt-0.5 shrink-0">block</span>
              <p className="text-[10px] font-bold text-red-300 leading-snug">{availabilityIssue}</p>
            </div>
          )}

          {/* Rating warning banner */}
          {!currentUser?.isBlocked && currentUser?.ratingPoints !== undefined && currentUser.ratingPoints < 460 && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-2xl bg-amber-500/20 border border-amber-500/30 backdrop-blur-md">
              <span className="material-symbols-outlined text-amber-400 text-base mt-0.5 shrink-0">warning</span>
              <p className="text-[10px] font-bold text-amber-300 leading-snug">
                Rating Alert: Your rating is{' '}
                <span className="font-black text-amber-200">{(currentUser.ratingPoints / 100).toFixed(2)}</span>.
                {' '}Improve your service to avoid suspension.
              </p>
            </div>
          )}
       </header>

       <div className="flex-1"></div>

       <div className="relative z-20 w-full bg-surface-dark rounded-t-[2.5rem] shadow-2xl p-6 border-t border-white/5">
          {!activeRide ? (
             <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold text-white">Ride Requests</h3>
                   {isOnline && isSocketConnected && <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-black rounded-full border border-primary/20 animate-pulse uppercase">Searching</span>}
                   {isOnline && !isSocketConnected && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-black rounded-full border border-amber-500/20 animate-pulse uppercase">Reconnecting</span>}
                </div>
                {requestsError ? (
                   <InlineError
                     message={requestsError}
                     onRetry={() => { setRequestsError(null); syncCurrentRide(); }}
                   />
                ) : liveRideRequests.length > 0 ? (
                   liveRideRequests.map((req) => <RideRequestCard key={req.id} request={req} onAccept={handleAcceptRide} onDecline={(r) => declineRide(r.id)} />)
                ) : (isOnline && isSocketConnected && isInitialLoading) ? (
                   <div className="space-y-4 animate-pulse">
                      <CardSkeleton />
                      <CardSkeleton />
                   </div>
                ) : (
                   <div className="py-12 text-center text-slate-500">
                      <span className="material-symbols-outlined text-4xl mb-4 block">radar</span>
                      <p className="text-sm">{isOnline ? 'Waiting for requests...' : 'Go online to start'}</p>
                   </div>
                )}
             </div>
          ) : (
             <div className="flex flex-col gap-4 animate-slide-up">
                <TripProgressTimeline milestone={rideMilestone as any} />
                <div className="bg-white/5 p-4 rounded-3xl space-y-3">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <div className="flex items-center gap-3">
                          <img src={activeRide.avatar} className="size-12 rounded-full border-2 border-primary" alt="" />
                          <h4 className="font-bold text-white text-lg">{activeRide.ownerName}</h4>
                        </div>
                        {/* Show Help during any active stage: Assigned, Arrived, or In Progress */}
                        {(['ASSIGNED', 'INPROGRESS', 'IN_PROGRESS', 'ARRIVED'].includes(activeRide?.status as any) || ['assigned', 'arrived', 'in_progress'].includes(rideMilestone)) && (
                          <button
                            onClick={() => setShowEmergencyHelp(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">emergency</span>
                            Get Help
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleReportActiveTripIssue}
                          className="size-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/10"
                          aria-label="Report Issue"
                        >
                          <span className="material-symbols-outlined">support_agent</span>
                        </button>
                        <button 
                          onClick={() => activeRide?.ownerPhone && window.open(`tel:${activeRide.ownerPhone}`, '_self')}
                          className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10" 
                          aria-label="Call Owner"
                        >
                          <span className="material-symbols-outlined">call</span>
                        </button>
                      </div>
                   </div>
                   {rideMilestone === 'assigned' && <button onClick={() => handleUpdateStatus('ARRIVED')} className="w-full bg-primary py-3.5 rounded-2xl text-white font-black text-sm uppercase tracking-wide">I Have Arrived</button>}
                   {rideMilestone === 'arrived' && <button onClick={() => setShowConditionModal(true)} className="w-full bg-accent py-3.5 rounded-2xl text-white font-black text-sm uppercase tracking-wide">Upload Car Photos</button>}
                   {rideMilestone === 'in_progress' && <button onClick={() => handleUpdateStatus('COMPLETED')} className="w-full bg-red-500 py-3.5 rounded-2xl text-white font-black text-sm uppercase tracking-wide">Complete Trip</button>}
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
                  disabled={isLockedOut}
                  placeholder="0000" className={`w-full bg-white/5 border-2 ${isLockedOut ? 'border-red-500/30' : 'border-white/10'} rounded-2xl py-6 text-center text-4xl font-black text-white tracking-[1rem] focus:border-primary outline-none transition-colors`}
                />
                {isLockedOut ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-shake">
                    <p className="text-center text-red-400 text-[10px] font-black uppercase tracking-widest">
                      Too many failed attempts. Please request a new PIN from the owner.
                    </p>
                  </div>
                ) : otpAttempts > 0 && (
                  <p className="text-center text-red-400 text-xs font-bold animate-shake">Incorrect PIN. Attempt {otpAttempts} of 5.</p>
                )}
              </div>
              <div className="space-y-3">
                <button
                  onClick={verifyOtpAndStart}
                  disabled={otpValue.length < 4 || isVerifyingOtp || isLockedOut}
                  className="w-full bg-primary disabled:bg-slate-700 py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-3 transition-all"
                >
                  {isVerifyingOtp ? <div className="size-6 border-3 border-white/30 border-t-white rounded-full animate-spin" /> : 'Start Trip'}
                </button>

                <button
                  onClick={handleRegenerateOtp}
                  disabled={regenCooldown > 0}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 disabled:bg-transparent rounded-2xl text-slate-300 disabled:text-slate-600 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">{regenCooldown > 0 ? 'timer' : 'refresh'}</span>
                  {regenCooldown > 0 ? `Resend PIN (${regenCooldown}s)` : 'Resend PIN'}
                </button>

                <button onClick={() => setShowOtpModal(false)} className="w-full py-2 text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">Cancel</button>
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
                   onClick={handleCaptureSelfie}
                   className={`group relative size-48 rounded-full bg-white/5 border-2 border-dashed border-primary/40 flex items-center justify-center overflow-hidden transition-all active:scale-95 cursor-pointer hover:bg-primary/5 hover:border-primary`}
                >
                   {selfieImage ? (
                      <>
                        <img src={selfieImage} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <span className="material-symbols-outlined text-white text-3xl mb-1">cached</span>
                           <span className="text-white text-[10px] font-black uppercase tracking-widest">Retake</span>
                        </div>
                      </>
                   ) : (
                      <span className="material-symbols-outlined text-4xl text-primary animate-pulse">face_retouching_natural</span>
                   )}
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
              billableDistanceKm: completedTripSummary.fareBreakdown?.billableDistanceKm ?? completedTripSummary.distanceKm ?? 0,
              estimatedDistanceKm: completedTripSummary.fareBreakdown?.estimatedDistanceKm ?? completedTripSummary.distanceKm ?? 0,
              distanceSource: completedTripSummary.fareBreakdown?.distanceSource,
              actualMins: completedTripSummary.fareBreakdown?.actualMins ?? completedTripSummary.totalMins ?? completedTripSummary.actualMins ?? 0,
              finalFare: completedTripSummary.amount || completedTripSummary.finalFare || 0,
              driverEarnings: completedTripSummary.driverEarnings || 0,
              commissionPercent: completedTripSummary.fareBreakdown?.commissionPercent,
            }}
            paymentStatus={completedTripSummary.paymentStatus || 'UNPAID'}
            paymentMessage={completedTripSummary.paymentStatus === 'PAID' ? 'Payment confirmed! Thank you.' : ''}
            onClose={() => { setCompletedTripSummary(null); setRideState('IDLE'); }}
          />
       )}
      {showEmergencyHelp && (
        <EmergencyHelpSheet
          context={emergencyContext}
          onClose={() => setShowEmergencyHelp(false)}
        />
      )}
    </div>
  );
};

export default DriverMainScreen;
