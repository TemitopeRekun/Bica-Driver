import React from 'react';
import { DriverRideRequest } from '@/hooks/useDriverRealtime';

interface RideRequestCardProps {
  request: DriverRideRequest;
  onAccept: (request: DriverRideRequest) => void;
  onDecline: (request: DriverRideRequest) => void;
}

const RideRequestCard: React.FC<RideRequestCardProps> = ({ request, onAccept, onDecline }) => {
  return (
    <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 space-y-6 shadow-2xl animate-scale-in">
      {/* Header: Identity & Status */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src={request.avatar} 
              className="size-14 rounded-full border-2 border-primary object-cover" 
              alt="Owner" 
            />
            <div className="absolute -bottom-1 -right-1 size-6 bg-primary rounded-full flex items-center justify-center border-2 border-[#121212]">
              <span className="material-symbols-outlined text-[14px] text-white font-black">verified</span>
            </div>
          </div>
          <div>
            <p className="text-white font-bold text-base">New Request</p>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-yellow-500 fill-yellow-500">star</span>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">4.9 · Verified Owner</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Reward</p>
          <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            <p className="text-xl font-black text-primary italic">₦{request.price}</p>
          </div>
        </div>
      </div>

      {/* Route Timeline */}
      <div className="relative pl-8 space-y-6 py-2">
        {/* Connection Line */}
        <div className="absolute left-3 top-4 bottom-4 w-px border-l-2 border-dashed border-white/20"></div>

        {/* Pickup */}
        <div className="relative">
          <div className="absolute -left-7 top-1 size-4 rounded-full bg-primary border-4 border-primary/20"></div>
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter mb-0.5">Pickup Location</p>
            <p className="text-white text-sm font-medium line-clamp-1">{request.pickup}</p>
          </div>
        </div>

        {/* Destination */}
        <div className="relative">
          <div className="absolute -left-7 top-1 size-4 rounded-full bg-accent border-4 border-accent/20"></div>
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter mb-0.5">Destination</p>
            <p className="text-white text-sm font-medium line-clamp-1">{request.destination}</p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 p-2 rounded-2xl border border-white/5 flex flex-col items-center">
          <span className="material-symbols-outlined text-blue-400 text-lg mb-1">distance</span>
          <p className="text-[8px] text-slate-500 font-bold uppercase">Dist.</p>
          <p className="text-[11px] font-black text-white">{request.distance}</p>
        </div>
        <div className="bg-white/5 p-2 rounded-2xl border border-white/5 flex flex-col items-center">
          <span className="material-symbols-outlined text-orange-400 text-lg mb-1">hail</span>
          <p className="text-[8px] text-slate-500 font-bold uppercase">Arrival</p>
          <p className="text-[11px] font-black text-white">{request.timeToPickup}</p>
        </div>
        <div className="bg-white/5 p-2 rounded-2xl border border-white/5 flex flex-col items-center">
          <span className="material-symbols-outlined text-emerald-400 text-lg mb-1">acute</span>
          <p className="text-[8px] text-slate-500 font-bold uppercase">Trip</p>
          <p className="text-[11px] font-black text-white">{request.tripDuration}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button 
          onClick={() => onDecline(request)}
          className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-4 rounded-2xl border border-white/10 transition-all uppercase tracking-widest text-xs"
        >
          Decline
        </button>
        <button 
          onClick={() => onAccept(request)}
          className="flex-[2] group relative overflow-hidden bg-primary py-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-primary/20"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <span className="relative text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2">
            Accept
            <span className="material-symbols-outlined text-sm font-black">arrow_forward</span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default RideRequestCard;
