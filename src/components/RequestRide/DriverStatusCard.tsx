import React from 'react';
import RideStoryTimeline from './RideStoryTimeline';
import { IMAGES } from '../../constants';
import { LocationService } from '@/services/LocationService';

interface DriverStatusCardProps {
  rideState: string;
  rideMilestone: string;
  lastMilestoneUpdate: string;
  driverInfo: {
    name: string;
    car: string;
    plate: string;
    rating: number;
    trips: number;
    avatar: string;
    timeAway: number;
    otp?: string;
    acceptanceImageUrl?: string;
  };
  trackedDriverPos?: [number, number] | null;
  pickup?: { lat: number; lon: number } | null;
  onCall: () => void;
  onChat: () => void;
  onSupport: () => void;
  onTrack: () => void;
  onSOS: () => void;
  onCancel?: () => void;
  onArrived?: () => void;
}

const DriverStatusCard: React.FC<DriverStatusCardProps> = ({
  rideState,
  rideMilestone,
  lastMilestoneUpdate,
  driverInfo,
  onCall,
  onChat,
  onSupport,
  onTrack,
  onSOS,
  onCancel,
  onArrived,
  trackedDriverPos,
  pickup,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const isDark = document.documentElement.classList.contains('dark');
  
  // 🧭 Real-time ETA Logic
  const getDynamicTimeAway = () => {
    if (!trackedDriverPos || !pickup || rideMilestone !== 'assigned') {
      return driverInfo.timeAway;
    }
    
    // Simple 2km/min average speed for city driving (rough estimate)
    // 60 km/h = 1 km/min
    const distance = LocationService.calculateDistance(
      trackedDriverPos[0], trackedDriverPos[1],
      pickup.lat, pickup.lon
    );
    
    const minutes = Math.max(Math.ceil(distance * 2), 1);
    return minutes;
  };

  const timeAway = getDynamicTimeAway();
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up">
      <RideStoryTimeline milestone={rideMilestone} lastUpdate={lastMilestoneUpdate} />

      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {rideMilestone === 'assigned' ? 'Driver on the way' : 
             rideMilestone === 'arrived' ? 'Your driver is waiting' : 
             (rideMilestone === 'in_progress' || rideMilestone === 'inprogress' || rideMilestone === 'trip') ? 'Trip in progress' : 
             rideMilestone === 'completed' ? 'Trip completed' : 'Ride status'}
          </span>
        </div>
        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">
          {rideMilestone === 'assigned' ? timeAway + ' mins away' : 
           rideMilestone === 'arrived' ? 'At pickup location' : 
           (rideMilestone === 'in_progress' || rideMilestone === 'inprogress' || rideMilestone === 'trip') ? 'Heading to Destination' : 
           rideMilestone === 'completed' ? 'Arrived at destination' : ''}
        </span>
      </div>

      {/* 🛡️ Verification Panel */}
      {driverInfo.otp && (rideMilestone === 'assigned' || rideMilestone === 'arrived') && (
        <div className="mb-6 group relative overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-[2rem] p-5 shadow-inner">
          <div className="absolute top-0 right-0 p-3 opacity-20">
            <span className="material-symbols-outlined text-4xl text-primary animate-pulse">shield_lock</span>
          </div>
          <div className="flex items-center gap-5">
             <div className="size-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
               <span className="material-symbols-outlined text-white text-2xl">verified_user</span>
             </div>
             <div>
               <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-1.5">Secure Start Code</p>
               <div className="flex items-baseline gap-1">
                 <p className="text-3xl font-black tracking-[0.25em] text-slate-900 dark:text-white">{driverInfo.otp}</p>
                 <span className="material-symbols-outlined text-primary text-sm filled">verified</span>
               </div>
             </div>
          </div>
          <div className="mt-4 pt-4 border-t border-primary/10">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Share this code with chauffeur to authorize trip</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative group/avatar">
          <img
            src={driverInfo.avatar || IMAGES.DRIVER_CARD}
            className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-white/5 transition-transform group-hover/avatar:scale-105"
            alt="Driver"
          />
          {driverInfo.acceptanceImageUrl && (
            <div 
              className="absolute -bottom-1 -right-1 size-16 rounded-2xl border-4 border-surface-light dark:border-surface-dark overflow-hidden shadow-2xl ring-2 ring-primary bg-slate-900 cursor-zoom-in group-hover/avatar:scale-110 transition-transform"
              onClick={() => setIsPreviewOpen(true)}
            >
              <img src={driverInfo.acceptanceImageUrl} className="w-full h-full object-cover" title="Tap to expand verification selfie" alt="" />
              <div className="absolute top-0 right-0 bg-primary px-1 rounded-bl-lg">
                <span className="material-symbols-outlined text-[8px] text-white font-black">face</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-black leading-tight truncate">{driverInfo.name}</h3>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{driverInfo.car} • <span className="text-slate-900 dark:text-slate-300">{driverInfo.plate}</span></p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-lg border border-yellow-500/20">
              <span className="material-symbols-outlined text-yellow-500 text-[14px] filled">star</span>
              <span className="text-[11px] font-black text-yellow-700 dark:text-yellow-500">
                {driverInfo.rating == null ? '5.0' : driverInfo.rating > 5 ? (driverInfo.rating / 100).toFixed(1) : driverInfo.rating.toFixed(1)}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{driverInfo.trips} Trips</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <button onClick={onCall} className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm">
            <span className="material-symbols-outlined text-lg">call</span>
          </button>
          <button onClick={onChat} className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 transition-all">
            <span className="material-symbols-outlined text-lg">chat</span>
          </button>
          <button onClick={onSupport} className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all">
            <span className="material-symbols-outlined text-lg">support_agent</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onTrack}
          className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-[10px] uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">map</span>
          Track
        </button>
        <button
          onClick={onSOS}
          className="flex-1 py-3 rounded-xl bg-red-500/10 font-black text-[10px] uppercase tracking-widest text-red-500 flex items-center justify-center gap-1.5 border border-red-500/20 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-base">emergency</span>
          Get Help
        </button>
      </div>

      {(rideState === 'ASSIGNED' || rideState === 'SEARCHING') && onCancel && (
        <button
          onClick={onCancel}
          className="mt-3 w-full py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-500/30 hover:bg-red-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">close</span>
          Cancel Ride Request
        </button>
      )}

      {rideState === 'IN_PROGRESS' && onArrived && (
        <button
          onClick={onArrived}
          className="mt-4 w-full py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/25 hover:bg-green-700 transition-colors active:scale-95 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">flag</span>
          I have arrived
        </button>
      )}
      {/* 🖼️ High-Fidelity Photo Preview Overlay */}
      {isPreviewOpen && driverInfo.acceptanceImageUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-fade-in">
           <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setIsPreviewOpen(false)} />
           
           <div className="relative w-full max-w-sm aspect-[3/4] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 animate-scale-up">
              <img 
                src={driverInfo.acceptanceImageUrl} 
                className="w-full h-full object-cover" 
                alt="Driver Verification"
              />
              
              <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                       <span className="material-symbols-outlined text-white">verified_user</span>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Verification Selfie</p>
                       <p className="text-sm font-black text-white italic uppercase tracking-tight">{driverInfo.name}</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setIsPreviewOpen(false)}
                   className="size-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center border border-white/20 active:scale-90 transition-all"
                 >
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
                 <p className="text-xs text-white/60 font-medium leading-relaxed">
                   This photo was taken by the chauffeur at the moment of trip acceptance to verify identity and vehicle presence.
                 </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DriverStatusCard;
