import React from 'react';
import RideStoryTimeline from './RideStoryTimeline';
import { IMAGES } from '../../constants';

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
  onCall: () => void;
  onChat: () => void;
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
  onTrack,
  onSOS,
  onCancel,
  onArrived,
}) => {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up">
      <RideStoryTimeline milestone={rideMilestone} lastUpdate={lastMilestoneUpdate} />
      
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
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
          {rideMilestone === 'assigned' ? driverInfo.timeAway + ' mins away' : 
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

      <div className="flex items-center gap-5 mb-6">
        <div className="relative group/avatar">
          <img 
            src={driverInfo.avatar || IMAGES.DRIVER_CARD} 
            className="w-20 h-20 rounded-[1.5rem] object-cover ring-4 ring-slate-100 dark:ring-white/5 transition-transform group-hover/avatar:scale-105" 
            alt="Driver" 
          />
          {driverInfo.acceptanceImageUrl && (
            <div 
              className="absolute -bottom-1 -right-1 size-16 rounded-2xl border-4 border-surface-light dark:border-surface-dark overflow-hidden shadow-2xl ring-2 ring-primary bg-slate-900 cursor-zoom-in group-hover/avatar:scale-110 transition-transform"
              onClick={() => window.open(driverInfo.acceptanceImageUrl, '_blank')}
            >
              <img src={driverInfo.acceptanceImageUrl} className="w-full h-full object-cover" title="Tap to expand verification selfie" alt="" />
              <div className="absolute top-0 right-0 bg-primary px-1 rounded-bl-lg">
                <span className="material-symbols-outlined text-[8px] text-white font-black">face</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black leading-tight truncate">{driverInfo.name}</h3>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{driverInfo.car} • <span className="text-slate-900 dark:text-slate-300">{driverInfo.plate}</span></p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-lg border border-yellow-500/20">
              <span className="material-symbols-outlined text-yellow-500 text-[14px] filled">star</span>
              <span className="text-[11px] font-black text-yellow-700 dark:text-yellow-500">{driverInfo.rating}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{driverInfo.trips} Trips</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={onCall} className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
            <span className="material-symbols-outlined">call</span>
          </button>
          <button onClick={onChat} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <span className="material-symbols-outlined">chat</span>
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onTrack}
          className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">map</span>
          Track
        </button>
        <button onClick={onSOS} className="flex-1 py-3 rounded-xl bg-red-500/10 font-bold text-red-500 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-lg">shield</span>
          SOS
        </button>
      </div>

      {(rideState === 'ASSIGNED' || rideState === 'SEARCHING') && onCancel && (
        <button
          onClick={onCancel}
          className="mt-4 w-full py-4 rounded-xl bg-red-600 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-500/30 hover:bg-red-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
    </div>
  );
};

export default DriverStatusCard;
