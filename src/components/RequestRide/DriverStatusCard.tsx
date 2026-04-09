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

      <div className="flex items-center gap-4 mb-6">
        <img src={driverInfo.avatar || IMAGES.DRIVER_CARD} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary/20" alt="Driver" />
        <div className="flex-1">
          <h3 className="text-lg font-bold leading-tight">{driverInfo.name}</h3>
          <p className="text-sm text-slate-500">{driverInfo.car} • {driverInfo.plate}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-yellow-500 text-sm filled">star</span>
            <span className="text-xs font-bold">{driverInfo.rating}</span>
            <span className="text-xs text-slate-400">({driverInfo.trips} trips)</span>
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
